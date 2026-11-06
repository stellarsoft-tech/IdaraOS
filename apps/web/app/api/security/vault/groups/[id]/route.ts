/**
 * Vault admin - one sharing group
 * PATCH  /api/security/vault/groups/[id] -> rename
 * DELETE /api/security/vault/groups/[id] -> delete (members + its shares cascade)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { deleteGroup, renameGroup } from "@/lib/security/vault-share-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const renameSchema = z.object({ name: z.string().trim().min(1).max(100) })

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.vault.edit())
    const { id } = await context.params
    const parsed = renameSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }
    const ok = await renameGroup(session.orgId, id, parsed.data.name)
    if (!ok) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.vault",
        action: "vault_group_updated",
        entityType: "vault_group",
        entityId: id,
        entityName: parsed.data.name,
        description: `Renamed vault group to "${parsed.data.name}"`,
      })
    }
    return NextResponse.json({ data: { id, name: parsed.data.name } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error renaming vault group:", error)
    return NextResponse.json({ error: "Failed to rename the group" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.vault.edit())
    const { id } = await context.params
    const ok = await deleteGroup(session.orgId, id)
    if (!ok) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.vault",
        action: "vault_group_deleted",
        entityType: "vault_group",
        entityId: id,
        description: "Deleted a vault group",
      })
    }
    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting vault group:", error)
    return NextResponse.json({ error: "Failed to delete the group" }, { status: 500 })
  }
}
