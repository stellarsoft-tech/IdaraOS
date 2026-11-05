/**
 * IdaraOS web filtering - download a curated category list
 * GET /api/updater/v1/filter-list/<category> - returns the domain list this server ships for a category
 *
 * Auth: `Authorization: Bearer <deviceId>.<deviceSecret>` (same as check-in). The agent fetches a
 * list only when a web-filtering policy selected that category, and verifies the SHA-256 (also
 * returned here, and advertised in the check-in response) before applying it. The content is always
 * the server's own deployment/agent/filter-lists/<category>.txt - never admin-supplied.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateDevice } from "@/lib/security/software-updates-server"
import { getFilterList } from "@/lib/security/filter-lists"

interface RouteContext {
  params: Promise<{ category: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"))
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { category } = await context.params
    const list = await getFilterList(category)
    if (!list) {
      return NextResponse.json({ error: "Unknown or unavailable filter list" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(list.content), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-List-Category": list.category,
        "X-List-SHA256": list.sha256,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[Updater] Filter list download failed:", error)
    return NextResponse.json({ error: "Failed to serve the filter list" }, { status: 500 })
  }
}
