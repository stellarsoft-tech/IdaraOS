/**
 * Password Vault - one folder
 * PATCH  /api/security/my-vault/folders/[id] -> rename
 * DELETE /api/security/my-vault/folders/[id] -> delete (items drop to "no folder"; subfolders cascade)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { deleteVaultFolder, renameVaultFolder } from "@/lib/security/vault-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const renameSchema = z.object({ name: z.string().trim().min(1).max(100) })

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { id } = await context.params
    const parsed = renameSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const folder = await renameVaultFolder(session.orgId, session.userId, id, parsed.data.name)
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_folder_updated",
        entityType: "vault_folder",
        entityId: id,
        entityName: folder.name,
        description: `Renamed vault folder to "${folder.name}"`,
      })
    }
    return NextResponse.json({ data: folder })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error renaming vault folder:", error)
    return NextResponse.json({ error: "Failed to rename the folder" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.delete())
    const { id } = await context.params

    const deleted = await deleteVaultFolder(session.orgId, session.userId, id)
    if (!deleted) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_folder_deleted",
        entityType: "vault_folder",
        entityId: id,
        description: "Deleted a vault folder",
      })
    }
    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting vault folder:", error)
    return NextResponse.json({ error: "Failed to delete the folder" }, { status: 500 })
  }
}
