/**
 * Vault admin - members of a sharing group
 * GET    /api/security/vault/groups/[id]/members -> members
 * POST   /api/security/vault/groups/[id]/members -> add a member { userId }
 * DELETE /api/security/vault/groups/[id]/members -> remove a member { userId }
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { addGroupMember, listGroupMembers, removeGroupMember } from "@/lib/security/vault-share-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const memberSchema = z.object({ userId: z.string().uuid() })

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.vault.view())
    const { id } = await context.params
    const data = await listGroupMembers(session.orgId, id)
    return NextResponse.json({ data })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing group members:", error)
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.vault.edit())
    const { id } = await context.params
    const parsed = memberSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    const ok = await addGroupMember(session.orgId, id, parsed.data.userId)
    if (!ok) return NextResponse.json({ error: "Group or member not found" }, { status: 400 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.vault",
        action: "vault_group_member_added",
        entityType: "vault_group",
        entityId: id,
        description: "Added a member to a vault group",
      })
    }
    return NextResponse.json({ data: { ok: true } }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error adding group member:", error)
    return NextResponse.json({ error: "Failed to add the member" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.vault.edit())
    const { id } = await context.params
    const parsed = memberSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    await removeGroupMember(session.orgId, id, parsed.data.userId)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.vault",
        action: "vault_group_member_removed",
        entityType: "vault_group",
        entityId: id,
        description: "Removed a member from a vault group",
      })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error removing group member:", error)
    return NextResponse.json({ error: "Failed to remove the member" }, { status: 500 })
  }
}
