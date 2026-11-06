/**
 * Password Vault - server-side data access
 *
 * All functions are scoped by BOTH orgId and userId: a user only ever sees or changes their own vault.
 * Secret fields are encrypted on write and decrypted on read with lib/vault/crypto-server.ts; list
 * reads never decrypt (they return metadata + "hasX" flags only). The decrypting reads (getVaultItem,
 * getVaultItemHistory) hand back secrets, so their routes MUST audit every call.
 */

import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, vaultFolders, vaultItems, vaultItemHistory, type VaultItemType } from "@/lib/db/schema"
import { decryptOptional, decryptSecret, encryptOptional, encryptSecret } from "@/lib/vault/crypto-server"
import { derivePasswordFields, enforceVaultPolicy } from "@/lib/vault/audit-server"
import { getSharedItemAccess, resolveSharedAccess, type VaultAccessLevel } from "@/lib/security/vault-share-server"

// ============================================================================
// VIEW TYPES (what routes return)
// ============================================================================

export interface VaultFolderView {
  id: string
  name: string
  parentFolderId: string | null
  createdAt: string
  updatedAt: string
}

/** Item metadata WITHOUT secrets (for the list). */
export interface VaultItemSummary {
  id: string
  type: VaultItemType
  title: string
  username: string | null
  url: string | null
  favorite: boolean
  folderId: string | null
  hasPassword: boolean
  hasNotes: boolean
  lastPasswordChangeAt: string | null
  createdAt: string
  updatedAt: string
}

/** A single item WITH its decrypted secrets (a reveal - audit it in the route). */
export interface VaultItemDetail extends VaultItemSummary {
  password: string | null
  notes: string | null
  extra: Record<string, unknown> | null
  // The requester's access to this item: "owner" | "edit" | "view"
  access: VaultAccessLevel
}

/** An item shared TO the user (not owned): summary + their access level + the owner's name. */
export interface VaultSharedItemSummary extends VaultItemSummary {
  access: "edit" | "view"
  ownerName: string | null
}

export interface VaultItemInput {
  type?: VaultItemType
  title: string
  username?: string | null
  url?: string | null
  favorite?: boolean
  folderId?: string | null
  password?: string | null
  notes?: string | null
  extra?: Record<string, unknown> | null
}

// ============================================================================
// MAPPERS
// ============================================================================

function toSummary(row: typeof vaultItems.$inferSelect): VaultItemSummary {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    username: row.username,
    url: row.url,
    favorite: row.favorite,
    folderId: row.folderId,
    hasPassword: !!row.passwordEncrypted,
    hasNotes: !!row.notesEncrypted,
    lastPasswordChangeAt: row.lastPasswordChangeAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toFolderView(row: typeof vaultFolders.$inferSelect): VaultFolderView {
  return {
    id: row.id,
    name: row.name,
    parentFolderId: row.parentFolderId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function parseExtra(blob: string | null): Record<string, unknown> | null {
  const json = decryptOptional(blob)
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ============================================================================
// READS
// ============================================================================

export async function listVault(orgId: string, userId: string): Promise<{
  folders: VaultFolderView[]
  items: VaultItemSummary[]
  shared: VaultSharedItemSummary[]
}> {
  const [folderRows, itemRows, sharedAccess] = await Promise.all([
    db
      .select()
      .from(vaultFolders)
      .where(and(eq(vaultFolders.orgId, orgId), eq(vaultFolders.userId, userId)))
      .orderBy(vaultFolders.name),
    db
      .select()
      .from(vaultItems)
      .where(and(eq(vaultItems.orgId, orgId), eq(vaultItems.userId, userId)))
      .orderBy(desc(vaultItems.favorite), vaultItems.title),
    getSharedItemAccess(orgId, userId),
  ])

  // Items shared TO this user (owned by others)
  let shared: VaultSharedItemSummary[] = []
  const sharedIds = [...sharedAccess.keys()]
  if (sharedIds.length) {
    const rows = await db
      .select()
      .from(vaultItems)
      .where(and(eq(vaultItems.orgId, orgId), inArray(vaultItems.id, sharedIds)))
      .orderBy(vaultItems.title)
    const ownerIds = [...new Set(rows.map((r) => r.userId))]
    const owners = ownerIds.length
      ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ownerIds))
      : []
    const ownerMap = new Map(owners.map((o) => [o.id, o.name ?? o.email]))
    shared = rows.map((r) => ({ ...toSummary(r), access: sharedAccess.get(r.id)!, ownerName: ownerMap.get(r.userId) ?? null }))
  }

  return { folders: folderRows.map(toFolderView), items: itemRows.map(toSummary), shared }
}

/** Full item with decrypted secrets. Returns null if it doesn't exist or the user has no access. */
export async function getVaultItem(orgId: string, userId: string, itemId: string): Promise<VaultItemDetail | null> {
  const [row] = await db
    .select()
    .from(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId)))
    .limit(1)
  if (!row) return null

  let access: VaultAccessLevel
  if (row.userId === userId) {
    access = "owner"
  } else {
    const shared = await resolveSharedAccess(orgId, userId, { id: row.id, folderId: row.folderId })
    if (!shared) return null
    access = shared
  }

  return {
    ...toSummary(row),
    access,
    password: decryptOptional(row.passwordEncrypted),
    notes: decryptOptional(row.notesEncrypted),
    extra: parseExtra(row.extraEncrypted),
  }
}

