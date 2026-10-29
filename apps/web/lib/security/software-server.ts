/**
 * Security Software - server-side helpers
 * Approved software catalog and Intune installs for approved app_install grants (database + Graph access)
 */

import { and, desc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  elevationGrants,
  softwareCatalog,
  softwareInstalls,
  softwareUpdateDevices,
  softwareUpdateRuns,
  softwareUpdateSettings,
  type SoftwareInstall,
  type SoftwareUpdateSettings,
} from "@/lib/db/schema"
import { createAuditLog } from "@/lib/audit"
import { DEFAULT_CATALOG_APPS, MAX_INSTALL_ATTEMPTS } from "./software"
import {
  addDeviceToGroup,
  getDeviceInstallState,
  removeDeviceFromGroup,
  resolveDeviceObjectId,
  syncDevice,
} from "./software-intune"

const SYSTEM_ACTOR = { id: null, email: "system", name: "System", ip: null, userAgent: null }

async function logSystem(orgId: string, entityId: string, action: string, description: string) {
  await createAuditLog(
    { orgId, actor: SYSTEM_ACTOR },
    { module: "security.software", action, entityType: "software_install", entityId, description }
  )
}

// ============================================================================
// SETTINGS + CATALOG
// ============================================================================

/**
 * Get the organization's software update settings, creating the defaults on first use
 */
export async function getSoftwareUpdateSettings(orgId: string): Promise<SoftwareUpdateSettings> {
  const [existing] = await db
    .select()
    .from(softwareUpdateSettings)
    .where(eq(softwareUpdateSettings.orgId, orgId))
    .limit(1)
  if (existing) return existing

  await db.insert(softwareUpdateSettings).values({ orgId }).onConflictDoNothing()
  const [created] = await db
    .select()
    .from(softwareUpdateSettings)
    .where(eq(softwareUpdateSettings.orgId, orgId))
    .limit(1)
  return created
}

/**
 * Add the recommended apps to the catalog once per organization (deleted apps stay deleted)
 */
export async function ensureDefaultCatalog(orgId: string, createdById?: string | null): Promise<void> {
  const settings = await getSoftwareUpdateSettings(orgId)
  if (settings.catalogSeededAt) return

  // Claim the seed first so two concurrent requests don't both insert
  const [claimed] = await db
    .update(softwareUpdateSettings)
    .set({ catalogSeededAt: new Date() })
    .where(and(eq(softwareUpdateSettings.id, settings.id), isNull(softwareUpdateSettings.catalogSeededAt)))
    .returning({ id: softwareUpdateSettings.id })
  if (!claimed) return

  await db
    .insert(softwareCatalog)
    .values(DEFAULT_CATALOG_APPS.map((app) => ({ ...app, orgId, createdById: createdById ?? null })))
    .onConflictDoNothing()
}

/**
 * Packages the IdaraOS Updater upgrades: enabled catalog apps updated by winget
 */
export async function getUpdatePackages(orgId: string): Promise<Array<{ wingetId: string; name: string }>> {
  const rows = await db
    .select({ wingetId: softwareCatalog.wingetId, name: softwareCatalog.name })
    .from(softwareCatalog)
    .where(and(
      eq(softwareCatalog.orgId, orgId),
      eq(softwareCatalog.enabled, true),
      eq(softwareCatalog.autoUpdate, true),
      eq(softwareCatalog.updateMethod, "winget")
    ))
    .orderBy(softwareCatalog.name)
  return rows.filter((r): r is { wingetId: string; name: string } => !!r.wingetId)
}

// ============================================================================
// INSTALLS
// ============================================================================

/**
 * Add the device to the app's install group and ask Intune to sync it.
 * Failures are recorded on the install; the sweep retries pending installs.
 */
