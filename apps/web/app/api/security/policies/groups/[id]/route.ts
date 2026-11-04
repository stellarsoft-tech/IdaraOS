/**
 * Device Policy Group API
 * PATCH  /api/security/policies/groups/[id] - rename or re-describe a group
 * DELETE /api/security/policies/groups/[id] - delete a group (members and policies go with it)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { deletePolicyGroup, updatePolicyGroup } from "@/lib/security/policy-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 })
    }

    const result = await updatePolicyGroup(session.orgId, id, parsed.data)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "policy_group_updated",
        entityType: "policy_group",
        entityId: id,
        entityName: result.group.name,
        description: `Updated device group "${result.group.name}"`,
      })
    }

    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating policy group:", error)
    return NextResponse.json({ error: "Failed to update the group" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params

    const result = await deletePolicyGroup(session.orgId, id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "policy_group_deleted",
        entityType: "policy_group",
        entityId: id,
        entityName: result.group.name,
        description: `Deleted device group "${result.group.name}"`,
      })
    }

    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting policy group:", error)
    return NextResponse.json({ error: "Failed to delete the group" }, { status: 500 })
  }
}
