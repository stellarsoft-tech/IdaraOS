/**
 * IdaraOS Agent - Poll pairing
 * POST /api/updater/v1/pair/poll - Wait for the member to enter the code; returns the device secret once
 *
 * Responses: 202 { status: "pending" }, 410 { status: "expired" }, 200 { deviceId, deviceSecret, checkInMinutes }.
 * Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { pollPairing } from "@/lib/security/agent-server"
import { getSoftwareUpdateSettings } from "@/lib/security/software-server"

const pollSchema = z.object({
  deviceCode: z.string().min(10).max(200),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = pollSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid poll request" }, { status: 400 })
    }

    const result = await pollPairing(parsed.data.deviceCode)
    if (result.status === "pending") {
      return NextResponse.json({ status: "pending" }, { status: 202 })
    }
    if (result.status === "expired") {
      return NextResponse.json({ status: "expired", error: "The code expired or was already used. Start again." }, { status: 410 })
    }

    const settings = await getSoftwareUpdateSettings(result.orgId)
    return NextResponse.json({
      status: "completed",
      deviceId: result.deviceId,
      deviceSecret: result.deviceSecret,
      checkInMinutes: settings.checkInMinutes,
    })
  } catch (error) {
    console.error("[Agent] Pairing poll failed:", error)
    return NextResponse.json({ error: "Pairing poll failed" }, { status: 500 })
  }
}
