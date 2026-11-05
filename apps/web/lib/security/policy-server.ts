/**
 * Device groups & policies - server-side helpers
 *
 * Groups hold agent devices and/or members (users); policies attach to a group. A device is subject
 * to a group's policies if it is a direct device member, or if the member signed in to it is a user
 * member. getEffectivePolicies resolves that into the desired state the agent enforces at check-in.
 *
 * Policy types and the combine rule live in lib/security/device-policies.ts (shared with the agent).
 * Only an allowlisted policy type with bounded settings is ever stored or sent - never a command.
 */

import { and, eq, inArray, or } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  deviceBitlockerKeys,
  devicePolicyState,
  policies,
  policyGroupMembers,
  policyGroups,
  softwareUpdateDevices,
  users,
  type PolicyGroup,
  type SoftwareUpdateDevice,
} from "@/lib/db/schema"
import { decrypt, encrypt } from "@/lib/encryption"
import {
  combinePolicies,
  isValidPolicyType,
  policyName,
  sanitizePolicySettings,
  type EffectivePolicy,
  type PolicySettingValue,
} from "./device-policies"

// ============================================================================
// VIEW TYPES (shared with the API/UI)
// ============================================================================

export interface PolicyGroupMemberView {
  id: string
  kind: "device" | "user"
  refId: string
  name: string
  detail: string | null
}

export interface PolicyView {
  id: string
  type: string
  name: string
  enabled: boolean
  settings: Record<string, PolicySettingValue>
}

export interface PolicyGroupView {
  id: string
  name: string
  description: string | null
  members: PolicyGroupMemberView[]
  policies: PolicyView[]
  deviceCount: number
  userCount: number
  createdAt: Date
}

export type MutateGroupResult =
  | { ok: true; group: PolicyGroup }
  | { ok: false; status: number; error: string }

// ============================================================================
// GROUP CRUD
// ============================================================================

export async function listPolicyGroups(orgId: string): Promise<PolicyGroupView[]> {
  const groups = await db
    .select()
    .from(policyGroups)
    .where(eq(policyGroups.orgId, orgId))
    .orderBy(policyGroups.name)
  if (groups.length === 0) return []

  const groupIds = groups.map((g) => g.id)

  // Members, with the device hostname or user name resolved
  const memberRows = await db
    .select({
      id: policyGroupMembers.id,
      groupId: policyGroupMembers.groupId,
      deviceId: policyGroupMembers.deviceId,
      userId: policyGroupMembers.userId,
      deviceHostname: softwareUpdateDevices.hostname,
      deviceSerial: softwareUpdateDevices.serialNumber,
      userName: users.name,
      userEmail: users.email,
    })
    .from(policyGroupMembers)
    .leftJoin(softwareUpdateDevices, eq(policyGroupMembers.deviceId, softwareUpdateDevices.id))
    .leftJoin(users, eq(policyGroupMembers.userId, users.id))
    .where(inArray(policyGroupMembers.groupId, groupIds))

  const policyRows = await db.select().from(policies).where(inArray(policies.groupId, groupIds))

  return groups.map((group) => {
    const members: PolicyGroupMemberView[] = memberRows
      .filter((m) => m.groupId === group.id)
      .map((m) =>
        m.deviceId
          ? {
              id: m.id,
              kind: "device" as const,
              refId: m.deviceId,
              name: m.deviceHostname ?? "(removed device)",
              detail: m.deviceSerial,
            }
          : {
              id: m.id,
              kind: "user" as const,
              refId: m.userId ?? "",
              name: m.userName ?? "(removed user)",
              detail: m.userEmail ?? null,
            }
      )
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      members,
      policies: policyRows
        .filter((p) => p.groupId === group.id)
        .map((p) => ({
          id: p.id,
          type: p.type,
          name: policyName(p.type),
          enabled: p.enabled,
          settings: sanitizePolicySettings(p.type, p.settings),
        })),
      deviceCount: members.filter((m) => m.kind === "device").length,
      userCount: members.filter((m) => m.kind === "user").length,
      createdAt: group.createdAt,
    }
  })
}

export async function createPolicyGroup(
  orgId: string,
  name: string,
  description: string | null,
  createdById: string | null
): Promise<MutateGroupResult> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, status: 400, error: "A group name is required" }

  const [existing] = await db
    .select({ id: policyGroups.id })
    .from(policyGroups)
    .where(and(eq(policyGroups.orgId, orgId), eq(policyGroups.name, trimmed)))
    .limit(1)
  if (existing) return { ok: false, status: 409, error: "A group with that name already exists" }

  const [group] = await db
    .insert(policyGroups)
    .values({ orgId, name: trimmed, description: description?.trim() || null, createdById })
    .returning()
  return { ok: true, group }
}

