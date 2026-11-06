/**
 * Shares on one of the user's own items
 * GET  /api/security/my-vault/items/[id]/shares  -> active shares on this item
 * POST /api/security/my-vault/items/[id]/shares  -> share this item with a member or group
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { createShare, listItemShares, VaultShareError } from "@/lib/security/vault-share-server"
import { vaultSharePermissionValues } from "@/lib/db/schema"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const { id } = await context.params
    const shares = await listItemShares(session.orgId, session.userId, id)
    if (shares === null) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    return NextResponse.json({ data: shares })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing item shares:", error)
    return NextResponse.json({ error: "Failed to load shares" }, { status: 500 })
  }
}

const shareSchema = z
  .object({
    targetUserId: z.string().uuid().optional().nullable(),
    targetGroupId: z.string().uuid().optional().nullable(),
    permission: z.enum(vaultSharePermissionValues),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .refine((d) => !!d.targetUserId !== !!d.targetGroupId, { message: "Pick exactly one member or group" })

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { id } = await context.params
    const parsed = shareSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const share = await createShare(session.orgId, session.userId, { itemId: id, ...parsed.data })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_item_shared",
        entityType: "vault_item",
        entityId: id,
        description: `Shared a vault item with ${share.targetName ?? "a member"} (${share.permission})`,
      })
    }
    return NextResponse.json({ data: share }, { status: 201 })
  } catch (error) {
    if (error instanceof VaultShareError) return NextResponse.json({ error: error.message }, { status: 400 })
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating share:", error)
    return NextResponse.json({ error: "Failed to share the item" }, { status: 500 })
  }
}
