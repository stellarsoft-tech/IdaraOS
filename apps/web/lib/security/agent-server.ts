/**
 * IdaraOS Agent - server-side helpers (agent device provider)
 *
 * Pairing (sign in to the agent with an IdaraOS account, device-code style):
 * 1. the agent asks for a code (createPairing) and shows the user code
 * 2. the member signs in to IdaraOS and enters it (linkPairing): the device is created or updated,
 *    linked to the member and to their asset (found by serial number, or created)
 * 3. the agent polls with its device code (pollPairing) and receives its device secret once
 *
 * Jobs: approved installs become `install` jobs (software-server.ts startInstall). The agent receives
 * them at check-in (dispatchJobs) and reports each one (completeJob).
 *
 * Only hashes of device codes and device secrets are stored.
 */

import { and, eq, gt, lt, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  agentJobs,
  agentPairings,
  assetAssignments,
  assets,
  softwareInstalls,
  softwareUpdateDevices,
  users,
  type AgentJob,
  type SoftwareUpdateDevice,
} from "@/lib/db/schema"
import { createAuditLog } from "@/lib/audit"
import {
  JOB_RESEND_MINUTES,
  MAX_JOB_ATTEMPTS,
  PAIRING_TTL_MINUTES,
  agentAssetTag,
  generateUserCode,
  installJobResult,
} from "./agent"
import { truncateLog } from "./software"
import { generateSecret, hashSecret } from "./software-updates-server"
import { getElevationSettings } from "./elevation-server"
import { failAgentInstall, markAgentInstallFailed, markInstalled } from "./software-server"
import {
  actionJobResult,
  deviceActionName,
  getDeviceAction,
  isValidDeviceAction,
  isValidDeviceActionParam,
} from "./device-actions"

const AGENT_ACTOR = { id: null, email: "system", name: "IdaraOS Agent", ip: null, userAgent: null }

// ============================================================================
// PAIRING
// ============================================================================

export interface PairingDeviceInfo {
  hostname: string
  machineId: string
  serialNumber?: string | null
}

/**
 * Start a pairing: returns the user code to show and the device code to poll with (shown once)
 */
export async function createPairing(info: PairingDeviceInfo, now: Date = new Date()) {
  const deviceCode = generateSecret("iap")
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MINUTES * 60_000)

  // User codes only need to be unique among live pairings
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = generateUserCode()
    const [clash] = await db
      .select({ id: agentPairings.id })
      .from(agentPairings)
      .where(and(eq(agentPairings.userCode, userCode), eq(agentPairings.status, "pending"), gt(agentPairings.expiresAt, now)))
      .limit(1)
    if (clash) continue

    await db.insert(agentPairings).values({
      userCode,
      deviceCodeHash: hashSecret(deviceCode),
      hostname: info.hostname,
      machineId: info.machineId.toLowerCase(),
      serialNumber: info.serialNumber?.trim() || null,
      expiresAt,
    })
    return { userCode, deviceCode, expiresAt }
  }
  throw new Error("Could not allocate a pairing code")
}

async function recordAssignment(assetId: string, personId: string, userId: string, now: Date) {
  await db.insert(assetAssignments).values({
    assetId,
    personId,
    assignedAt: now,
    assignedById: userId,
    notes: "Linked by signing in to the IdaraOS Agent",
  })
}

export type LinkPairingResult =
  | { ok: true; device: SoftwareUpdateDevice; assetId: string; assetCreated: boolean }
  | { ok: false; status: number; code: string; error: string }

/**
 * A signed-in member entered a user code: enroll the device and link it (and its asset) to them
 */
