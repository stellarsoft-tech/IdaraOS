/**
 * Vault browser-extension data API (token-authed, not cookie-authed)
 * GET  /api/vault-ext/items -> the user's logins (decrypted) for autofill
 * POST /api/vault-ext/items -> save a new login from the extension
 *
 * Auth: `Authorization: Bearer <vext token>`. CORS-open because it is token-authed and carries no
 * cookies; the extension's background (with host permission) calls it cross-origin.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  authenticateExtensionToken,
  getLoginsForExtension,
  saveLoginFromExtension,
} from "@/lib/security/vault-extension-server"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(request: NextRequest) {
  const auth = await authenticateExtensionToken(request.headers.get("authorization"))
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS })
  try {
    const logins = await getLoginsForExtension(auth.orgId, auth.userId)
    return NextResponse.json({ data: logins }, { headers: CORS })
  } catch (error) {
    console.error("Error serving extension logins:", error)
    return NextResponse.json({ error: "Failed to load logins" }, { status: 500, headers: CORS })
  }
}

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().max(2000).optional().nullable(),
  username: z.string().trim().max(400).optional().nullable(),
  password: z.string().min(1).max(1000),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateExtensionToken(request.headers.get("authorization"))
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS })
  try {
    const parsed = saveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid login" }, { status: 400, headers: CORS })
    }
    const result = await saveLoginFromExtension(auth.orgId, auth.userId, {
      title: parsed.data.title,
      url: parsed.data.url ?? null,
      username: parsed.data.username ?? null,
      password: parsed.data.password,
    })
    return NextResponse.json({ data: result }, { status: 201, headers: CORS })
  } catch (error) {
    console.error("Error saving extension login:", error)
    return NextResponse.json({ error: "Failed to save" }, { status: 500, headers: CORS })
  }
}
