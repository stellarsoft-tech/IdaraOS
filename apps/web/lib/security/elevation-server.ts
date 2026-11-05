/**
 * Security Endpoint Elevation - server-side helpers
 * Settings, grant expiry and LAPS rotation reconciliation (database + Graph access)
 */

import { and, eq, inArray, lt, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests, elevationSettings, type ElevationSettings } from "@/lib/db/schema"
import { createAuditLog } from "@/lib/audit"
import { MAX_ROTATION_ATTEMPTS, isRotationVerified } from "./elevation"
import { getLapsLastBackupAt, requestLapsRotation } from "./elevation-laps"
import { requestAdminRotation } from "./admin-credential-server"
import { RUN_TIMEOUT_MINUTES } from "./software"
import { expireStaleRuns, processInstalls } from "./software-server"

const SYSTEM_ACTOR = { id: null, email: "system", name: "System", ip: null, userAgent: null }

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Get the organization's elevation settings, creating the defaults on first use
 */
export async function getElevationSettings(orgId: string): Promise<ElevationSettings> {
  const [existing] = await db
    .select()
    .from(elevationSettings)
    .where(eq(elevationSettings.orgId, orgId))
    .limit(1)
  if (existing) return existing

  await db.insert(elevationSettings).values({ orgId }).onConflictDoNothing()
  const [created] = await db
    .select()
    .from(elevationSettings)
    .where(eq(elevationSettings.orgId, orgId))
    .limit(1)
  return created
}

// ============================================================================
// EXPIRY
// ============================================================================

/**
 * Mark active grants past their expiry as expired.
 * Cheap enough to run before every list read so statuses are never stale.
 */
export async function expireDueGrants(now: Date = new Date(), orgId?: string): Promise<number> {
  const expired = await db
    .update(elevationGrants)
    .set({
      status: "expired",
      endedAt: now,
      endReason: "expired",
      // Only a password that was actually revealed needs rotating
      rotationStatus: sql`CASE WHEN ${elevationGrants.mode} = 'credentials' AND ${elevationGrants.revealCount} > 0 THEN 'pending' ELSE 'not_required' END`,
      updatedAt: now,
    })
    .where(and(
      // App installs end on install or deadline - see processInstalls
      eq(elevationGrants.mode, "credentials"),
      eq(elevationGrants.status, "active"),
      lte(elevationGrants.expiresAt, now),
      orgId ? eq(elevationGrants.orgId, orgId) : undefined
    ))
    .returning({ id: elevationGrants.id })
  return expired.length
}

// ============================================================================
// ROTATION
// ============================================================================

export interface RotationResult {
  requested: number
  failed: number
  verified: number
}

async function logRotation(orgId: string, grantId: string, action: string, description: string) {
  await createAuditLog(
    { orgId, actor: SYSTEM_ACTOR },
    { module: "security.elevation", action, entityType: "elevation_grant", entityId: grantId, description }
  )
}

/**
 * Request a password rotation for one grant and record the outcome.
 * Agent provider: flag the device to rotate + escrow its managed local admin password at the next
 * check-in (confirmed later by verifyAgentRotations). Intune provider: call Windows LAPS in Entra.
 */
export async function rotateGrantPassword(
  grant: { id: string; orgId: string; rotationAttempts: number },
  device: { intuneDeviceId: string | null; agentDeviceId: string | null },
  now: Date = new Date()
): Promise<boolean> {
  if (device.agentDeviceId) {
    await requestAdminRotation(grant.orgId, device.agentDeviceId, now)
    await db
      .update(elevationGrants)
      .set({
        rotationStatus: "requested",
        rotationRequestedAt: now,
        rotationAttempts: grant.rotationAttempts + 1,
        rotationError: null,
        updatedAt: now,
      })
      .where(eq(elevationGrants.id, grant.id))
    await logRotation(
      grant.orgId,
      grant.id,
      "rotate_requested",
      "Asked the IdaraOS Agent to rotate the local admin password"
    )
    return true
  }

  if (!device.intuneDeviceId) {
    await db
      .update(elevationGrants)
      .set({
        rotationStatus: "failed",
        rotationAttempts: MAX_ROTATION_ATTEMPTS,
        rotationError: "Device has no Intune ID - rotate the LAPS password manually",
        updatedAt: now,
      })
      .where(eq(elevationGrants.id, grant.id))
    return false
  }

  try {
    await requestLapsRotation(device.intuneDeviceId)
    await db
      .update(elevationGrants)
      .set({
        rotationStatus: "requested",
        rotationRequestedAt: now,
        rotationAttempts: grant.rotationAttempts + 1,
        rotationError: null,
        updatedAt: now,
      })
      .where(eq(elevationGrants.id, grant.id))
    await logRotation(grant.orgId, grant.id, "rotate_requested", "Requested LAPS password rotation via Intune")
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rotation request failed"
    await db
      .update(elevationGrants)
      .set({
        rotationStatus: "failed",
        rotationAttempts: grant.rotationAttempts + 1,
        rotationError: message,
        updatedAt: now,
      })
      .where(eq(elevationGrants.id, grant.id))
    await logRotation(grant.orgId, grant.id, "rotate_failed", `LAPS rotation request failed: ${message}`)
    return false
  }
}

