/**
 * IdaraOS Updater - Check-in
 * POST /api/updater/v1/check-in - Heartbeat; returns a run when one is due
 *
 * Auth: `Authorization: Bearer <deviceId>.<deviceSecret>`. Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { getSoftwareUpdateSettings } from "@/lib/security/software-server"
import { authenticateDevice, dispatchRunIfDue } from "@/lib/security/software-updates-server"

const checkInSchema = z.object({
  hostname: z.string().trim().min(1).max(63).optional(),
  osVersion: z.string().trim().max(100).optional().nullable(),
  updaterVersion: z.string().trim().max(32).optional().nullable(),
  wingetVersion: z.string().trim().max(32).optional().nullable(),
  // Error the device hit outside a run (winget missing, previous upload failed, ...)
  lastError: z.string().max(2000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"))
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = checkInSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid check-in" }, { status: 400 })
    }
    const body = parsed.data

    const now = new Date()
    const [updatedDevice] = await db
      .update(softwareUpdateDevices)
      .set({
        lastSeenAt: now,
        ...(body.hostname && { hostname: body.hostname }),
        ...(body.osVersion !== undefined && { osVersion: body.osVersion }),
        ...(body.updaterVersion !== undefined && { updaterVersion: body.updaterVersion }),
        ...(body.wingetVersion !== undefined && { wingetVersion: body.wingetVersion }),
        ...(body.lastError !== undefined && { lastError: body.lastError }),
        updatedAt: now,
      })
      .where(eq(softwareUpdateDevices.id, device.id))
      .returning()

    const settings = await getSoftwareUpdateSettings(device.orgId)
    const run = await dispatchRunIfDue(updatedDevice, settings, now)

    return NextResponse.json({ checkInMinutes: settings.checkInMinutes, run })
  } catch (error) {
    console.error("[Updater] Check-in failed:", error)
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 })
  }
}
