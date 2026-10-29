/**
 * IdaraOS Updater - Enrollment
 * POST /api/updater/v1/enroll - Register a device with the organization's enrollment token
 *
 * The device must already be in Assets (synced from Intune) with the same Entra device ID,
 * and its serial number must match when Assets has one. Returns a per-device secret once.
 * Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, softwareUpdateDevices, softwareUpdateSettings } from "@/lib/db/schema"
import { createAuditLog } from "@/lib/audit"
import { generateSecret, hashSecret } from "@/lib/security/software-updates-server"

const enrollSchema = z.object({
  enrollmentToken: z.string().min(10).max(200),
  entraDeviceId: z.string().uuid(),
  intuneDeviceId: z.string().uuid().optional().nullable(),
  hostname: z.string().trim().min(1).max(63),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  osVersion: z.string().trim().max(100).optional().nullable(),
  updaterVersion: z.string().trim().max(32).optional().nullable(),
  wingetVersion: z.string().trim().max(32).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = enrollSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid enrollment request" }, { status: 400 })
    }
    const body = parsed.data
    const entraDeviceId = body.entraDeviceId.toLowerCase()

    const [settings] = await db
      .select()
      .from(softwareUpdateSettings)
      .where(eq(softwareUpdateSettings.enrollmentTokenHash, hashSecret(body.enrollmentToken)))
      .limit(1)
    if (!settings) {
      return NextResponse.json({ error: "Invalid enrollment token" }, { status: 401 })
    }
    const orgId = settings.orgId

    const [asset] = await db
      .select({ id: assets.id, serialNumber: assets.serialNumber, intuneDeviceId: assets.intuneDeviceId })
      .from(assets)
      .where(and(eq(assets.orgId, orgId), sql`lower(${assets.entraDeviceId}) = ${entraDeviceId}`))
      .limit(1)
    if (!asset) {
      return NextResponse.json(
        { error: "This device isn't in IdaraOS Assets yet. Run the Intune asset sync, then try again.", code: "device_not_in_assets" },
        { status: 403 }
      )
    }
    if (
      asset.serialNumber &&
      body.serialNumber &&
      asset.serialNumber.trim().toLowerCase() !== body.serialNumber.trim().toLowerCase()
    ) {
      return NextResponse.json({ error: "Serial number doesn't match Assets", code: "serial_mismatch" }, { status: 403 })
    }

    const [existing] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.orgId, orgId), eq(softwareUpdateDevices.entraDeviceId, entraDeviceId)))
      .limit(1)
    if (existing?.status === "revoked") {
      return NextResponse.json({ error: "This device was revoked in IdaraOS", code: "device_revoked" }, { status: 403 })
    }

    const secret = generateSecret("iud")
    const now = new Date()
    const values = {
      assetId: asset.id,
      intuneDeviceId: body.intuneDeviceId ?? asset.intuneDeviceId,
      hostname: body.hostname,
      serialNumber: body.serialNumber ?? null,
      osVersion: body.osVersion ?? null,
      updaterVersion: body.updaterVersion ?? null,
      wingetVersion: body.wingetVersion ?? null,
      secretHash: hashSecret(secret),
      lastSeenAt: now,
      updatedAt: now,
    }

    const [device] = existing
      ? await db.update(softwareUpdateDevices).set(values).where(eq(softwareUpdateDevices.id, existing.id)).returning()
      : await db.insert(softwareUpdateDevices).values({ ...values, orgId, entraDeviceId, enrolledAt: now }).returning()

    await createAuditLog(
      { orgId, actor: { id: null, email: "system", name: "IdaraOS Updater", ip: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") } },
      {
        module: "security.software-updates",
        action: existing ? "re_enroll" : "enroll",
        entityType: "software_update_device",
        entityId: device.id,
        entityName: device.hostname,
        description: `${existing ? "Re-enrolled" : "Enrolled"} ${device.hostname} in software updates`,
      }
    )

    return NextResponse.json({
      deviceId: device.id,
      deviceSecret: secret,
      checkInMinutes: settings.checkInMinutes,
    })
  } catch (error) {
    console.error("[Updater] Enrollment failed:", error)
    return NextResponse.json({ error: "Enrollment failed" }, { status: 500 })
  }
}
