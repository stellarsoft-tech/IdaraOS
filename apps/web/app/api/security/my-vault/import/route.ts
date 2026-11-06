/**
 * Import items from a password-manager CSV export (Keeper, Bitwarden, LastPass, 1Password, …)
 * POST /api/security/my-vault/import  { csv: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { importVaultItems } from "@/lib/security/vault-server"
import { mapImportCsv, parseCsv } from "@/lib/vault/csv"

const importSchema = z.object({ csv: z.string().min(1).max(5_000_000) })

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myVault.create())
    const parsed = importSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const rows = mapImportCsv(parseCsv(parsed.data.csv))
    if (rows.length === 0) {
      return NextResponse.json({ error: "No items found in the file" }, { status: 400 })
    }
    if (rows.length > 5000) {
      return NextResponse.json({ error: "Too many rows (max 5000 per import)" }, { status: 400 })
    }

    const { imported } = await importVaultItems(session.orgId, session.userId, rows)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_items_imported",
        entityType: "vault_item",
        description: `Imported ${imported} vault item(s) from a CSV`,
      })
    }
    return NextResponse.json({ data: { imported } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error importing vault items:", error)
    return NextResponse.json({ error: "Failed to import" }, { status: 500 })
  }
}
