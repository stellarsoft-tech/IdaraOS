/**
 * Device Policy Groups API
 * GET  /api/security/policies/groups - groups with their members and policies, plus picker options
 * POST /api/security/policies/groups - create a group
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { createPolicyGroup, getPolicyPickerOptions, listPolicyGroups } from "@/lib/security/policy-server"
import { POLICY_TYPES } from "@/lib/security/device-policies"

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
})

export async function GET() {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const [groups, options] = await Promise.all([
      listPolicyGroups(session.orgId),
      getPolicyPickerOptions(session.orgId),
    ])
    return NextResponse.json({ data: groups, options, policyTypes: POLICY_TYPES })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing policy groups:", error)
    return NextResponse.json({ error: "Failed to list groups" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "A group name is required" }, { status: 400 })
    }

    const result = await createPolicyGroup(
      session.orgId,
      parsed.data.name,
      parsed.data.description ?? null,
      session.userId
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "policy_group_created",
        entityType: "policy_group",
        entityId: result.group.id,
        entityName: result.group.name,
        description: `Created device group "${result.group.name}"`,
      })
    }

    return NextResponse.json({ data: { id: result.group.id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating policy group:", error)
    return NextResponse.json({ error: "Failed to create the group" }, { status: 500 })
  }
}
