/**
 * Revoke a browser-extension token
 * DELETE /api/security/my-vault/extension-token/[id]
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { revokeExtensionToken } from "@/lib/security/vault-extension-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { id } = await context.params
    const ok = await revokeExtensionToken(session.orgId, session.userId, id)
    if (!ok) return NextResponse.json({ error: "Token not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_extension_token_revoked",
        entityType: "vault_extension_token",
        entityId: id,
        description: "Revoked a vault browser-extension token",
      })
    }
    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revoking extension token:", error)
    return NextResponse.json({ error: "Failed to revoke the token" }, { status: 500 })
  }
}
