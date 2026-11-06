/**
 * Password Vault - list the signed-in user's vault
 * GET /api/security/my-vault -> { folders, items (metadata only), encryptionKeyConfigured }
 *
 * Returns item metadata WITHOUT secrets; a secret is handed back only by the audited item/reveal route.
 */

import { NextResponse } from "next/server"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { listVault } from "@/lib/security/vault-server"
import { getUserVaultHealth } from "@/lib/vault/audit-server"
import { isEncryptionKeyConfigured } from "@/lib/vault/crypto-server"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const [{ folders, items }, health] = await Promise.all([
      listVault(session.orgId, session.userId),
      getUserVaultHealth(session.orgId, session.userId),
    ])
    return NextResponse.json({ folders, items, health, encryptionKeyConfigured: isEncryptionKeyConfigured() })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing vault:", error)
    return NextResponse.json({ error: "Failed to load the vault" }, { status: 500 })
  }
}