export async function linkPairing(
  input: { userCode: string; orgId: string; userId: string },
  now: Date = new Date()
): Promise<LinkPairingResult> {
  const [pairing] = await db
    .select()
    .from(agentPairings)
    .where(and(
      eq(agentPairings.userCode, input.userCode),
      eq(agentPairings.status, "pending"),
      gt(agentPairings.expiresAt, now)
    ))
    .limit(1)
  if (!pairing) {
    return { ok: false, status: 404, code: "invalid_code", error: "That code is wrong or has expired. Check the code on the device." }
  }

  const settings = await getElevationSettings(input.orgId)
  if (settings.deviceProvider !== "agent") {
    return {
      ok: false,
      status: 409,
      code: "agent_not_enabled",
      error: "Your organization doesn't use the IdaraOS Agent. Ask IT to switch the device provider in Admin Access settings.",
    }
  }

  const [user] = await db
    .select({ personId: users.personId, name: users.name })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)
  const personId = user?.personId ?? null

  const [existing] = await db
    .select()
    .from(softwareUpdateDevices)
    .where(and(eq(softwareUpdateDevices.orgId, input.orgId), eq(softwareUpdateDevices.machineId, pairing.machineId)))
    .limit(1)
  if (existing?.status === "revoked") {
    return { ok: false, status: 403, code: "device_revoked", error: "This device was revoked in IdaraOS. Ask IT to restore it." }
  }

  // Asset: keep the device's asset, else match by serial number, else create one for the member
  let assetId = existing?.assetId ?? null
  let assetCreated = false
  if (!assetId && pairing.serialNumber) {
    const [match] = await db
      .select({ id: assets.id, assignedToId: assets.assignedToId })
      .from(assets)
      .where(and(eq(assets.orgId, input.orgId), sql`lower(${assets.serialNumber}) = ${pairing.serialNumber.toLowerCase()}`))
      .limit(1)
    if (match) {
      if (match.assignedToId && match.assignedToId !== personId) {
        return {
          ok: false,
          status: 409,
          code: "assigned_to_someone_else",
          error: "This device is assigned to someone else in Assets. Ask IT to reassign it first.",
        }
      }
      assetId = match.id
      if (!match.assignedToId && personId) {
        await db
          .update(assets)
          .set({ assignedToId: personId, assignedAt: now, status: "assigned", updatedAt: now })
          .where(eq(assets.id, match.id))
        await recordAssignment(match.id, personId, input.userId, now)
      }
    }
  }
  if (!assetId) {
    const [created] = await db
      .insert(assets)
      .values({
        orgId: input.orgId,
        assetTag: agentAssetTag(pairing.machineId),
        name: pairing.hostname,
        serialNumber: pairing.serialNumber,
        status: personId ? "assigned" : "available",
        assignedToId: personId,
        assignedAt: personId ? now : null,
        notes: "Created when the IdaraOS Agent was linked",
      })
      .returning({ id: assets.id })
    assetId = created.id
    assetCreated = true
    if (personId) await recordAssignment(created.id, personId, input.userId, now)
  }

  // The device secret is only issued when the agent polls; until then the row has an unusable hash
  const placeholderHash = existing?.secretHash ?? hashSecret(generateSecret("unset"))
  const values = {
    assetId,
    userId: input.userId,
    hostname: pairing.hostname,
    serialNumber: pairing.serialNumber,
    secretHash: placeholderHash,
    status: "active" as const,
    updatedAt: now,
  }
  const [device] = existing
    ? await db.update(softwareUpdateDevices).set(values).where(eq(softwareUpdateDevices.id, existing.id)).returning()
    : await db
        .insert(softwareUpdateDevices)
        .values({ ...values, orgId: input.orgId, machineId: pairing.machineId, enrolledAt: now })
        .returning()

  const [approved] = await db
    .update(agentPairings)
    .set({ status: "approved", orgId: input.orgId, userId: input.userId, deviceId: device.id, approvedAt: now })
    .where(and(eq(agentPairings.id, pairing.id), eq(agentPairings.status, "pending")))
    .returning({ id: agentPairings.id })
  if (!approved) {
    return { ok: false, status: 409, code: "already_used", error: "That code was already used" }
  }

  return { ok: true, device, assetId, assetCreated }
}

export type PollPairingResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "completed"; deviceId: string; deviceSecret: string; orgId: string }

/**
 * The agent polls with its device code; once a member linked it, the device secret is issued (once)
 */
export async function pollPairing(deviceCode: string, now: Date = new Date()): Promise<PollPairingResult> {
  const [pairing] = await db
    .select()
    .from(agentPairings)
    .where(eq(agentPairings.deviceCodeHash, hashSecret(deviceCode)))
    .limit(1)
  if (!pairing || pairing.status === "completed" || pairing.status === "expired") return { status: "expired" }
  if (pairing.status === "pending") {
    if (pairing.expiresAt.getTime() <= now.getTime()) {
      await db.update(agentPairings).set({ status: "expired" }).where(eq(agentPairings.id, pairing.id))
      return { status: "expired" }
    }
    return { status: "pending" }
  }

  // approved - claim it so a second poll can't collect another secret
  const [claimed] = await db
    .update(agentPairings)
    .set({ status: "completed" })
    .where(and(eq(agentPairings.id, pairing.id), eq(agentPairings.status, "approved")))
    .returning()
  if (!claimed?.deviceId || !claimed.orgId) return { status: "expired" }

  const deviceSecret = generateSecret("iud")
  await db
    .update(softwareUpdateDevices)
    .set({ secretHash: hashSecret(deviceSecret), lastSeenAt: now, lastError: null, updatedAt: now })
    .where(eq(softwareUpdateDevices.id, claimed.deviceId))

  return { status: "completed", deviceId: claimed.deviceId, deviceSecret, orgId: claimed.orgId }
}