export async function startInstall(install: SoftwareInstall, now: Date = new Date()): Promise<SoftwareInstall> {
  const attempts = install.attempts + 1
  try {
    const deviceObjectId = install.deviceObjectId ?? (await resolveDeviceObjectId(install.entraDeviceId))
    await addDeviceToGroup(install.groupId, deviceObjectId)

    // A sync only speeds things up - the device installs at its next check-in anyway
    let syncRequestedAt: Date | null = null
    if (install.intuneDeviceId) {
      try {
        await syncDevice(install.intuneDeviceId)
        syncRequestedAt = now
      } catch (error) {
        console.error(`[Software] syncDevice failed for install ${install.id}:`, error)
      }
    }

    const [updated] = await db
      .update(softwareInstalls)
      .set({
        status: "assigned",
        deviceObjectId,
        attempts,
        groupAddedAt: now,
        syncRequestedAt,
        error: null,
        updatedAt: now,
      })
      .where(eq(softwareInstalls.id, install.id))
      .returning()
    await logSystem(install.orgId, install.id, "install_assigned", `Added device to install group for ${install.appName}`)
    return updated
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add the device to the install group"
    const [updated] = await db
      .update(softwareInstalls)
      .set({ attempts, error: message, updatedAt: now })
      .where(eq(softwareInstalls.id, install.id))
      .returning()
    await logSystem(install.orgId, install.id, "install_assign_failed", `Install of ${install.appName} not assigned: ${message}`)
    return updated
  }
}

async function removeFromGroupQuietly(install: SoftwareInstall, now: Date): Promise<Date | null> {
  if (!install.deviceObjectId || !install.groupAddedAt) return null
  try {
    await removeDeviceFromGroup(install.groupId, install.deviceObjectId)
    return now
  } catch (error) {
    console.error(`[Software] Could not remove device from group for install ${install.id}:`, error)
    return null
  }
}

async function markInstalled(install: SoftwareInstall, source: string, now: Date) {
  const groupRemovedAt = install.removeFromGroupAfterInstall ? await removeFromGroupQuietly(install, now) : null

  await db
    .update(softwareInstalls)
    .set({ status: "installed", installedAt: now, lastCheckedAt: now, groupRemovedAt, error: null, updatedAt: now })
    .where(eq(softwareInstalls.id, install.id))
  await db
    .update(elevationGrants)
    .set({ status: "completed", endedAt: now, endReason: "installed", updatedAt: now })
    .where(and(eq(elevationGrants.id, install.grantId), eq(elevationGrants.status, "active")))
  await logSystem(install.orgId, install.id, "install_completed", `${install.appName} installed (${source})`)
}

/**
 * The updater reports installed winget packages in every run - use that as a second signal
 */
async function updaterSawPackage(install: SoftwareInstall): Promise<boolean> {
  if (!install.wingetId) return false
  const [run] = await db
    .select({ results: softwareUpdateRuns.results })
    .from(softwareUpdateRuns)
    .innerJoin(softwareUpdateDevices, eq(softwareUpdateRuns.deviceId, softwareUpdateDevices.id))
    .where(and(
      eq(softwareUpdateDevices.orgId, install.orgId),
      eq(softwareUpdateDevices.entraDeviceId, install.entraDeviceId),
      inArray(softwareUpdateRuns.status, ["succeeded", "partial"])
    ))
    .orderBy(desc(softwareUpdateRuns.startedAt))
    .limit(1)
  return !!run?.results.some(
    (r) => r.wingetId.toLowerCase() === install.wingetId!.toLowerCase() && ["updated", "up_to_date"].includes(r.outcome)
  )
}

/**
 * Cancel an install when its grant is revoked: take the device out of the group if nothing installed yet
 */
export async function cancelInstall(grantId: string, now: Date = new Date()): Promise<void> {
  const [install] = await db.select().from(softwareInstalls).where(eq(softwareInstalls.grantId, grantId)).limit(1)
  if (!install || install.status === "installed") return

  const groupRemovedAt = await removeFromGroupQuietly(install, now)
  await db
    .update(softwareInstalls)
    .set({ status: "cancelled", groupRemovedAt, updatedAt: now })
    .where(eq(softwareInstalls.id, install.id))
}

export interface InstallSweepResult {
  assigned: number
  installed: number
  failed: number
}

/**
 * Assign pending installs, detect finished ones, and fail installs past their deadline
 */