async function loadGroup(orgId: string, id: string): Promise<PolicyGroup | null> {
  const [group] = await db
    .select()
    .from(policyGroups)
    .where(and(eq(policyGroups.id, id), eq(policyGroups.orgId, orgId)))
    .limit(1)
  return group ?? null
}

export async function updatePolicyGroup(
  orgId: string,
  id: string,
  updates: { name?: string; description?: string | null }
): Promise<MutateGroupResult> {
  const group = await loadGroup(orgId, id)
  if (!group) return { ok: false, status: 404, error: "Group not found" }

  const set: { name?: string; description?: string | null; updatedAt: Date } = { updatedAt: new Date() }
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim()
    if (!trimmed) return { ok: false, status: 400, error: "A group name is required" }
    const [clash] = await db
      .select({ id: policyGroups.id })
      .from(policyGroups)
      .where(and(eq(policyGroups.orgId, orgId), eq(policyGroups.name, trimmed)))
      .limit(1)
    if (clash && clash.id !== id) return { ok: false, status: 409, error: "A group with that name already exists" }
    set.name = trimmed
  }
  if (updates.description !== undefined) set.description = updates.description?.trim() || null

  const [updated] = await db.update(policyGroups).set(set).where(eq(policyGroups.id, id)).returning()
  return { ok: true, group: updated }
}

export async function deletePolicyGroup(orgId: string, id: string): Promise<MutateGroupResult> {
  const group = await loadGroup(orgId, id)
  if (!group) return { ok: false, status: 404, error: "Group not found" }
  await db.delete(policyGroups).where(eq(policyGroups.id, id))
  return { ok: true, group }
}

// ============================================================================
// MEMBERS
// ============================================================================

export type MemberResult =
  | { ok: true; memberName: string }
  | { ok: false; status: number; error: string }

export async function addGroupMember(
  orgId: string,
  groupId: string,
  member: { deviceId?: string | null; userId?: string | null }
): Promise<MemberResult> {
  const group = await loadGroup(orgId, groupId)
  if (!group) return { ok: false, status: 404, error: "Group not found" }

  const deviceId = member.deviceId ?? null
  const userId = member.userId ?? null
  if ((deviceId && userId) || (!deviceId && !userId)) {
    return { ok: false, status: 400, error: "Add exactly one device or one user" }
  }

  if (deviceId) {
    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, deviceId), eq(softwareUpdateDevices.orgId, orgId)))
      .limit(1)
    if (!device) return { ok: false, status: 404, error: "Device not found" }
    // Policies are enforced by the IdaraOS Agent; Intune devices (with an Entra ID) can't apply them
    if (device.entraDeviceId || !device.machineId) {
      return { ok: false, status: 409, error: "Only IdaraOS Agent devices can be added" }
    }
    await db
      .insert(policyGroupMembers)
      .values({ orgId, groupId, deviceId })
      .onConflictDoNothing({ target: [policyGroupMembers.groupId, policyGroupMembers.deviceId] })
    return { ok: true, memberName: device.hostname }
  }

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.id, userId!), eq(users.orgId, orgId)))
    .limit(1)
  if (!user) return { ok: false, status: 404, error: "User not found" }
  await db
    .insert(policyGroupMembers)
    .values({ orgId, groupId, userId: user.id })
    .onConflictDoNothing({ target: [policyGroupMembers.groupId, policyGroupMembers.userId] })
  return { ok: true, memberName: user.name }
}

export async function removeGroupMember(orgId: string, groupId: string, memberId: string): Promise<MemberResult> {
  const [deleted] = await db
    .delete(policyGroupMembers)
    .where(
      and(
        eq(policyGroupMembers.id, memberId),
        eq(policyGroupMembers.groupId, groupId),
        eq(policyGroupMembers.orgId, orgId)
      )
    )
    .returning({ id: policyGroupMembers.id })
  if (!deleted) return { ok: false, status: 404, error: "Member not found" }
  return { ok: true, memberName: "" }
}

// ============================================================================
// POLICIES
// ============================================================================

export type SetPolicyResult =
  | { ok: true; policyName: string; enabled: boolean }
  | { ok: false; status: number; error: string }

