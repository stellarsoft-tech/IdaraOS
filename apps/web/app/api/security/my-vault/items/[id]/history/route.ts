/**
 * Password Vault - password history for an item
 * GET /api/security/my-vault/items/[id]/history -> decrypted previous passwords (audited reveal)
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getVaultItemHistory } from "@/lib/security/vault-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const { id } = await context.params

    const history = await getVaultItemHistory(session.orgId, session.userId, id)
    if (history === null) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_item_history_revealed",
        entityType: "vault_item",
        entityId: id,
        description: "Viewed the password history for a vault item",
      })
    }
    return NextResponse.json({ data: history }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error reading vault item history:", error)
    return NextResponse.json({ error: "Failed to load the history" }, { status: 500 })
  }
}
