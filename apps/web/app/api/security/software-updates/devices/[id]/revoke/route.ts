/**
 * Revoke Updater Device API
 * POST /api/security/software-updates/devices/[id]/revoke - Stop accepting this device's check-ins (logs are kept)
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params

    const [device] = await db
      .update(softwareUpdateDevices)
      .set({ status: "revoked", runRequestedAt: null, runRequestedById: null, updatedAt: new Date() })
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .returning({ id: softwareUpdateDevices.id, hostname: softwareUpdateDevices.hostname })
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "revoke",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Revoked ${device.hostname} from software updates`,
      })
    }

    return NextResponse.json({ data: device })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revoking updater device:", error)
    return NextResponse.json({ error: "Failed to revoke the device" }, { status: 500 })
  }
}