export interface VaultHistoryEntry {
  id: string
  password: string
  changedAt: string
}

/** Decrypted password history for an item (newest first). A reveal - audit it in the route. */
export async function getVaultItemHistory(orgId: string, userId: string, itemId: string): Promise<VaultHistoryEntry[] | null> {
  const [item] = await db
    .select({ id: vaultItems.id, userId: vaultItems.userId, folderId: vaultItems.folderId })
    .from(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId)))
    .limit(1)
  if (!item) return null
  if (item.userId !== userId) {
    const shared = await resolveSharedAccess(orgId, userId, { id: item.id, folderId: item.folderId })
    if (!shared) return null
  }
  const rows = await db
    .select()
    .from(vaultItemHistory)
    .where(and(eq(vaultItemHistory.itemId, itemId), eq(vaultItemHistory.orgId, orgId)))
    .orderBy(desc(vaultItemHistory.changedAt))
  return rows.map((r) => ({ id: r.id, password: decryptSecret(r.passwordEncrypted), changedAt: r.changedAt.toISOString() }))
}

// ============================================================================
// WRITES
// ============================================================================

async function folderBelongsToUser(orgId: string, userId: string, folderId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: vaultFolders.id })
    .from(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.orgId, orgId), eq(vaultFolders.userId, userId)))
    .limit(1)
  return !!row
}