/**
 * Request rotations for THIS agent device's ended, revealed credentials grants - called at check-in
 * so the managed admin password rotates on the next check-in after a session ends, instead of waiting
 * for the periodic sweep to flag it (which added a whole sweep interval to the window). Scoped to one
 * device; the sweep still backstops offline devices and the Intune provider. Only picks grants already
 * marked for rotation (status 'pending'/'failed'), so it never re-rotates a verified one. Returns how
 * many rotations were requested.
 */
export async function requestDueAgentRotations(agentDeviceId: string, now: Date = new Date()): Promise<number> {
  const toRotate = await db
    .select({
      id: elevationGrants.id,
      orgId: elevationGrants.orgId,
      rotationAttempts: elevationGrants.rotationAttempts,
    })
    .from(elevationGrants)
    .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
    .where(and(
      eq(elevationRequests.agentDeviceId, agentDeviceId),
      inArray(elevationGrants.rotationStatus, ["pending", "failed"]),
      lt(elevationGrants.rotationAttempts, MAX_ROTATION_ATTEMPTS)
    ))

  let requested = 0
  for (const grant of toRotate) {
    const ok = await rotateGrantPassword(grant, { intuneDeviceId: null, agentDeviceId }, now)
    if (ok) requested++
  }
  return requested
}

/**
 * Request rotations for ended grants whose password was revealed, then confirm
 * requested rotations once Entra holds a newer LAPS backup.
 */
export async function processRotations(now: Date = new Date(), limit = 25): Promise<RotationResult> {
  const result: RotationResult = { requested: 0, failed: 0, verified: 0 }

  const toRotate = await db
    .select({
      id: elevationGrants.id,
      orgId: elevationGrants.orgId,
      rotationAttempts: elevationGrants.rotationAttempts,
      intuneDeviceId: elevationRequests.intuneDeviceId,
      agentDeviceId: elevationRequests.agentDeviceId,
    })
    .from(elevationGrants)
    .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
    .where(and(
      inArray(elevationGrants.rotationStatus, ["pending", "failed"]),
      lt(elevationGrants.rotationAttempts, MAX_ROTATION_ATTEMPTS)
    ))
    .limit(limit)

  for (const grant of toRotate) {
    const ok = await rotateGrantPassword(
      grant,
      { intuneDeviceId: grant.intuneDeviceId, agentDeviceId: grant.agentDeviceId },
      now
    )
    if (ok) result.requested++
    else result.failed++
  }

  const toVerify = await db
    .select({
      id: elevationGrants.id,
      orgId: elevationGrants.orgId,
      lastRevealedAt: elevationGrants.lastRevealedAt,
      entraDeviceId: elevationRequests.entraDeviceId,
    })
    .from(elevationGrants)
    .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
    .where(eq(elevationGrants.rotationStatus, "requested"))
    .limit(limit)

  for (const grant of toVerify) {
    if (!grant.entraDeviceId) continue
    try {
      const lastBackupAt = await getLapsLastBackupAt(grant.entraDeviceId)
      if (!isRotationVerified(lastBackupAt, grant.lastRevealedAt)) continue

      await db
        .update(elevationGrants)
        .set({ rotationStatus: "verified", rotationVerifiedAt: now, updatedAt: now })
        .where(eq(elevationGrants.id, grant.id))
      await logRotation(grant.orgId, grant.id, "rotate_verified", "Confirmed a new LAPS password was backed up to Entra")
      result.verified++
    } catch (error) {
      // The device may not have checked in yet - try again on the next sweep
      console.error(`[Elevation] Could not verify rotation for grant ${grant.id}:`, error)
    }
  }

  return result
}

/**
 * Confirm agent-provider rotations. Once the IdaraOS Agent reports a freshly rotated local admin
 * password for a device, any credentials grant for that device still in the "requested" state is
 * verified. Called from the device check-in (agent devices have no Entra LAPS backup to poll).
 * Returns how many grants were confirmed.
 */
export async function verifyAgentRotations(agentDeviceId: string, now: Date = new Date()): Promise<number> {
  const verified = await db
    .update(elevationGrants)
    .set({ rotationStatus: "verified", rotationVerifiedAt: now, updatedAt: now })
    .where(and(
      eq(elevationGrants.rotationStatus, "requested"),
      lte(elevationGrants.rotationRequestedAt, now),
      inArray(
        elevationGrants.requestId,
        db
          .select({ id: elevationRequests.id })
          .from(elevationRequests)
          .where(eq(elevationRequests.agentDeviceId, agentDeviceId))
      )
    ))
    .returning({ id: elevationGrants.id, orgId: elevationGrants.orgId })

  for (const grant of verified) {
    await logRotation(
      grant.orgId,
      grant.id,
      "rotate_verified",
      "The IdaraOS Agent rotated and escrowed a new local admin password"
    )
  }
  return verified.length
}

/**
 * Full sweep - run from the scheduled job
 */
export async function runElevationSweep(now: Date = new Date()) {
  const expired = await expireDueGrants(now)
  const rotations = await processRotations(now)
  const installs = await processInstalls(now)
  const staleUpdateRuns = await expireStaleRuns(now, RUN_TIMEOUT_MINUTES)
  return { expired, ...rotations, installs, staleUpdateRuns }
}