// ============================================================================
// JOBS
// ============================================================================

export interface DispatchedJob {
  id: string
  type: AgentJob["type"]
  wingetId?: string
  name?: string
  // Visual Studio workloads to install with it (--add <id>)
  workloads?: string[]
  // Action jobs: the allowlisted action key and its chosen parameter (see device-actions.ts)
  actionKey?: string
  param?: string
}

async function failJob(job: AgentJob, message: string, now: Date) {
  await db
    .update(agentJobs)
    .set({ status: "failed", error: message, finishedAt: now, updatedAt: now })
    .where(eq(agentJobs.id, job.id))
  if (job.installId) {
    const [install] = await db.select().from(softwareInstalls).where(eq(softwareInstalls.id, job.installId)).limit(1)
    if (install) await markAgentInstallFailed(install, message, now)
  }
}

/**
 * Jobs to hand to the device at this check-in: new ones, and sent ones it never reported on
 */
export async function dispatchJobs(device: SoftwareUpdateDevice, now: Date = new Date()): Promise<DispatchedJob[]> {
  const resendBefore = new Date(now.getTime() - JOB_RESEND_MINUTES * 60_000)
  const due = await db
    .select()
    .from(agentJobs)
    .where(and(
      eq(agentJobs.deviceId, device.id),
      or(
        eq(agentJobs.status, "pending"),
        and(eq(agentJobs.status, "sent"), lt(agentJobs.sentAt, resendBefore))
      )
    ))
    .orderBy(agentJobs.createdAt)
    .limit(10)

  const dispatched: DispatchedJob[] = []
  for (const job of due) {
    if (job.attempts >= MAX_JOB_ATTEMPTS) {
      await failJob(job, "The device didn't report a result in time", now)
      continue
    }
    // Conditional update so two overlapping check-ins don't both send it
    const [sent] = await db
      .update(agentJobs)
      .set({ status: "sent", attempts: job.attempts + 1, sentAt: now, updatedAt: now })
      .where(and(eq(agentJobs.id, job.id), eq(agentJobs.status, job.status), eq(agentJobs.attempts, job.attempts)))
      .returning()
    if (!sent) continue
    dispatched.push({
      id: sent.id,
      type: sent.type,
      wingetId: sent.payload.wingetId,
      name: sent.payload.name,
      ...(sent.payload.workloads && { workloads: sent.payload.workloads.split(",") }),
      ...(sent.payload.actionKey && { actionKey: sent.payload.actionKey }),
      ...(sent.payload.param && { param: sent.payload.param }),
    })
  }
  return dispatched
}

export interface JobReport {
  exitCode?: number | null
  message?: string | null
  log?: string | null
}

export type CompleteJobResult =
  | { ok: true; job: AgentJob }
  | { ok: false; status: number; error: string }

/**
 * The device reports a job's result
 */
export async function completeJob(
  device: SoftwareUpdateDevice,
  jobId: string,
  report: JobReport,
  now: Date = new Date()
): Promise<CompleteJobResult> {
  const [job] = await db
    .select()
    .from(agentJobs)
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.deviceId, device.id)))
    .limit(1)
  if (!job) return { ok: false, status: 404, error: "Job not found" }
  if (job.status !== "sent") return { ok: false, status: 409, error: "This job isn't waiting for a result" }

  // Action jobs have no winget/retry semantics: success is exit 0, and a failure is just reported.
  const result =
    job.type === "action"
      ? { ...actionJobResult(report.exitCode, report.message), rebootRequired: false, retryable: false }
      : installJobResult(report.exitCode, report.message)
  const [finished] = await db
    .update(agentJobs)
    .set({
      status: result.succeeded ? "succeeded" : "failed",
      result: { exitCode: result.exitCode, rebootRequired: result.rebootRequired, message: result.message },
      error: result.succeeded ? null : result.message ?? null,
      log: truncateLog(report.log),
      finishedAt: now,
      updatedAt: now,
    })
    .where(and(eq(agentJobs.id, job.id), eq(agentJobs.status, "sent")))
    .returning()
  if (!finished) return { ok: false, status: 409, error: "This job isn't waiting for a result" }

  if (job.installId) {
    const [install] = await db.select().from(softwareInstalls).where(eq(softwareInstalls.id, job.installId)).limit(1)
    // A revoked or already finished install keeps its status; the job result is still logged
    if (install && ["pending", "assigned"].includes(install.status)) {
      if (result.succeeded) {
        await markInstalled(install, result.rebootRequired ? "IdaraOS Agent - restart needed" : "IdaraOS Agent", now)
      } else if (!result.retryable) {
        await failAgentInstall(install, result.message ?? "Install failed", now)
      } else {
        await markAgentInstallFailed(install, result.message ?? "Install failed", now)
      }
    }
  }

  if (job.type === "action") {
    // Action output goes to the device's Audit log tab: keyed to the device, with the command
    // output in metadata so it renders readably instead of a raw log blob buried in a dialog.
    const p = job.payload as { actionKey?: string | null; name?: string | null; param?: string | null }
    await createAuditLog(
      { orgId: device.orgId, actor: AGENT_ACTOR },
      {
        module: "security.software-updates",
        action: result.succeeded ? "device_action_completed" : "device_action_failed",
        entityType: "software_update_device",
        entityId: device.id,
        entityName: device.hostname,
        description: `${p.name ?? "Action"} on ${device.hostname}: ${result.message}`,
        metadata: {
          actionKey: p.actionKey ?? null,
          actionName: p.name ?? null,
          param: p.param ?? null,
          exitCode: result.exitCode,
          message: result.message ?? null,
          output: truncateLog(report.log),
        },
      }
    )
  } else {
    await createAuditLog(
      { orgId: device.orgId, actor: AGENT_ACTOR },
      {
        module: "security.software",
        action: result.succeeded ? "agent_job_succeeded" : "agent_job_failed",
        entityType: "agent_job",
        entityId: job.id,
        entityName: device.hostname,
        description: `${job.payload.name ?? job.type} on ${device.hostname}: ${result.message}`,
      }
    )
  }

  return { ok: true, job: finished }
}

