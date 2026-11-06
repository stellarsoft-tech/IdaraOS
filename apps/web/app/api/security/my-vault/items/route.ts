/**
 * Password Vault - create an item
 * POST /api/security/my-vault/items
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { createVaultItem } from "@/lib/security/vault-server"
import { VaultPolicyError } from "@/lib/vault/audit-server"
import { vaultItemTypeValues } from "@/lib/db/schema"

const itemSchema = z.object({
  type: z.enum(vaultItemTypeValues).optional(),
  title: z.string().trim().min(1).max(200),
  username: z.string().trim().max(400).optional().nullable(),
  url: z.string().trim().max(2000).optional().nullable(),
  favorite: z.boolean().optional(),
  folderId: z.string().uuid().optional().nullable(),
  password: z.string().max(1000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  totp: z.string().max(2000).optional().nullable(),
  extra: z.record(z.unknown()).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myVault.create())
    const parsed = itemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const item = await createVaultItem(session.orgId, session.userId, parsed.data)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_item_created",
        entityType: "vault_item",
        entityId: item.id,
        entityName: item.title,
        description: `Added vault item "${item.title}"`,
      })
    }
    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    if (error instanceof VaultPolicyError) return NextResponse.json({ error: error.message }, { status: 400 })
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating vault item:", error)
    return NextResponse.json({ error: "Failed to save the item" }, { status: 500 })
  }
}
