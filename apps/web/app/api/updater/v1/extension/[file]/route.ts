/**
 * Self-hosted vault browser extension (agent force-install)
 * GET /api/updater/v1/extension/update.xml         - Omaha update manifest (Chrome/Edge discovery)
 * GET /api/updater/v1/extension/idaraos-vault.crx  - the signed extension package
 *
 * Public (the /api/updater prefix is excluded from session auth in middleware.ts). The .crx is a signed
 * package; the browser verifies its signature against the baked-in key, so serving it grants nothing.
 */

import { NextRequest, NextResponse } from "next/server"
import { buildUpdateXml, getExtensionCrx } from "@/lib/security/vault-extension-dist"

interface RouteContext {
  params: Promise<{ file: string }>
}

function baseUrlFrom(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")
  const proto = request.headers.get("x-forwarded-proto") || "https"
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
  return host ? `${proto}://${host}` : ""
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { file } = await context.params

    if (file === "update.xml") {
      return new NextResponse(buildUpdateXml(baseUrlFrom(request)), {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
      })
    }

    if (file === "idaraos-vault.crx") {
      const crx = await getExtensionCrx()
      if (!crx) {
        return NextResponse.json({ error: "The extension package isn't available on this server" }, { status: 404 })
      }
      return new NextResponse(new Uint8Array(crx), {
        status: 200,
        headers: {
          "Content-Type": "application/x-chrome-extension",
          "Content-Disposition": 'attachment; filename="idaraos-vault.crx"',
          "Cache-Control": "no-store",
        },
      })
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    console.error("[Updater] Extension download failed:", error)
    return NextResponse.json({ error: "Failed to serve the file" }, { status: 500 })
  }
}
