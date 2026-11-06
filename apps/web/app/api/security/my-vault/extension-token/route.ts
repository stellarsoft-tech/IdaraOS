/**
 * Browser-extension tokens for the signed-in user
 * GET  /api/security/my-vault/extension-token -> list (no secrets)
 * POST /api/security/my-vault/extension-token -> create one (plaintext returned once)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { generateExtensionToken, listExtensionTokens } from "@/lib/security/vault-extension-server"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const data = await listExtensionTokens(session.orgId, session.userId)
    return NextResponse.json({ data })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing extension tokens:", error)
    return NextResponse.json({ error: "Failed to load tokens" }, { status: 500 })
  }
}

const createSchema = z.object({ name: z.string().trim().max(60).optional() })

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myVault.create())
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
    const name = parsed.success ? parsed.data.name ?? "Browser extension" : "Browser extension"
    const token = await generateExtensionToken(session.orgId, session.userId, name)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_extension_token_created",
        entityType: "vault_extension_token",
        entityId: token.id,
        description: "Created a vault browser-extension token",
      })
    }
    return NextResponse.json({ data: token }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating extension token:", error)
    return NextResponse.json({ error: "Failed to create the token" }, { status: 500 })
  }
}
