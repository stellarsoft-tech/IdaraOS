/**
 * Agent-managed local admin credentials - server-side helpers
 *
 * For the IdaraOS Agent provider, the agent manages a pre-existing local admin account's password
 * (default "StellarAdmin"): it generates a unique password on the device, sets it, and escrows it
 * here. We store the password encrypted at rest (lib/encryption.ts) and hand it back only through an
 * active credentials grant reveal, or a break-glass admin reveal - both audited by the caller.
 *
 * This is the agent-provider counterpart to Windows LAPS in Entra (lib/security/elevation-laps.ts),
 * which the Intune provider uses instead. See docs/modules/security/elevation-architecture.md.
 */

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { deviceAdminCredentials, type SoftwareUpdateDevice } from "@/lib/db/schema"
import { decrypt, encrypt } from "@/lib/encryption"
import { shouldRotateManagedAdmin } from "./elevation"

const DEFAULT_ACCOUNT = "StellarAdmin"

/** One admin-credential report from the agent at check-in. password is the secret (encrypted on arrival). */
export interface ReportedAdminCredential {
  account?: string | null
  password?: string | null
  rotatedAt?: string | null
  // "ok" = rotated and escrowed; "missing" = the account doesn't exist; "error" = couldn't set it
  status: "ok" | "missing" | "error"
  error?: string | null
}

/**
 * Store the admin password the agent escrowed for a device. On a successful rotation the password is
 * encrypted before it touches the database and the pending rotation flag is cleared. A "missing" or
 * "error" report records the status without overwriting any password we already hold. One row per
 * device, upserted. Returns the rotation timestamp when a new password was stored.
 */
export async function recordAdminCredential(
  device: SoftwareUpdateDevice,
  report: ReportedAdminCredential,
  now: Date = new Date()
): Promise<{ rotatedAt: Date | null }> {
  const account = report.account?.trim() || DEFAULT_ACCOUNT

  if (report.status === "ok" && report.password?.trim()) {
    const encrypted = encrypt(report.password.trim())
    const reported = report.rotatedAt ? new Date(report.rotatedAt) : now
    const rotatedAt = Number.isNaN(reported.getTime()) ? now : reported
    await db
      .insert(deviceAdminCredentials)
      .values({
        orgId: device.orgId,
        deviceId: device.id,
        accountName: account,
        passwordEncrypted: encrypted,
        lastStatus: "ok",
        lastError: null,
        rotatedAt,
        rotateRequestedAt: null,
        reportedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [deviceAdminCredentials.deviceId],
        set: {
          accountName: account,
          passwordEncrypted: encrypted,
          lastStatus: "ok",
          lastError: null,
          rotatedAt,
          rotateRequestedAt: null,
          reportedAt: now,
          updatedAt: now,
        },
      })
    return { rotatedAt }
  }

  // "missing" / "error": keep any password and pending rotation; just record what happened.
  const status = report.status === "missing" ? "missing" : "error"
  const lastError = report.error?.slice(0, 2000) ?? null
  await db
    .insert(deviceAdminCredentials)
    .values({
      orgId: device.orgId,
      deviceId: device.id,
      accountName: account,
      lastStatus: status,
      lastError,
      reportedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [deviceAdminCredentials.deviceId],
      set: { accountName: account, lastStatus: status, lastError, reportedAt: now, updatedAt: now },
    })
  return { rotatedAt: null }
}

/**
 * Decrypt and return the current escrowed admin password for a device, or null if none is held.
 * The caller MUST audit every call - this hands back a secret.
 */
export async function revealAdminCredential(
  orgId: string,
  deviceId: string
): Promise<{ accountName: string; password: string } | null> {
  const [row] = await db
    .select()
    .from(deviceAdminCredentials)
    .where(and(eq(deviceAdminCredentials.deviceId, deviceId), eq(deviceAdminCredentials.orgId, orgId)))
    .limit(1)
  if (!row || !row.passwordEncrypted) return null
  return { accountName: row.accountName, password: decrypt(row.passwordEncrypted) }
}

/**
 * Flag a device to rotate its managed admin password at its next check-in. Creates the escrow row if
 * the device has never reported one yet (adoption). Account name defaults until the agent reports.
 */
export async function requestAdminRotation(orgId: string, deviceId: string, now: Date = new Date()): Promise<void> {
  await db
    .insert(deviceAdminCredentials)
    .values({ orgId, deviceId, rotateRequestedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [deviceAdminCredentials.deviceId],
      set: { rotateRequestedAt: now, updatedAt: now },
    })
}

/** What the check-in tells the agent to do with the managed admin account */
export interface AdminCredentialSignal {
  manage: boolean
  account: string
  rotate: boolean
}

/**
 * Decide what to tell the agent at check-in: whether to manage the admin account, which account, and
 * whether to rotate now. Rotate when a rotation was requested, or on adoption (nothing escrowed yet).
 */
export async function getAdminCredentialSignal(
  device: SoftwareUpdateDevice,
  settings: { manageAgentAdmin: boolean; agentAdminAccount: string }
): Promise<AdminCredentialSignal> {
  const account = settings.agentAdminAccount || DEFAULT_ACCOUNT
  if (!settings.manageAgentAdmin) {
    return { manage: false, account, rotate: false }
  }
  const [row] = await db
    .select({
      passwordEncrypted: deviceAdminCredentials.passwordEncrypted,
      rotateRequestedAt: deviceAdminCredentials.rotateRequestedAt,
    })
    .from(deviceAdminCredentials)
    .where(eq(deviceAdminCredentials.deviceId, device.id))
    .limit(1)
  const escrow = row ? { hasPassword: !!row.passwordEncrypted, rotateRequested: row.rotateRequestedAt != null } : null
  return { manage: true, account, rotate: shouldRotateManagedAdmin(true, escrow) }
}

/** The escrow status for a device, WITHOUT the password (revealed only via its own endpoint) */
export interface AdminCredentialView {
  accountName: string
  hasPassword: boolean
  lastStatus: string | null
  lastError: string | null
  rotatedAt: Date | null
  reportedAt: Date | null
  rotateRequestedAt: Date | null
}

export async function getAdminCredentialView(device: SoftwareUpdateDevice): Promise<AdminCredentialView | null> {
  const [row] = await db
    .select()
    .from(deviceAdminCredentials)
    .where(eq(deviceAdminCredentials.deviceId, device.id))
    .limit(1)
  if (!row) return null
  return {
    accountName: row.accountName,
    hasPassword: !!row.passwordEncrypted,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    rotatedAt: row.rotatedAt,
    reportedAt: row.reportedAt,
    rotateRequestedAt: row.rotateRequestedAt,
  }
}
