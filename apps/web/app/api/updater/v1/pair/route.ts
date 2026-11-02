/**
 * IdaraOS Agent - Start pairing
 * POST /api/updater/v1/pair - Get a code for the member to enter in IdaraOS (agent device provider)
 *
 * Returns a short user code to show on the device and a device code to poll /pair/poll with.
 * No auth: the code does nothing until a signed-in member enters it. Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { LINK_DEVICE_PATH, MACHINE_ID_PATTERN, PAIRING_POLL_SECONDS } from "@/lib/security/agent"
import { createPairing } from "@/lib/security/agent-server"

const pairSchema = z.object({
  hostname: z.string().trim().min(1).max(63),
  machineId: z.string().trim().regex(MACHINE_ID_PATTERN),
  serialNumber: z.string().trim().max(100).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = pairSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid pairing request" }, { status: 400 })
    }

    const now = new Date()
    const pairing = await createPairing(parsed.data, now)
    return NextResponse.json({
      userCode: pairing.userCode,
      deviceCode: pairing.deviceCode,
      expiresIn: Math.round((pairing.expiresAt.getTime() - now.getTime()) / 1000),
      interval: PAIRING_POLL_SECONDS,
      verificationPath: LINK_DEVICE_PATH,
    })
  } catch (error) {
    console.error("[Agent] Pairing failed:", error)
    return NextResponse.json({ error: "Pairing failed" }, { status: 500 })
  }
}