export async function setGroupPolicy(
  orgId: string,
  groupId: string,
  type: string,
  enabled: boolean,
  settings: Record<string, unknown> | null,
  createdById: string | null
): Promise<SetPolicyResult> {
  const group = await loadGroup(orgId, groupId)
  if (!group) return { ok: false, status: 404, error: "Group not found" }
  if (!isValidPolicyType(type)) return { ok: false, status: 400, error: "Unknown policy" }

  const clean = sanitizePolicySettings(type, settings)
  await db
    .insert(policies)
    .values({ orgId, groupId, type, enabled, settings: clean, createdById })
    .onConflictDoUpdate({
      target: [policies.groupId, policies.type],
      set: { enabled, settings: clean, updatedAt: new Date() },
    })
  return { ok: true, policyName: policyName(type), enabled }
}

// ============================================================================
// PICKER OPTIONS (for adding members in the portal)
// ============================================================================

export interface PolicyPickerOptions {
  devices: Array<{ id: string; hostname: string; detail: string | null }>
  users: Array<{ id: string; name: string; email: string }>
}

/** Agent devices and users that can be added to a group */
export async function getPolicyPickerOptions(orgId: string): Promise<PolicyPickerOptions> {
  const deviceRows = await db
    .select({
      id: softwareUpdateDevices.id,
      hostname: softwareUpdateDevices.hostname,
      serialNumber: softwareUpdateDevices.serialNumber,
      entraDeviceId: softwareUpdateDevices.entraDeviceId,
      machineId: softwareUpdateDevices.machineId,
      status: softwareUpdateDevices.status,
    })
    .from(softwareUpdateDevices)
    .where(eq(softwareUpdateDevices.orgId, orgId))
    .orderBy(softwareUpdateDevices.hostname)

  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(users.name)

  return {
    // Policies are enforced only by IdaraOS Agent devices (have a machineId, no Entra device ID)
    devices: deviceRows
      .filter((d) => d.status === "active" && d.machineId && !d.entraDeviceId)
      .map((d) => ({ id: d.id, hostname: d.hostname, detail: d.serialNumber })),
    users: userRows.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  }
}

// ============================================================================
// EFFECTIVE STATE (delivered to the agent) & REPORTED STATE
// ============================================================================

/**
 * The effective desired policy state for a device: the union of enabled policies across every group
 * the device belongs to (directly, or via the member signed in to it), combined with the strictest
 * setting winning. This is exactly what the agent is told to enforce.
 */
export async function getEffectivePolicies(device: SoftwareUpdateDevice): Promise<EffectivePolicy[]> {
  const reach = device.userId
    ? or(eq(policyGroupMembers.deviceId, device.id), eq(policyGroupMembers.userId, device.userId))
    : eq(policyGroupMembers.deviceId, device.id)

  const groupRows = await db
    .select({ groupId: policyGroupMembers.groupId })
    .from(policyGroupMembers)
    .where(and(eq(policyGroupMembers.orgId, device.orgId), reach))
  const groupIds = [...new Set(groupRows.map((r) => r.groupId))]
  if (groupIds.length === 0) return []

  const policyRows = await db
    .select()
    .from(policies)
    .where(and(eq(policies.orgId, device.orgId), inArray(policies.groupId, groupIds)))
  return combinePolicies(policyRows.map((p) => ({ type: p.type, enabled: p.enabled, settings: p.settings })))
}

export interface PolicyApplyResult {
  type: string
  ok: boolean
  message?: string | null
  state?: Record<string, unknown> | null
}

/** Record what the agent reported applying, per device and policy type */
export async function recordDevicePolicyState(
  device: SoftwareUpdateDevice,
  results: PolicyApplyResult[],
  now: Date = new Date()
): Promise<void> {
  for (const result of results) {
    if (!isValidPolicyType(result.type)) continue
    await db
      .insert(devicePolicyState)
      .values({
        orgId: device.orgId,
        deviceId: device.id,
        type: result.type,
        ok: result.ok,
        message: result.message?.slice(0, 2000) ?? null,
        state: result.state ?? {},
        reportedAt: now,
      })
      .onConflictDoUpdate({
        target: [devicePolicyState.deviceId, devicePolicyState.type],
        set: {
          ok: result.ok,
          message: result.message?.slice(0, 2000) ?? null,
          state: result.state ?? {},
          reportedAt: now,
        },
      })
  }
}

export interface DevicePolicyStateView {
  type: string
  name: string
  ok: boolean
  message: string | null
  reportedAt: Date
}

