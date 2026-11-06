/**
 * Vault sharing - server-side (Phase 3)
 *
 * Reusable groups (admin-managed) + shares of an item or folder to a member or a group. Because
 * decryption is server-side, a share is just an ACL - no key wrapping. Shares can be time-boxed
 * (expiresAt) and revoked (status). Access resolution is used by vault-server to gate reads/updates.
 */

import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  users,
  vaultFolders,
  vaultGroupMembers,
  vaultGroups,
  vaultItems,
  vaultShares,
  type VaultSharePermission,
} from "@/lib/db/schema"

export type VaultAccessLevel = "owner" | "edit" | "view"

// ============================================================================
// GROUPS (admin)
// ============================================================================

export interface VaultGroupView {
  id: string
  name: string
  memberCount: number
  createdAt: string
}

export async function listGroups(orgId: string): Promise<VaultGroupView[]> {
  const groups = await db.select().from(vaultGroups).where(eq(vaultGroups.orgId, orgId)).orderBy(vaultGroups.name)
  const counts = await db
    .select({ groupId: vaultGroupMembers.groupId, c: sql<number>`count(*)::int` })
    .from(vaultGroupMembers)
    .where(eq(vaultGroupMembers.orgId, orgId))
    .groupBy(vaultGroupMembers.groupId)
  const countMap = new Map(counts.map((c) => [c.groupId, Number(c.c)]))
  return groups.map((g) => ({ id: g.id, name: g.name, memberCount: countMap.get(g.id) ?? 0, createdAt: g.createdAt.toISOString() }))
}

export async function createGroup(orgId: string, name: string, createdById: string): Promise<VaultGroupView> {
  const now = new Date()
  const [row] = await db
    .insert(vaultGroups)
    .values({ orgId, name: name.trim(), createdById, createdAt: now, updatedAt: now })
    .returning()
  return { id: row.id, name: row.name, memberCount: 0, createdAt: row.createdAt.toISOString() }
}

export async function renameGroup(orgId: string, groupId: string, name: string): Promise<boolean> {
  const rows = await db
    .update(vaultGroups)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(vaultGroups.id, groupId), eq(vaultGroups.orgId, orgId)))
    .returning({ id: vaultGroups.id })
  return rows.length > 0
}

export async function deleteGroup(orgId: string, groupId: string): Promise<boolean> {
  const rows = await db
    .delete(vaultGroups)
    .where(and(eq(vaultGroups.id, groupId), eq(vaultGroups.orgId, orgId)))
    .returning({ id: vaultGroups.id })
  return rows.length > 0
}

export interface VaultGroupMemberView {
  userId: string
  name: string | null
  email: string | null
}

export async function listGroupMembers(orgId: string, groupId: string): Promise<VaultGroupMemberView[]> {
  const rows = await db
    .select({ userId: vaultGroupMembers.userId, name: users.name, email: users.email })
    .from(vaultGroupMembers)
    .leftJoin(users, eq(users.id, vaultGroupMembers.userId))
    .where(and(eq(vaultGroupMembers.orgId, orgId), eq(vaultGroupMembers.groupId, groupId)))
  return rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email }))
}

async function userInOrg(orgId: string, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.orgId, orgId))).limit(1)
  return !!row
}

async function groupInOrg(orgId: string, groupId: string): Promise<boolean> {
  const [row] = await db.select({ id: vaultGroups.id }).from(vaultGroups).where(and(eq(vaultGroups.id, groupId), eq(vaultGroups.orgId, orgId))).limit(1)
  return !!row
}

export async function addGroupMember(orgId: string, groupId: string, userId: string): Promise<boolean> {
  if (!(await groupInOrg(orgId, groupId)) || !(await userInOrg(orgId, userId))) return false
  await db.insert(vaultGroupMembers).values({ orgId, groupId, userId }).onConflictDoNothing()
  return true
}

export async function removeGroupMember(orgId: string, groupId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(vaultGroupMembers)
    .where(and(eq(vaultGroupMembers.orgId, orgId), eq(vaultGroupMembers.groupId, groupId), eq(vaultGroupMembers.userId, userId)))
    .returning({ id: vaultGroupMembers.id })
  return rows.length > 0
}

