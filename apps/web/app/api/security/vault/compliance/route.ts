/**
 * Vault admin - Security Audit
 * GET /api/security/vault/compliance -> per-user weak/reused/old password counts
 *
 * RBAC: security.vault (admin). Aggregates non-secret derived fields only (no decryption).
 */

import { NextResponse } from "next/server"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getVaultCompliance } from "@/lib/vault/audit-server"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.vault.view())
    const data = await getVaultCompliance(session.orgId)
    return NextResponse.json({ data })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error loading vault compliance:", error)
    return NextResponse.json({ error: "Failed to load the Security Audit" }, { status: 500 })
  }
}