/** Last applied policy state for a device, for the portal */
export async function listDevicePolicyState(device: SoftwareUpdateDevice): Promise<DevicePolicyStateView[]> {
  const rows = await db
    .select()
    .from(devicePolicyState)
    .where(eq(devicePolicyState.deviceId, device.id))
  return rows.map((r) => ({
    type: r.type,
    name: policyName(r.type),
    ok: r.ok,
    message: r.message,
    reportedAt: r.reportedAt,
  }))
}

// ============================================================================
// BITLOCKER RECOVERY KEY ESCROW
// ============================================================================

/** One BitLocker volume as the agent reports it. recoveryKey is the secret, encrypted on arrival. */
export interface ReportedBitlockerVolume {
  volume: string
  recoveryKeyId?: string | null
  recoveryKey: string
  encryptionMethod?: string | null
  protectionOn?: boolean
  encryptionPercentage?: number | null
}

/**
 * Store the recovery keys the agent escrowed for a device. The recovery password is encrypted at
 * rest (lib/encryption.ts) before it touches the database and is never kept in plaintext. Called
 * from the device-authenticated check-in; one row per (device, volume), upserted.
 */
export async function recordBitlockerKeys(
  device: SoftwareUpdateDevice,
  volumes: ReportedBitlockerVolume[],
  now: Date = new Date()
): Promise<void> {
  for (const v of volumes) {
    const volume = v.volume?.trim()
    const recoveryKey = v.recoveryKey?.trim()
    // A row only makes sense with both a volume and a key to escrow
    if (!volume || !recoveryKey) continue
    const percentage =
      typeof v.encryptionPercentage === "number" && Number.isFinite(v.encryptionPercentage)
        ? Math.max(0, Math.min(100, Math.round(v.encryptionPercentage)))
        : null
    await db
      .insert(deviceBitlockerKeys)
      .values({
        orgId: device.orgId,
        deviceId: device.id,
        volume,
        recoveryKeyId: v.recoveryKeyId?.trim() || null,
        recoveryKeyEncrypted: encrypt(recoveryKey),
        encryptionMethod: v.encryptionMethod?.trim() || null,
        protectionOn: v.protectionOn ?? false,
        encryptionPercentage: percentage,
        reportedAt: now,
      })
      .onConflictDoUpdate({
        target: [deviceBitlockerKeys.deviceId, deviceBitlockerKeys.volume],
        set: {
          recoveryKeyId: v.recoveryKeyId?.trim() || null,
          recoveryKeyEncrypted: encrypt(recoveryKey),
          encryptionMethod: v.encryptionMethod?.trim() || null,
          protectionOn: v.protectionOn ?? false,
          encryptionPercentage: percentage,
          reportedAt: now,
        },
      })
  }
}

/** A BitLocker volume for the portal, WITHOUT the recovery key (revealed only via its own endpoint) */
export interface BitlockerKeyView {
  id: string
  volume: string
  recoveryKeyId: string | null
  encryptionMethod: string | null
  protectionOn: boolean
  encryptionPercentage: number | null
  reportedAt: Date
}

/** Escrowed BitLocker volumes for a device (no secrets) */
export async function listBitlockerKeys(device: SoftwareUpdateDevice): Promise<BitlockerKeyView[]> {
  const rows = await db
    .select()
    .from(deviceBitlockerKeys)
    .where(eq(deviceBitlockerKeys.deviceId, device.id))
    .orderBy(deviceBitlockerKeys.volume)
  return rows.map((r) => ({
    id: r.id,
    volume: r.volume,
    recoveryKeyId: r.recoveryKeyId,
    encryptionMethod: r.encryptionMethod,
    protectionOn: r.protectionOn,
    encryptionPercentage: r.encryptionPercentage,
    reportedAt: r.reportedAt,
  }))
}

/**
 * Decrypt and return one escrowed recovery key. The caller MUST audit every call - this hands back
 * a secret. Returns the volume for the audit record, or null if the key isn't found for this device.
 */
export async function revealBitlockerKey(
  device: SoftwareUpdateDevice,
  keyId: string
): Promise<{ volume: string; recoveryKey: string } | null> {
  const [row] = await db
    .select()
    .from(deviceBitlockerKeys)
    .where(and(eq(deviceBitlockerKeys.id, keyId), eq(deviceBitlockerKeys.deviceId, device.id)))
    .limit(1)
  if (!row) return null
  return { volume: row.volume, recoveryKey: decrypt(row.recoveryKeyEncrypted) }
}
