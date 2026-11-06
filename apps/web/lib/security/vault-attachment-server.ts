/**
 * Vault file attachments - server-side (Phase 4)
 *
 * Small files attached to an item, encrypted at rest (AES-256-GCM, stored base64 in a text column).
 * Access mirrors the item: anyone with access can download; owner or an "edit" share can add/delete.
 */

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { vaultAttachments, vaultItems } from "@/lib/db/schema"
import { decryptBufferFromBase64, encryptBufferToBase64 } from "@/lib/vault/crypto-server"
import { resolveSharedAccess } from "@/lib/security/vault-share-server"

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5 MB

type Access = "owner" | "edit" | "view" | null

async function itemAccess(orgId: string, userId: string, itemId: string): Promise<Access> {
  const [row] = await db
    .select({ id: vaultItems.id, userId: vaultItems.userId, folderId: vaultItems.folderId })
    .from(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.orgId, orgId)))
    .limit(1)
  if (!row) return null
  if (row.userId === userId) return "owner"
  return await resolveSharedAccess(orgId, userId, { id: row.id, folderId: row.folderId })
}

export interface VaultAttachmentView {
  id: string
  filename: string
  contentType: string | null
  sizeBytes: number
  createdAt: string
}

export async function listAttachments(orgId: string, userId: string, itemId: string): Promise<VaultAttachmentView[] | null> {
  const access = await itemAccess(orgId, userId, itemId)
  if (!access) return null
  const rows = await db
    .select({
      id: vaultAttachments.id,
      filename: vaultAttachments.filename,
      contentType: vaultAttachments.contentType,
      sizeBytes: vaultAttachments.sizeBytes,
      createdAt: vaultAttachments.createdAt,
    })
    .from(vaultAttachments)
    .where(and(eq(vaultAttachments.orgId, orgId), eq(vaultAttachments.itemId, itemId)))
    .orderBy(vaultAttachments.createdAt)
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

export async function addAttachment(
  orgId: string,
  userId: string,
  itemId: string,
  file: { filename: string; contentType: string | null; bytes: Buffer }
): Promise<VaultAttachmentView | null> {
  const access = await itemAccess(orgId, userId, itemId)
  if (access !== "owner" && access !== "edit") return null
  const [row] = await db
    .insert(vaultAttachments)
    .values({
      orgId,
      itemId,
      filename: file.filename.slice(0, 255),
      contentType: file.contentType,
      sizeBytes: file.bytes.length,
      dataEncrypted: encryptBufferToBase64(file.bytes),
    })
    .returning({
      id: vaultAttachments.id,
      filename: vaultAttachments.filename,
      contentType: vaultAttachments.contentType,
      sizeBytes: vaultAttachments.sizeBytes,
      createdAt: vaultAttachments.createdAt,
    })
  return { ...row, createdAt: row.createdAt.toISOString() }
}

export async function getAttachment(
  orgId: string,
  userId: string,
  attachmentId: string
): Promise<{ filename: string; contentType: string | null; bytes: Buffer } | null> {
  const [row] = await db
    .select()
    .from(vaultAttachments)
    .where(and(eq(vaultAttachments.id, attachmentId), eq(vaultAttachments.orgId, orgId)))
    .limit(1)
  if (!row) return null
  const access = await itemAccess(orgId, userId, row.itemId)
  if (!access) return null
  return { filename: row.filename, contentType: row.contentType, bytes: decryptBufferFromBase64(row.dataEncrypted) }
}

export async function deleteAttachment(orgId: string, userId: string, attachmentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: vaultAttachments.id, itemId: vaultAttachments.itemId })
    .from(vaultAttachments)
    .where(and(eq(vaultAttachments.id, attachmentId), eq(vaultAttachments.orgId, orgId)))
    .limit(1)
  if (!row) return false
  const access = await itemAccess(orgId, userId, row.itemId)
  if (access !== "owner" && access !== "edit") return false
  await db.delete(vaultAttachments).where(and(eq(vaultAttachments.id, attachmentId), eq(vaultAttachments.orgId, orgId)))
  return true
}
