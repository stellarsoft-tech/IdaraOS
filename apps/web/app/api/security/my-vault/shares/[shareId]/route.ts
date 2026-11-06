/**
 * Revoke a share the user created
 * DELETE /api/security/my-vault/shares/[shareId]
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { revokeShare } from "@/lib/security/vault-share-server"

interface RouteContext {
  params: Promise<{ shareId: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { shareId } = await context.params
    const ok = await revokeShare(session.orgId, session.userId, shareId)
    if (!ok) return NextResponse.json({ error: "Share not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_share_revoked",
        entityType: "vault_share",
        entityId: shareId,
        description: "Revoked a vault share",
      })
    }
    return NextResponse.json({ data: { id: shareId } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revoking share:", error)
    return NextResponse.json({ error: "Failed to revoke the share" }, { status: 500 })
  }
}