export async function createVaultItem(orgId: string, userId: string, input: VaultItemInput): Promise<VaultItemSummary> {
  const now = new Date()
  const folderId = input.folderId && (await folderBelongsToUser(orgId, userId, input.folderId)) ? input.folderId : null
  const extraJson = input.extra && Object.keys(input.extra).length > 0 ? JSON.stringify(input.extra) : null
  const password = input.password?.trim() || ""
  // Enforce the org password policy (throws VaultPolicyError on enforcement "block" with violations)
  if (password) await enforceVaultPolicy(orgId, userId, password, null)
  const derived = derivePasswordFields(password || null)
  const [row] = await db
    .insert(vaultItems)
    .values({
      orgId,
      userId,
      folderId,
      type: input.type ?? "login",
      title: input.title.trim(),
      username: input.username?.trim() || null,
      url: input.url?.trim() || null,
      favorite: input.favorite ?? false,
      passwordEncrypted: password ? encryptSecret(password) : null,
      notesEncrypted: encryptOptional(input.notes),
      extraEncrypted: encryptOptional(extraJson),
      passwordFingerprint: derived.passwordFingerprint,
      passwordStrength: derived.passwordStrength,
      lastPasswordChangeAt: password ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return toSummary(row)
}

/**
 * Update an item. Only fields present in `input` are changed. When the password changes, the OLD
 * password is appended to history and lastPasswordChangeAt is bumped. Returns null if not found.
 */
export async function updateVaultItem(
  orgId: string,
  userId: string,
  itemId: string,
  input: Partial<VaultItemInput>,
  changedById: string
): Promise<VaultItemSummary | null> {
  const [current] = await db
    .select()
    .from(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId)))
    .limit(1)
  if (!current) return null

  // Access: the owner, or someone the item is shared to with "edit"
  const isOwner = current.userId === userId
  if (!isOwner) {
    const shared = await resolveSharedAccess(orgId, userId, { id: current.id, folderId: current.folderId })
    if (shared !== "edit") return null
  }
  const ownerId = current.userId

  const now = new Date()
  const set: Partial<typeof vaultItems.$inferInsert> = { updatedAt: now }

  if (input.type !== undefined) set.type = input.type
  if (input.title !== undefined) set.title = input.title.trim()
  if (input.username !== undefined) set.username = input.username?.trim() || null
  if (input.url !== undefined) set.url = input.url?.trim() || null
  if (input.favorite !== undefined) set.favorite = input.favorite
  if (input.notes !== undefined) set.notesEncrypted = encryptOptional(input.notes)
  if (input.extra !== undefined) {
    const extraJson = input.extra && Object.keys(input.extra).length > 0 ? JSON.stringify(input.extra) : null
    set.extraEncrypted = encryptOptional(extraJson)
  }
  // Only the owner can move an item between folders (folders belong to the owner)
  if (input.folderId !== undefined && isOwner) {
    set.folderId = input.folderId && (await folderBelongsToUser(orgId, ownerId, input.folderId)) ? input.folderId : null
  }

  let passwordChanged = false
  if (input.password !== undefined) {
    const nextPassword = input.password?.trim() || ""
    const currentPassword = decryptOptional(current.passwordEncrypted) ?? ""
    if (nextPassword !== currentPassword) {
      passwordChanged = true
      // Enforce the owner's policy (reuse is checked within the owner's vault)
      if (nextPassword) await enforceVaultPolicy(orgId, ownerId, nextPassword, itemId)
      const derived = derivePasswordFields(nextPassword || null)
      set.passwordEncrypted = nextPassword ? encryptSecret(nextPassword) : null
      set.passwordFingerprint = derived.passwordFingerprint
      set.passwordStrength = derived.passwordStrength
      if (nextPassword) set.lastPasswordChangeAt = now
    }
  }

  const [row] = await db
    .update(vaultItems)
    .set(set)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId)))
    .returning()

  // Keep the previous password in history (only when there was one and it actually changed)
  if (passwordChanged && current.passwordEncrypted) {
    await db.insert(vaultItemHistory).values({
      orgId,
      itemId,
      passwordEncrypted: current.passwordEncrypted,
      changedById,
      changedAt: now,
    })
  }

  return row ? toSummary(row) : null
}

export async function deleteVaultItem(orgId: string, userId: string, itemId: string): Promise<boolean> {
  const deleted = await db
    .delete(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId), eq(vaultItems.userId, userId)))
    .returning({ id: vaultItems.id })
  return deleted.length > 0
}

// ============================================================================
// FOLDERS
// ============================================================================

export async function createVaultFolder(
  orgId: string,
  userId: string,
  name: string,
  parentFolderId?: string | null
): Promise<VaultFolderView> {
  const parent = parentFolderId && (await folderBelongsToUser(orgId, userId, parentFolderId)) ? parentFolderId : null
  const now = new Date()
  const [row] = await db
    .insert(vaultFolders)
    .values({ orgId, userId, name: name.trim(), parentFolderId: parent, createdAt: now, updatedAt: now })
    .returning()
  return toFolderView(row)
}

export async function renameVaultFolder(
  orgId: string,
  userId: string,
  folderId: string,
  name: string
): Promise<VaultFolderView | null> {
  const [row] = await db
    .update(vaultFolders)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.orgId, orgId), eq(vaultFolders.userId, userId)))
    .returning()
  return row ? toFolderView(row) : null
}

/** Delete a folder. Its items drop to "no folder" (FK on delete set null); subfolders cascade. */
export async function deleteVaultFolder(orgId: string, userId: string, folderId: string): Promise<boolean> {
  const deleted = await db
    .delete(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.orgId, orgId), eq(vaultFolders.userId, userId)))
    .returning({ id: vaultFolders.id })
  return deleted.length > 0
}
