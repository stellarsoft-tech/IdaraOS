/**
 * Vault admin - sharing groups
 * GET  /api/security/vault/groups  -> groups with member counts
 * POST /api/security/vault/groups  -> create a group
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { createGroup, listGroups } from "@/lib/security/vault-share-server"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.vault.view())
    const data = await listGroups(session.orgId)
    return NextResponse.json({ data })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing vault groups:", error)
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 })
  }
}

const createSchema = z.object({ name: z.string().trim().min(1).max(100) })

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.vault.edit())
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }
    const group = await createGroup(session.orgId, parsed.data.name, session.userId)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.vault",
        action: "vault_group_created",
        entityType: "vault_group",
        entityId: group.id,
        entityName: group.name,
        description: `Created vault group "${group.name}"`,
      })
    }
    return NextResponse.json({ data: group }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating vault group:", error)
    return NextResponse.json({ error: "Failed to create the group" }, { status: 500 })
  }
}
