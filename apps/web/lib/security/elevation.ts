/**
 * Security Endpoint Elevation - shared helpers
 * Pure functions used by both API routes and UI (no database or network access here)
 */

import type {
  ElevationGrantMode,
  ElevationGrantStatus,
  ElevationRequestStatus,
  ElevationRotationStatus,
} from "@/lib/db/schema/security-elevation"

export const DEFAULT_DURATION_OPTIONS = [15, 30, 60, 120, 240]

/** Longest grant any organization can configure (24 hours) */
export const MAX_GRANT_MINUTES = 24 * 60

/** The sweep stops retrying a failed rotation after this many attempts */
export const MAX_ROTATION_ATTEMPTS = 5

// ============================================================================
// LABELS
// ============================================================================

export const elevationRequestStatusLabels: Record<ElevationRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
}

export const elevationRequestStatusClassNames: Record<ElevationRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

export const elevationGrantStatusLabels: Record<ElevationGrantStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
}

export const elevationGrantModeLabels: Record<ElevationGrantMode, string> = {
  credentials: "Reveal LAPS password",
  elevate_app: "Elevate one app",
}

export const elevationRotationStatusLabels: Record<ElevationRotationStatus, string> = {
  not_required: "Not required",
  pending: "Rotation pending",
  requested: "Rotation requested",
  verified: "Rotated",
  failed: "Rotation failed",
}

export const elevationRotationStatusClassNames: Record<ElevationRotationStatus, string> = {
  not_required: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  requested: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  verified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

/**
 * Format a duration in minutes, e.g. 30 -> "30 min", 90 -> "1 h 30 min"
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface DurationSettings {
  durationOptions: number[]
  maxMinutes: number
}

/**
 * Normalize duration options: whole minutes, unique, sorted, within the cap
 */
export function normalizeDurationOptions(options: number[], maxMinutes: number): number[] {
  return [...new Set(options.map((m) => Math.round(m)))]
    .filter((m) => m >= 1 && m <= Math.min(maxMinutes, MAX_GRANT_MINUTES))
    .sort((a, b) => a - b)
}

/**
 * Durations the requester can actually pick
 */
export function allowedDurations(settings: DurationSettings): number[] {
  const options = normalizeDurationOptions(settings.durationOptions, settings.maxMinutes)
  return options.length > 0 ? options : [Math.min(settings.maxMinutes, DEFAULT_DURATION_OPTIONS[0])]
}

// ============================================================================
// DECISIONS
// ============================================================================

export type CheckResult = { ok: true } | { ok: false; status: number; error: string }

const fail = (status: number, error: string): CheckResult => ({ ok: false, status, error })
const OK: CheckResult = { ok: true }

export function checkRequestedMinutes(minutes: number, settings: DurationSettings): CheckResult {
  if (!allowedDurations(settings).includes(minutes)) {
    return fail(400, "Choose one of the allowed durations")
  }
  return OK
}

export interface ApprovalInput {
  request: { status: ElevationRequestStatus; requesterId: string; requestedMinutes: number }
  deciderId: string
  mode: ElevationGrantMode
  minutes: number
  settings: { credentialModeEnabled: boolean; maxMinutes: number }
  /** Decider holds security.elevation-credentials:edit */
  canUseCredentials: boolean
}

/**
 * Rules for approving a request (on top of security.elevation:edit)
 */
export function checkApproval(input: ApprovalInput): CheckResult {
  const decide = checkCanDecide(input.request, input.deciderId)
  if (!decide.ok) return decide

  if (input.mode === "elevate_app") {
    return fail(400, "Elevate-app mode needs the endpoint agent, which is not available yet")
  }
  if (input.mode === "credentials") {
    if (!input.settings.credentialModeEnabled) {
      return fail(400, "Credential mode is turned off in admin access settings")
    }
    if (!input.canUseCredentials) {
      return fail(403, "You don't have permission to approve with credentials")
    }
  }
  if (!Number.isInteger(input.minutes) || input.minutes < 1) {
    return fail(400, "Duration must be at least 1 minute")
  }
  if (input.minutes > input.request.requestedMinutes) {
    return fail(400, "You can shorten the requested duration, not extend it")
  }
  if (input.minutes > input.settings.maxMinutes) {
    return fail(400, `Duration can't exceed ${formatMinutes(input.settings.maxMinutes)}`)
  }
  return OK
}

/**
 * Rules shared by approve and deny
 */
export function checkCanDecide(
  request: { status: ElevationRequestStatus; requesterId: string },
  deciderId: string
): CheckResult {
  if (request.status !== "pending") {
    return fail(409, "This request has already been decided")
  }
  if (request.requesterId === deciderId) {
    return fail(403, "You can't decide your own request")
  }
  return OK
}

export function computeGrantWindow(now: Date, minutes: number): { startsAt: Date; expiresAt: Date } {
  return { startsAt: now, expiresAt: new Date(now.getTime() + minutes * 60_000) }
}

// ============================================================================
// GRANTS
// ============================================================================

export interface GrantState {
  userId: string
  mode: ElevationGrantMode
  status: ElevationGrantStatus
  expiresAt: Date
  revealCount: number
}

export function isGrantLive(grant: Pick<GrantState, "status" | "expiresAt">, now: Date): boolean {
  return grant.status === "active" && grant.expiresAt.getTime() > now.getTime()
}

/**
 * Rules for revealing the LAPS password of a grant
 */
export function checkReveal(grant: GrantState, userId: string, now: Date, maxReveals: number): CheckResult {
  if (grant.userId !== userId) return fail(404, "Grant not found")
  if (grant.mode !== "credentials") return fail(400, "This grant doesn't include credentials")
  if (!isGrantLive(grant, now)) return fail(410, "This grant has ended")
  if (grant.revealCount >= maxReveals) return fail(429, "You've reached the reveal limit for this grant")
  return OK
}

/**
 * Reveal needs a Microsoft sign-in newer than the configured window
 * @param issuedAtSeconds - session JWT `iat`
 */
export function needsRecentAuth(
  settings: { requireRecentAuth: boolean; recentAuthMinutes: number },
  issuedAtSeconds: number | undefined,
  now: Date
): boolean {
  if (!settings.requireRecentAuth) return false
  if (!issuedAtSeconds) return true
  return now.getTime() - issuedAtSeconds * 1000 > settings.recentAuthMinutes * 60_000
}

/**
 * Rotation status once a grant ends: only a revealed password needs rotating
 */
export function rotationStatusAfterEnd(grant: Pick<GrantState, "mode" | "revealCount">): ElevationRotationStatus {
  return grant.mode === "credentials" && grant.revealCount > 0 ? "pending" : "not_required"
}

/**
 * A rotation is verified once Entra holds a LAPS backup newer than the last reveal
 */
export function isRotationVerified(lastBackupAt: Date | null, lastRevealedAt: Date | null): boolean {
  if (!lastBackupAt || !lastRevealedAt) return false
  return lastBackupAt.getTime() > lastRevealedAt.getTime()
}
