/**
 * IdaraOS Agent self-update - download the released agent script
 * GET /api/updater/v1/agent-script - returns the official agent script this server ships
 *
 * Auth: `Authorization: Bearer <deviceId>.<deviceSecret>` (same as check-in). The agent fetches this
 * only after a check-in told it to update, and verifies the SHA-256 (also returned here) before
 * replacing itself. The content is always the server's own deployment/agent/IdaraOS-Agent.ps1 -
 * never admin-supplied - so this is an update channel, not a way to run arbitrary code.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateDevice } from "@/lib/security/software-updates-server"
import { getReleasedAgent } from "@/lib/security/agent-release"

export async function GET(request: NextRequest) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"))
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const released = await getReleasedAgent()
    if (!released) {
      return NextResponse.json({ error: "No agent release is available on this server" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(released.content), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Version": released.version,
        "X-Agent-SHA256": released.sha256,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[Updater] Agent script download failed:", error)
    return NextResponse.json({ error: "Failed to serve the agent script" }, { status: 500 })
  }
}