export async function processInstalls(now: Date = new Date(), limit = 25): Promise<InstallSweepResult> {
  const result: InstallSweepResult = { assigned: 0, installed: 0, failed: 0 }

  const live = await db
    .select({ install: softwareInstalls, expiresAt: elevationGrants.expiresAt })
    .from(softwareInstalls)
    .innerJoin(elevationGrants, eq(softwareInstalls.grantId, elevationGrants.id))
    .where(and(
      eq(elevationGrants.status, "active"),
      inArray(softwareInstalls.status, ["pending", "assigned"])
    ))
    .orderBy(sql`${softwareInstalls.lastCheckedAt} ASC NULLS FIRST`)
    .limit(limit)

  for (const { install, expiresAt } of live) {
    if (expiresAt.getTime() <= now.getTime()) continue // handled by the deadline pass below

    if (install.status === "pending") {
      if (install.attempts >= MAX_INSTALL_ATTEMPTS) continue
      const updated = await startInstall(install, now)
      if (updated.status === "assigned") result.assigned++
      continue
    }

    try {
      let state = "unknown"
      if (install.intuneAppId && install.intuneDeviceId) {
        state = await getDeviceInstallState(install.intuneAppId, install.intuneDeviceId)
      }
      if (state === "installed") {
        await markInstalled(install, "Intune", now)
        result.installed++
        continue
      }
      if (await updaterSawPackage(install)) {
        await markInstalled(install, "IdaraOS Updater", now)
        result.installed++
        continue
      }
      await db
        .update(softwareInstalls)
        .set({
          lastCheckedAt: now,
          lastIntuneState: state,
          // Intune retries failed installs itself; keep the reason visible until the deadline
          error: state === "failed" ? "Intune reports the install failed - it will retry until the deadline" : install.error,
          updatedAt: now,
        })
        .where(eq(softwareInstalls.id, install.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read install status"
      await db
        .update(softwareInstalls)
        .set({ lastCheckedAt: now, error: message, updatedAt: now })
        .where(eq(softwareInstalls.id, install.id))
    }
  }

  // Deadline: end the grant; the device stays in the group so Intune keeps trying
  const overdue = await db
    .update(elevationGrants)
    .set({ status: "expired", endedAt: now, endReason: "install_failed", updatedAt: now })
    .where(and(
      eq(elevationGrants.mode, "app_install"),
      eq(elevationGrants.status, "active"),
      lte(elevationGrants.expiresAt, now)
    ))
    .returning({ id: elevationGrants.id, orgId: elevationGrants.orgId })

  for (const grant of overdue) {
    const [failed] = await db
      .update(softwareInstalls)
      .set({
        status: "failed",
        error: "Not installed before the deadline. Check the app's install status in Intune.",
        updatedAt: now,
      })
      .where(and(eq(softwareInstalls.grantId, grant.id), inArray(softwareInstalls.status, ["pending", "assigned"])))
      .returning()
    if (failed) {
      await logSystem(grant.orgId, failed.id, "install_failed", `${failed.appName} was not installed before the deadline`)
      result.failed++
    }
  }

  return result
}

/**
 * Retry a failed or stuck install: re-add to the group, sync, and give it a new deadline
 */
export async function retryInstall(grantId: string, deadline: Date, now: Date = new Date()): Promise<SoftwareInstall | null> {
  const [install] = await db.select().from(softwareInstalls).where(eq(softwareInstalls.grantId, grantId)).limit(1)
  if (!install || install.status === "installed" || install.status === "cancelled") return null

  await db
    .update(elevationGrants)
    .set({ status: "active", endedAt: null, endReason: null, expiresAt: deadline, updatedAt: now })
    .where(eq(elevationGrants.id, grantId))
  const [reset] = await db
    .update(softwareInstalls)
    .set({ status: "pending", attempts: 0, error: null, updatedAt: now })
    .where(eq(softwareInstalls.id, install.id))
    .returning()
  return startInstall(reset, now)
}

// ============================================================================
// UPDATE RUNS
// ============================================================================

/**
 * Runs the device never reported back on are marked failed, so the log shows the gap
 */
export async function expireStaleRuns(now: Date, timeoutMinutes: number): Promise<number> {
  const cutoff = new Date(now.getTime() - timeoutMinutes * 60_000)
  const stale = await db
    .update(softwareUpdateRuns)
    .set({ status: "failed", error: "The device didn't report a result for this run", finishedAt: now })
    .where(and(eq(softwareUpdateRuns.status, "running"), lt(softwareUpdateRuns.startedAt, cutoff)))
    .returning({ deviceId: softwareUpdateRuns.deviceId })

  for (const { deviceId } of stale) {
    await db
      .update(softwareUpdateDevices)
      .set({ lastRunStatus: "failed", updatedAt: now })
      .where(eq(softwareUpdateDevices.id, deviceId))
  }
  return stale.length
}
