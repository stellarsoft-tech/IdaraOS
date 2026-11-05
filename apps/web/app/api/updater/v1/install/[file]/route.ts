/**
 * IdaraOS Agent - portal self-install download
 * GET /api/updater/v1/install/agent      - the agent script (IdaraOS-Agent.ps1)
 * GET /api/updater/v1/install/installer  - the installer (Install-IdaraOSAgent.ps1)
 *
 * Public (the /api/updater prefix is excluded from session auth in middleware.ts) so a member can
 * fetch both from an admin PowerShell and install the agent themselves. The scripts carry NO secrets
 * and grant nothing on their own - a device only links after the member signs in to IdaraOS and
 * enters the pairing code the agent shows. This is the agent-provider counterpart to the Intune
 * updater package; it is NOT the device-authenticated self-update channel (that's ../agent-script).
 */

import { NextRequest, NextResponse } from "next/server"
import { getInstallerScript, getReleasedAgent } from "@/lib/security/agent-release"

interface RouteContext {
  params: Promise<{ file: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { file } = await context.params

    let content: Buffer | null = null
    let filename = ""
    if (file === "agent" || file === "agent.ps1") {
      content = (await getReleasedAgent())?.content ?? null
      filename = "IdaraOS-Agent.ps1"
    } else if (file === "installer" || file === "installer.ps1" || file === "install.ps1") {
      content = (await getInstallerScript())?.content ?? null
      filename = "Install-IdaraOSAgent.ps1"
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!content) {
      return NextResponse.json({ error: "The IdaraOS Agent isn't available on this server" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[Updater] Install download failed:", error)
    return NextResponse.json({ error: "Failed to serve the file" }, { status: 500 })
  }
}