// ============================================================================
// SHARE TARGETS (picker)
// ============================================================================

export interface ShareTargets {
  users: { id: string; name: string | null; email: string | null }[]
  groups: { id: string; name: string }[]
}

export async function getShareTargets(orgId: string, excludeUserId: string): Promise<ShareTargets> {
  const orgUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(users.name)
  const groups = await db.select({ id: vaultGroups.id, name: vaultGroups.name }).from(vaultGroups).where(eq(vaultGroups.orgId, orgId)).orderBy(vaultGroups.name)
  return { users: orgUsers.filter((u) => u.id !== excludeUserId), groups }
}

// ============================================================================
// SHARES
// ============================================================================

export async function getUserGroupIds(orgId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: vaultGroupMembers.groupId })
    .from(vaultGroupMembers)
    .where(and(eq(vaultGroupMembers.orgId, orgId), eq(vaultGroupMembers.userId, userId)))
  return rows.map((r) => r.groupId)
}

export interface ShareInput {
  itemId?: string | null
  folderId?: string | null
  targetUserId?: string | null
  targetGroupId?: string | null
  permission: VaultSharePermission
  expiresAt?: string | null
}

export class VaultShareError extends Error {}

export interface VaultShareView {
  id: string
  itemId: string | null
  folderId: string | null
  targetUserId: string | null
  targetGroupId: string | null
  targetName: string | null
  permission: VaultSharePermission
  expiresAt: string | null
  createdAt: string
}

export async function createShare(orgId: string, sharedById: string, input: ShareInput): Promise<VaultShareView> {
  const hasItem = !!input.itemId
  const hasFolder = !!input.folderId
  if (hasItem === hasFolder) throw new VaultShareError("Share exactly one item or one folder")
  const hasUser = !!input.targetUserId
  const hasGroup = !!input.targetGroupId
  if (hasUser === hasGroup) throw new VaultShareError("Share to exactly one member or one group")

  // The item/folder must belong to the sharer
  if (hasItem) {
    const [row] = await db
      .select({ id: vaultItems.id })
      .from(vaultItems)
      .where(and(eq(vaultItems.id, input.itemId!), eq(vaultItems.orgId, orgId), eq(vaultItems.userId, sharedById)))
      .limit(1)
    if (!row) throw new VaultShareError("Item not found")
  } else {
    const [row] = await db
      .select({ id: vaultFolders.id })
      .from(vaultFolders)
      .where(and(eq(vaultFolders.id, input.folderId!), eq(vaultFolders.orgId, orgId), eq(vaultFolders.userId, sharedById)))
      .limit(1)
    if (!row) throw new VaultShareError("Folder not found")
  }

  if (hasUser && (input.targetUserId === sharedById || !(await userInOrg(orgId, input.targetUserId!)))) {
    throw new VaultShareError("Invalid member")
  }
  if (hasGroup && !(await groupInOrg(orgId, input.targetGroupId!))) {
    throw new VaultShareError("Invalid group")
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  const now = new Date()
  const [share] = await db
    .insert(vaultShares)
    .values({
      orgId,
      itemId: input.itemId ?? null,
      folderId: input.folderId ?? null,
      targetUserId: input.targetUserId ?? null,
      targetGroupId: input.targetGroupId ?? null,
      permission: input.permission,
      sharedById,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return toShareView(share, await targetName(orgId, share.targetUserId, share.targetGroupId))
}

async function targetName(orgId: string, targetUserId: string | null, targetGroupId: string | null): Promise<string | null> {
  if (targetUserId) {
    const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, targetUserId)).limit(1)
    return u?.name ?? u?.email ?? null
  }
  if (targetGroupId) {
    const [g] = await db.select({ name: vaultGroups.name }).from(vaultGroups).where(eq(vaultGroups.id, targetGroupId)).limit(1)
    return g?.name ?? null
  }
  return null
}

function toShareView(s: typeof vaultShares.$inferSelect, name: string | null): VaultShareView {
  return {
    id: s.id,
    itemId: s.itemId,
    folderId: s.folderId,
    targetUserId: s.targetUserId,
    targetGroupId: s.targetGroupId,
    targetName: name,
    permission: s.permission,
    expiresAt: s.expiresAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }
}

/** Active shares the owner created on a given item (direct item shares). */
export async function listItemShares(orgId: string, ownerId: string, itemId: string): Promise<VaultShareView[] | null> {
  const [item] = await db
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId), eq(vaultItems.userId, ownerId)))
    .limit(1)
  if (!item) return null
  const shares = await db
    .select()
    .from(vaultShares)
    .where(and(eq(vaultShares.orgId, orgId), eq(vaultShares.itemId, itemId), eq(vaultShares.status, "active")))
  const views: VaultShareView[] = []
  for (const s of shares) views.push(toShareView(s, await targetName(orgId, s.targetUserId, s.targetGroupId)))
  return views
}

