/**
 * Vault Security Audit + password policy (server-side, Phase 2)
 *
 * The org policy (security_vault_settings) is enforced at save time and reported in a Security Audit.
 * Reuse/weak detection never decrypts: each item carries a keyed HMAC fingerprint and a 0-4 strength
 * score (set at save), and the audit aggregates those.
 */

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, vaultItems, vaultSettings, type VaultEnforcement, type VaultSettings } from "@/lib/db/schema"
import { passwordFingerprint } from "@/lib/vault/crypto-server"
import { estimateStrength } from "@/lib/vault/strength"

/** Strength score below this counts as "weak" in the audit (0 very weak … 4 very strong). */
export const WEAK_THRESHOLD = 2

// ============================================================================
// SETTINGS
// ============================================================================

export async function getVaultSettings(orgId: string): Promise<VaultSettings> {
  const [existing] = await db.select().from(vaultSettings).where(eq(vaultSettings.orgId, orgId)).limit(1)
  if (existing) return existing
  await db.insert(vaultSettings).values({ orgId }).onConflictDoNothing()
  const [created] = await db.select().from(vaultSettings).where(eq(vaultSettings.orgId, orgId)).limit(1)
  return created
}

export interface VaultSettingsInput {
  minLength?: number
  requireUpper?: boolean
  requireLower?: boolean
  requireDigit?: boolean
  requireSymbol?: boolean
  noReuse?: boolean
  maxAgeDays?: number
  enforcement?: VaultEnforcement
}

export async function updateVaultSettings(
  orgId: string,
  input: VaultSettingsInput,
  updatedById: string
): Promise<VaultSettings> {
  await getVaultSettings(orgId) // ensure the row exists
  const [row] = await db
    .update(vaultSettings)
    .set({ ...input, updatedById, updatedAt: new Date() })
    .where(eq(vaultSettings.orgId, orgId))
    .returning()
  return row
}

// ============================================================================
// SAVE-TIME DERIVED VALUES + ENFORCEMENT
// ============================================================================

/** Non-secret values stored on an item so the audit never decrypts. */
export function derivePasswordFields(password: string | null): { passwordFingerprint: string | null; passwordStrength: number | null } {
  if (!password) return { passwordFingerprint: null, passwordStrength: null }
  return { passwordFingerprint: passwordFingerprint(password), passwordStrength: estimateStrength(password).score }
}

export class VaultPolicyError extends Error {
  constructor(public violations: string[]) {
    super(`Password doesn't meet the vault policy: needs ${violations.join(", ")}`)
    this.name = "VaultPolicyError"
  }
}

/** Returns the list of unmet requirements for a password (empty = compliant). */
export function evaluatePassword(password: string, settings: VaultSettings, otherFingerprints: Set<string>): string[] {
  const v: string[] = []
  if (password.length < settings.minLength) v.push(`at least ${settings.minLength} characters`)
  if (settings.requireUpper && !/[A-Z]/.test(password)) v.push("an uppercase letter")
  if (settings.requireLower && !/[a-z]/.test(password)) v.push("a lowercase letter")
  if (settings.requireDigit && !/[0-9]/.test(password)) v.push("a number")
  if (settings.requireSymbol && !/[^A-Za-z0-9]/.test(password)) v.push("a symbol")
  if (settings.noReuse && otherFingerprints.has(passwordFingerprint(password))) {
    v.push("a password you aren't already using elsewhere in your vault")
  }
  return v
}

/**
 * Enforce the policy for a password a user is about to save. On enforcement "block" with violations it
 * throws VaultPolicyError; otherwise it's a no-op. `excludeItemId` skips the item being edited so it
 * isn't counted as reusing itself.
 */
export async function enforceVaultPolicy(
  orgId: string,
  userId: string,
  password: string,
  excludeItemId: string | null
): Promise<void> {
  const settings = await getVaultSettings(orgId)
  if (settings.enforcement !== "block") return

  let otherFingerprints = new Set<string>()
  if (settings.noReuse) {
    const rows = await db
      .select({ id: vaultItems.id, fp: vaultItems.passwordFingerprint })
      .from(vaultItems)
      .where(and(eq(vaultItems.orgId, orgId), eq(vaultItems.userId, userId)))
    otherFingerprints = new Set(rows.filter((r) => r.fp && r.id !== excludeItemId).map((r) => r.fp as string))
  }

  const violations = evaluatePassword(password, settings, otherFingerprints)
  if (violations.length > 0) throw new VaultPolicyError(violations)
}

