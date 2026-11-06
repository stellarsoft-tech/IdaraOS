/**
 * Password Vault - create a folder
 * POST /api/security/my-vault/folders
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { createVaultFolder } from "@/lib/security/vault-server"

const folderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentFolderId: z.string().uuid().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myVault.create())
    const parsed = folderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const folder = await createVaultFolder(session.orgId, session.userId, parsed.data.name, parsed.data.parentFolderId)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_folder_created",
        entityType: "vault_folder",
        entityId: folder.id,
        entityName: folder.name,
        description: `Created vault folder "${folder.name}"`,
      })
    }
    return NextResponse.json({ data: folder }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating vault folder:", error)
    return NextResponse.json({ error: "Failed to create the folder" }, { status: 500 })
  }
}