/** Revoke a share (only the person who created it). */
export async function revokeShare(orgId: string, userId: string, shareId: string): Promise<boolean> {
  const rows = await db
    .update(vaultShares)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(vaultShares.id, shareId), eq(vaultShares.orgId, orgId), eq(vaultShares.sharedById, userId), eq(vaultShares.status, "active")))
    .returning({ id: vaultShares.id })
  return rows.length > 0
}

// ============================================================================
// ACCESS RESOLUTION (used by vault-server)
// ============================================================================

function activeShareConds(userId: string, groupIds: string[], now: Date) {
  const targets = [eq(vaultShares.targetUserId, userId)]
  if (groupIds.length) targets.push(inArray(vaultShares.targetGroupId, groupIds))
  return and(
    eq(vaultShares.status, "active"),
    or(isNull(vaultShares.expiresAt), gt(vaultShares.expiresAt, now)),
    or(...targets)
  )
}

/** The access level a user has to a specific item via a share (not counting ownership). */
export async function resolveSharedAccess(
  orgId: string,
  userId: string,
  item: { id: string; folderId: string | null }
): Promise<"edit" | "view" | null> {
  const groupIds = await getUserGroupIds(orgId, userId)
  const now = new Date()
  const scope = [eq(vaultShares.itemId, item.id)]
  if (item.folderId) scope.push(eq(vaultShares.folderId, item.folderId))
  const rows = await db
    .select({ permission: vaultShares.permission })
    .from(vaultShares)
    .where(and(eq(vaultShares.orgId, orgId), activeShareConds(userId, groupIds, now), or(...scope)))
  if (rows.length === 0) return null
  return rows.some((r) => r.permission === "edit") ? "edit" : "view"
}

/** All items shared to a user, mapped to their best permission (direct item shares + shared folders). */
export async function getSharedItemAccess(orgId: string, userId: string): Promise<Map<string, "edit" | "view">> {
  const groupIds = await getUserGroupIds(orgId, userId)
  const now = new Date()
  const shares = await db
    .select()
    .from(vaultShares)
    .where(and(eq(vaultShares.orgId, orgId), activeShareConds(userId, groupIds, now)))

  const map = new Map<string, "edit" | "view">()
  const add = (itemId: string, perm: "edit" | "view") => {
    if (map.get(itemId) === "edit") return
    if (perm === "edit" || !map.has(itemId)) map.set(itemId, perm)
  }
  for (const s of shares) if (s.itemId) add(s.itemId, s.permission)

  const folderShares = shares.filter((s) => s.folderId)
  if (folderShares.length) {
    const folderIds = [...new Set(folderShares.map((s) => s.folderId as string))]
    const permByFolder = new Map<string, "edit" | "view">()
    for (const s of folderShares) {
      const fid = s.folderId as string
      if (permByFolder.get(fid) === "edit") continue
      if (s.permission === "edit" || !permByFolder.has(fid)) permByFolder.set(fid, s.permission)
    }
    const items = await db
      .select({ id: vaultItems.id, folderId: vaultItems.folderId })
      .from(vaultItems)
      .where(and(eq(vaultItems.orgId, orgId), inArray(vaultItems.folderId, folderIds)))
    for (const it of items) {
      const p = it.folderId ? permByFolder.get(it.folderId) : undefined
      if (p) add(it.id, p)
    }
  }
  return map
}
