/**
 * Who the user can share with: org members + vault groups.
 * GET /api/security/my-vault/share-targets
 */

import { NextResponse } from "next/server"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getShareTargets } from "@/lib/security/vault-share-server"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const data = await getShareTargets(session.orgId, session.userId)
    return NextResponse.json({ data })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error loading share targets:", error)
    return NextResponse.json({ error: "Failed to load share targets" }, { status: 500 })
  }
}
