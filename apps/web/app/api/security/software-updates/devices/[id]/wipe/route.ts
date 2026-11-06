/**
 * Device remote wipe - Owner-only factory reset
 * POST   /api/security/software-updates/devices/<id>/wipe  - queue "Reset this PC - remove everything"
 * DELETE /api/security/software-updates/devices/<id>/wipe  - cancel a queued wipe (before it dispatches)
 *
 * IRREVERSIBLE. Owner role only, requires the device hostname as confirmation, held briefly so it can
 * still be cancelled before the device picks it up, and fully audited.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { cancelDeviceWipe, queueDeviceWipe } from "@/lib/security/agent-server"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    if (session.role !== "Owner") {
      return NextResponse.json({ error: "Only an Owner can reset a device" }, { status: 403 })
    }
    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as { confirm?: unknown }

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    if (device.status !== "active") return NextResponse.json({ error: "This device isn't active" }, { status: 409 })
    if (device.entraDeviceId || !device.machineId) {
      return NextResponse.json({ error: "Reset is only available for IdaraOS Agent devices" }, { status: 409 })
    }
    if (typeof body.confirm !== "string" || body.confirm.trim() !== device.hostname) {
      return NextResponse.json({ error: "Type the device hostname exactly to confirm the reset" }, { status: 400 })
    }

    const result = await queueDeviceWipe(device)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "device_wipe_queued",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Queued a factory reset (remove everything) on ${device.hostname}`,
      })
    }
    return NextResponse.json({ data: { jobId: result.jobId } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error queuing device reset:", error)
    return NextResponse.json({ error: "Failed to queue the reset" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    if (session.role !== "Owner") {
      return NextResponse.json({ error: "Only an Owner can cancel a reset" }, { status: 403 })
    }
    const { id } = await context.params

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

    const cancelled = await cancelDeviceWipe(device)
    if (!cancelled) {
      return NextResponse.json({ error: "No cancellable reset is queued (it may have already started)" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "device_wipe_cancelled",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Cancelled the queued reset on ${device.hostname}`,
      })
    }
    return NextResponse.json({ data: { cancelled: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error cancelling device reset:", error)
    return NextResponse.json({ error: "Failed to cancel the reset" }, { status: 500 })
  }
}
