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
 * Request a LAPS rotation for one grant and record the outcome
 */
export async function rotateGrantPassword(
  grant: { id: string; orgId: string; rotationAttempts: number },
  intuneDeviceId: string | null,
  now: Date = new Date()
): Promise<boolean> {
  if (!intuneDeviceId) {
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
    await requestLapsRotation(intuneDeviceId)
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
    })
    .from(elevationGrants)
    .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
    .where(and(
      inArray(elevationGrants.rotationStatus, ["pending", "failed"]),
      lt(elevationGrants.rotationAttempts, MAX_ROTATION_ATTEMPTS)
    ))
    .limit(limit)

  for (const grant of toRotate) {
    const ok = await rotateGrantPassword(grant, grant.intuneDeviceId, now)
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
 * Full sweep - run from the scheduled job
 */
export async function runElevationSweep(now: Date = new Date()) {
  const expired = await expireDueGrants(now)
  const rotations = await processRotations(now)
  return { expired, ...rotations }
}
