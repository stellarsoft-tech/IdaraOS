/**
 * Device Policy API
 * PUT /api/security/policies/groups/[id]/policies - set a policy (type) on the group: on/off + settings
 *
 * The type must be an allowlisted policy (lib/security/device-policies.ts); settings are sanitized to
 * the policy's defined fields. No command is accepted.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { setGroupPolicy } from "@/lib/security/policy-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const putSchema = z.object({
  type: z.string().trim().min(1).max(64),
  enabled: z.boolean(),
  settings: z.record(z.unknown()).optional().nullable(),
})

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const parsed = putSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid policy" }, { status: 400 })
    }

    const result = await setGroupPolicy(
      session.orgId,
      id,
      parsed.data.type,
      parsed.data.enabled,
      parsed.data.settings ?? null,
      session.userId
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: result.enabled ? "policy_enabled" : "policy_disabled",
        entityType: "policy_group",
        entityId: id,
        entityName: result.policyName,
        description: `${result.enabled ? "Enabled" : "Disabled"} "${result.policyName}" on a device group`,
      })
    }

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error setting policy:", error)
    return NextResponse.json({ error: "Failed to set the policy" }, { status: 500 })
  }
}
