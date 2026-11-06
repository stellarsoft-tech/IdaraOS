/**
 * Device location (approximate)
 * GET /api/security/software-updates/devices/<id>/location - geolocate the device's last public IP
 */

import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { geolocateIp } from "@/lib/security/geolocation"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const { id } = await context.params

    const [device] = await db
      .select({ ip: softwareUpdateDevices.lastPublicIp })
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }
    if (!device.ip) {
      return NextResponse.json({ data: null, ip: null })
    }

    const geo = await geolocateIp(device.ip)
    return NextResponse.json({ data: geo, ip: device.ip })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error geolocating device:", error)
    return NextResponse.json({ error: "Failed to locate the device" }, { status: 500 })
  }
}
