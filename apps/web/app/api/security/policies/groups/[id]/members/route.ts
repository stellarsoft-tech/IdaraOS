/**
 * Device Policy Group Members API
 * POST   /api/security/policies/groups/[id]/members - add one device or one user
 * DELETE /api/security/policies/groups/[id]/members?memberId=... - remove a member
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { addGroupMember, removeGroupMember } from "@/lib/security/policy-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const addSchema = z
  .object({
    deviceId: z.string().uuid().optional().nullable(),
    userId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => !!v.deviceId !== !!v.userId, "Add exactly one device or one user")

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Add exactly one device or one user" }, { status: 400 })
    }

    const result = await addGroupMember(session.orgId, id, parsed.data)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "policy_group_member_added",
        entityType: "policy_group",
        entityId: id,
        entityName: result.memberName,
        description: `Added ${result.memberName} to a device group`,
      })
    }

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error adding group member:", error)
    return NextResponse.json({ error: "Failed to add the member" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const memberId = request.nextUrl.searchParams.get("memberId")
    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 })

    const result = await removeGroupMember(session.orgId, id, memberId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error removing group member:", error)
    return NextResponse.json({ error: "Failed to remove the member" }, { status: 500 })
  }
}
