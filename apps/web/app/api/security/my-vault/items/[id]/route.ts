/**
 * Password Vault - one item
 * GET    /api/security/my-vault/items/[id]  -> full item WITH decrypted secrets (audited reveal)
 * PATCH  /api/security/my-vault/items/[id]  -> update (password changes append to history)
 * DELETE /api/security/my-vault/items/[id]  -> delete
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { deleteVaultItem, getVaultItem, updateVaultItem } from "@/lib/security/vault-server"
import { VaultPolicyError } from "@/lib/vault/audit-server"
import { vaultItemTypeValues } from "@/lib/db/schema"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const { id } = await context.params

    const item = await getVaultItem(session.orgId, session.userId, id)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_item_revealed",
        entityType: "vault_item",
        entityId: id,
        entityName: item.title,
        description: `Viewed the secret for vault item "${item.title}"`,
      })
    }
    return NextResponse.json({ data: item }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error reading vault item:", error)
    return NextResponse.json({ error: "Failed to load the item" }, { status: 500 })
  }
}

const updateSchema = z.object({
  type: z.enum(vaultItemTypeValues).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  username: z.string().trim().max(400).optional().nullable(),
  url: z.string().trim().max(2000).optional().nullable(),
  favorite: z.boolean().optional(),
  folderId: z.string().uuid().optional().nullable(),
  password: z.string().max(1000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  extra: z.record(z.unknown()).optional().nullable(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { id } = await context.params
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const item = await updateVaultItem(session.orgId, session.userId, id, parsed.data, session.userId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      const changedPassword = parsed.data.password !== undefined
      await audit.log({
        module: "security.my-vault",
        action: "vault_item_updated",
        entityType: "vault_item",
        entityId: id,
        entityName: item.title,
        description: `Updated vault item "${item.title}"${changedPassword ? " (password changed)" : ""}`,
      })
    }
    return NextResponse.json({ data: item })
  } catch (error) {
    if (error instanceof VaultPolicyError) return NextResponse.json({ error: error.message }, { status: 400 })
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating vault item:", error)
    return NextResponse.json({ error: "Failed to update the item" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.delete())
    const { id } = await context.params

    // Fetch the title for the audit entry before deleting
    const existing = await getVaultItem(session.orgId, session.userId, id)
    const deleted = await deleteVaultItem(session.orgId, session.userId, id)
    if (!deleted) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_item_deleted",
        entityType: "vault_item",
        entityId: id,
        entityName: existing?.title,
        description: `Deleted vault item${existing?.title ? ` "${existing.title}"` : ""}`,
      })
    }
    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting vault item:", error)
    return NextResponse.json({ error: "Failed to delete the item" }, { status: 500 })
  }
}
