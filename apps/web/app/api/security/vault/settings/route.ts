/**
 * Vault admin - org password policy
 * GET /api/security/vault/settings  -> the current policy
 * PUT /api/security/vault/settings  -> update it
 *
 * RBAC: security.vault (admin). The policy is enforced at item-save time (see vault-server).
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getVaultSettings, updateVaultSettings } from "@/lib/vault/audit-server"
import { vaultEnforcementValues } from "@/lib/db/schema"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.vault.view())
    const settings = await getVaultSettings(session.orgId)
    return NextResponse.json({ data: settings })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error loading vault policy:", error)
    return NextResponse.json({ error: "Failed to load the policy" }, { status: 500 })
  }
}

const schema = z.object({
  minLength: z.number().int().min(8).max(128).optional(),
  requireUpper: z.boolean().optional(),
  requireLower: z.boolean().optional(),
  requireDigit: z.boolean().optional(),
  requireSymbol: z.boolean().optional(),
  noReuse: z.boolean().optional(),
  maxAgeDays: z.number().int().min(0).max(3650).optional(),
  enforcement: z.enum(vaultEnforcementValues).optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.vault.edit())
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const before = await getVaultSettings(session.orgId)
    const settings = await updateVaultSettings(session.orgId, parsed.data, session.userId)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("security.vault", "vault_settings", settings.id, "Vault password policy", before, settings)
    }
    return NextResponse.json({ data: settings })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating vault policy:", error)
    return NextResponse.json({ error: "Failed to update the policy" }, { status: 500 })
  }
}
