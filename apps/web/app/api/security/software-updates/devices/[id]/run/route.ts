/**
 * Run Updates On One Device API
 * POST /api/security/software-updates/devices/[id]/run - The device runs updates at its next check-in
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { requestRunNow } from "@/lib/security/software-updates-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params

    const [device] = await db
      .select({ id: softwareUpdateDevices.id, hostname: softwareUpdateDevices.hostname, status: softwareUpdateDevices.status })
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }
    if (device.status !== "active") {
      return NextResponse.json({ error: "This device was revoked" }, { status: 409 })
    }

    await requestRunNow(session.orgId, session.userId, id)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "run_now",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Requested updates on ${device.hostname}`,
      })
    }

    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error requesting device update:", error)
    return NextResponse.json({ error: "Failed to request updates" }, { status: 500 })
  }
}