// ============================================================================
// SECURITY AUDIT (compliance aggregation)
// ============================================================================

export interface VaultComplianceCounts {
  total: number
  weak: number
  reused: number
  old: number
}

export interface VaultComplianceRow extends VaultComplianceCounts {
  userId: string
  name: string | null
  email: string | null
}

export interface VaultComplianceSummary {
  rows: VaultComplianceRow[]
  totals: VaultComplianceCounts & { users: number }
  maxAgeDays: number
}

interface AuditItemRow {
  userId: string
  passwordFingerprint: string | null
  passwordStrength: number | null
  lastPasswordChangeAt: Date | null
}

function aggregate(rows: AuditItemRow[], maxAgeDays: number): Map<string, VaultComplianceCounts> {
  const byUser = new Map<string, AuditItemRow[]>()
  for (const r of rows) {
    if (!r.passwordFingerprint && r.passwordStrength == null) continue // no password on this item
    const arr = byUser.get(r.userId) ?? []
    arr.push(r)
    byUser.set(r.userId, arr)
  }
  const now = Date.now()
  const ageMs = maxAgeDays > 0 ? maxAgeDays * 86_400_000 : 0
  const out = new Map<string, VaultComplianceCounts>()
  for (const [userId, items] of byUser) {
    const fpCount = new Map<string, number>()
    for (const it of items) if (it.passwordFingerprint) fpCount.set(it.passwordFingerprint, (fpCount.get(it.passwordFingerprint) ?? 0) + 1)
    let weak = 0
    let reused = 0
    let old = 0
    for (const it of items) {
      if (it.passwordStrength != null && it.passwordStrength < WEAK_THRESHOLD) weak++
      if (it.passwordFingerprint && (fpCount.get(it.passwordFingerprint) ?? 0) > 1) reused++
      if (ageMs > 0 && it.lastPasswordChangeAt && now - it.lastPasswordChangeAt.getTime() > ageMs) old++
    }
    out.set(userId, { total: items.length, weak, reused, old })
  }
  return out
}

/** Org-wide Security Audit: per-user weak/reused/old counts. */
export async function getVaultCompliance(orgId: string): Promise<VaultComplianceSummary> {
  const settings = await getVaultSettings(orgId)
  const rows = await db
    .select({
      userId: vaultItems.userId,
      passwordFingerprint: vaultItems.passwordFingerprint,
      passwordStrength: vaultItems.passwordStrength,
      lastPasswordChangeAt: vaultItems.lastPasswordChangeAt,
    })
    .from(vaultItems)
    .where(eq(vaultItems.orgId, orgId))

  const perUser = aggregate(rows, settings.maxAgeDays)
  const userIds = [...perUser.keys()]
  const people = userIds.length
    ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.orgId, orgId))
    : []
  const nameById = new Map(people.map((p) => [p.id, p]))

  const complianceRows: VaultComplianceRow[] = userIds.map((userId) => {
    const c = perUser.get(userId)!
    const p = nameById.get(userId)
    return { userId, name: p?.name ?? null, email: p?.email ?? null, ...c }
  })
  complianceRows.sort((a, b) => b.weak + b.reused + b.old - (a.weak + a.reused + a.old))

  const totals = complianceRows.reduce(
    (acc, r) => ({ total: acc.total + r.total, weak: acc.weak + r.weak, reused: acc.reused + r.reused, old: acc.old + r.old, users: acc.users }),
    { total: 0, weak: 0, reused: 0, old: 0, users: complianceRows.length }
  )
  return { rows: complianceRows, totals, maxAgeDays: settings.maxAgeDays }
}

/** A single user's own vault health (for their vault page). */
export async function getUserVaultHealth(orgId: string, userId: string): Promise<VaultComplianceCounts & { maxAgeDays: number }> {
  const settings = await getVaultSettings(orgId)
  const rows = await db
    .select({
      userId: vaultItems.userId,
      passwordFingerprint: vaultItems.passwordFingerprint,
      passwordStrength: vaultItems.passwordStrength,
      lastPasswordChangeAt: vaultItems.lastPasswordChangeAt,
    })
    .from(vaultItems)
    .where(and(eq(vaultItems.orgId, orgId), eq(vaultItems.userId, userId)))
  const counts = aggregate(rows, settings.maxAgeDays).get(userId) ?? { total: 0, weak: 0, reused: 0, old: 0 }
  return { ...counts, maxAgeDays: settings.maxAgeDays }
}
