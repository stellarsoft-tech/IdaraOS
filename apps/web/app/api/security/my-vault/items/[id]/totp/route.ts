/**
 * Live TOTP/2FA code for an item
 * GET /api/security/my-vault/items/[id]/totp -> { code, period, remaining } | null
 *
 * Returns the current rotating code (not the secret), so it is polled and not audited per call.
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getItemTotp } from "@/lib/security/vault-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const { id } = await context.params
    const code = await getItemTotp(session.orgId, session.userId, id)
    return NextResponse.json({ data: code }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error generating TOTP:", error)
    return NextResponse.json({ error: "Failed to generate the code" }, { status: 500 })
  }
}
