/**
 * Software Updates - server-side helpers for the IdaraOS Updater
 *
 * The updater is a scheduled task on each device, running as SYSTEM. It:
 * 1. enrolls once with the organization's enrollment token (device must exist in Assets)
 * 2. checks in every few minutes; the server answers with a run when one is due
 *    (scheduled time passed, or a super admin pressed "Run now")
 * 3. runs `winget upgrade` for the packages in the run and reports every result, including failures
 *
 * Only hashes of the enrollment token and device secrets are stored.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  softwareUpdateDevices,
  softwareUpdateRuns,
  type SoftwareUpdateDevice,
  type SoftwareUpdatePackageResult,
  type SoftwareUpdateRun,
  type SoftwareUpdateSettings,
} from "@/lib/db/schema"
import { isScheduledRunDue, summarizeRun, truncateLog, type UpdateSchedule } from "./software"
import { getUpdatePackages } from "./software-server"

// ============================================================================
// SECRETS
// ============================================================================

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

export function generateSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`
}

function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Parse `Authorization: Bearer <deviceId>.<secret>`
 */
export function parseDeviceAuthorization(header: string | null): { deviceId: string; secret: string } | null {
  const match = header?.match(/^Bearer ([0-9a-f-]{36})\.(\S+)$/i)
  return match ? { deviceId: match[1].toLowerCase(), secret: match[2] } : null
}

/**
 * The calling device, or null if the credentials are wrong or the device was revoked
 */
export async function authenticateDevice(authorization: string | null): Promise<SoftwareUpdateDevice | null> {
  const parsed = parseDeviceAuthorization(authorization)
  if (!parsed) return null

  const [device] = await db
    .select()
    .from(softwareUpdateDevices)
    .where(eq(softwareUpdateDevices.id, parsed.deviceId))
    .limit(1)
  if (!device || device.status !== "active") return null
  return hashesMatch(device.secretHash, hashSecret(parsed.secret)) ? device : null
}

export function scheduleFromSettings(settings: SoftwareUpdateSettings): UpdateSchedule {
  return {
    enabled: settings.scheduleEnabled,
    days: settings.scheduleDays,
    time: settings.scheduleTime,
    timezone: settings.scheduleTimezone,
  }
}

// ============================================================================
// CHECK-IN
// ============================================================================

export interface DispatchedRun {
  id: string
  trigger: SoftwareUpdateRun["trigger"]
  packages: Array<{ wingetId: string; name: string }>
}

/**
 * Called on every check-in. Returns a run when one is due, otherwise null.
 * The updater flushes unsent results before checking in and never checks in mid-run,
 * so a run still marked running here was interrupted (reboot, killed task).
 */
export async function dispatchRunIfDue(
  device: SoftwareUpdateDevice,
  settings: SoftwareUpdateSettings,
  now: Date = new Date()
): Promise<DispatchedRun | null> {
  await db
    .update(softwareUpdateRuns)
    .set({ status: "failed", error: "The run was interrupted (device restarted or the updater stopped)", finishedAt: now })
    .where(and(eq(softwareUpdateRuns.deviceId, device.id), eq(softwareUpdateRuns.status, "running")))

  const manual = !!device.runRequestedAt
  const scheduled = isScheduledRunDue(scheduleFromSettings(settings), device.lastRunAt, device.enrolledAt, now)
  if (!manual && !scheduled) return null

  // Claim the run on the device row so two overlapping check-ins can't both start one
  const [claimed] = await db
    .update(softwareUpdateDevices)
    .set({ lastRunAt: now, lastRunStatus: "running", runRequestedAt: null, runRequestedById: null, updatedAt: now })
    .where(and(
      eq(softwareUpdateDevices.id, device.id),
      device.lastRunAt ? eq(softwareUpdateDevices.lastRunAt, device.lastRunAt) : isNull(softwareUpdateDevices.lastRunAt)
    ))
    .returning({ id: softwareUpdateDevices.id })
  if (!claimed) return null

  const packages = await getUpdatePackages(device.orgId)
  const [run] = await db
    .insert(softwareUpdateRuns)
    .values({
      orgId: device.orgId,
      deviceId: device.id,
      trigger: manual ? "manual" : "scheduled",
      requestedById: manual ? device.runRequestedById : null,
      packages: packages.map((p) => p.wingetId),
      startedAt: now,
    })
    .returning()

  return { id: run.id, trigger: run.trigger, packages }
}

// ============================================================================
// RESULTS
// ============================================================================

export interface RunReport {
  results: SoftwareUpdatePackageResult[]
  error?: string | null
  log?: string | null
}

/**
 * Store a run's results. A late report also replaces a run the sweep already marked failed.
 */
export async function completeRun(
  device: SoftwareUpdateDevice,
  runId: string,
  report: RunReport,
  now: Date = new Date()
): Promise<SoftwareUpdateRun | null> {
  const [run] = await db
    .select()
    .from(softwareUpdateRuns)
    .where(and(eq(softwareUpdateRuns.id, runId), eq(softwareUpdateRuns.deviceId, device.id)))
    .limit(1)
  if (!run) return null
  if (run.status !== "running" && run.results.length > 0) return run

  const summary = summarizeRun(report.results, report.error)
  const [updated] = await db
    .update(softwareUpdateRuns)
    .set({
      status: summary.status,
      results: report.results,
      updatedCount: summary.updatedCount,
      failedCount: summary.failedCount,
      rebootRequired: summary.rebootRequired,
      error: report.error ?? null,
      log: truncateLog(report.log),
      finishedAt: now,
    })
    .where(eq(softwareUpdateRuns.id, runId))
    .returning()

  // Only the latest run decides the device's status
  const [latest] = await db
    .select({ id: softwareUpdateRuns.id })
    .from(softwareUpdateRuns)
    .where(eq(softwareUpdateRuns.deviceId, device.id))
    .orderBy(desc(softwareUpdateRuns.startedAt))
    .limit(1)
  if (latest?.id === runId) {
    await db
      .update(softwareUpdateDevices)
      .set({ lastRunStatus: summary.status, lastError: report.error ?? null, updatedAt: now })
      .where(eq(softwareUpdateDevices.id, device.id))
  }

  return updated
}

/**
 * Ask one device (or every active device in the org) to run at its next check-in
 */
export async function requestRunNow(orgId: string, requestedById: string, deviceId?: string): Promise<number> {
  const now = new Date()
  const rows = await db
    .update(softwareUpdateDevices)
    .set({ runRequestedAt: now, runRequestedById: requestedById, updatedAt: now })
    .where(and(
      eq(softwareUpdateDevices.orgId, orgId),
      eq(softwareUpdateDevices.status, "active"),
      deviceId ? eq(softwareUpdateDevices.id, deviceId) : undefined
    ))
    .returning({ id: softwareUpdateDevices.id })
  return rows.length
}