// ============================================================================
// DEVICE ACTIONS
// ============================================================================

export type QueueActionResult =
  | { ok: true; jobId: string; actionName: string }
  | { ok: false; status: number; error: string }

/**
 * Queue one allowlisted action for a device, to run at its next check-in.
 * The action key and parameter are validated against the allowlist (device-actions.ts);
 * no command text is ever stored or sent. Caller checks the device is active and authorized.
 */
export async function queueDeviceAction(
  device: SoftwareUpdateDevice,
  actionKey: string,
  param: string | null
): Promise<QueueActionResult> {
  if (!isValidDeviceAction(actionKey)) {
    return { ok: false, status: 400, error: "Unknown device action" }
  }
  if (!isValidDeviceActionParam(actionKey, param)) {
    return { ok: false, status: 400, error: "That option isn't allowed for this action" }
  }
  const action = getDeviceAction(actionKey)!
  const normalizedParam = action.param ? param : null

  // One open job per action+parameter, so repeated clicks don't pile up
  const [open] = await db
    .select({ id: agentJobs.id })
    .from(agentJobs)
    .where(
      and(
        eq(agentJobs.deviceId, device.id),
        eq(agentJobs.type, "action"),
        or(eq(agentJobs.status, "pending"), eq(agentJobs.status, "sent")),
        sql`${agentJobs.payload}->>'actionKey' = ${actionKey}`,
        normalizedParam
          ? sql`${agentJobs.payload}->>'param' = ${normalizedParam}`
          : sql`${agentJobs.payload}->>'param' IS NULL`
      )
    )
    .limit(1)
  if (open) {
    return { ok: false, status: 409, error: "That action is already queued for this device" }
  }

  const payload: Record<string, string> = { actionKey, name: action.label }
  if (normalizedParam) payload.param = normalizedParam

  const [job] = await db
    .insert(agentJobs)
    .values({ orgId: device.orgId, deviceId: device.id, type: "action", payload })
    .returning({ id: agentJobs.id })

  return { ok: true, jobId: job.id, actionName: action.label }
}

export interface DeviceActionJob {
  id: string
  actionKey: string
  actionName: string
  param: string | null
  status: AgentJob["status"]
  message: string | null
  log: string | null
  createdAt: Date
  finishedAt: Date | null
}

/**
 * Recent action jobs for a device (newest first), for the portal's action history
 */
export async function listDeviceActionJobs(
  device: SoftwareUpdateDevice,
  limit = 25
): Promise<DeviceActionJob[]> {
  const rows = await db
    .select()
    .from(agentJobs)
    .where(and(eq(agentJobs.deviceId, device.id), eq(agentJobs.type, "action")))
    .orderBy(sql`${agentJobs.createdAt} DESC`)
    .limit(limit)

  return rows.map((job) => ({
    id: job.id,
    actionKey: job.payload.actionKey ?? "",
    actionName: job.payload.name ?? deviceActionName(job.payload.actionKey ?? ""),
    param: job.payload.param ?? null,
    status: job.status,
    message: job.result?.message ?? job.error ?? null,
    log: job.log,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  }))
}
