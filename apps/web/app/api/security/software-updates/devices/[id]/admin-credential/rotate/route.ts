/**
 * Rotate the managed local admin password for a device
 * POST /api/security/software-updates/devices/[id]/admin-credential/rotate
 *
 * Flags the device to rotate its managed admin password at its next check-in (the agent sets a new
 * random password and re-escrows it). The current password stops working once that happens. Audited;
 * requires the edit permission.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { requestAdminRotation } from "@/lib/security/admin-credential-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

    await requestAdminRotation(session.orgId, id)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "admin_password_rotation_requested",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Requested a managed admin password rotation for ${device.hostname}`,
      })
    }

    return NextResponse.json({ data: { id, rotateRequested: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error requesting admin rotation:", error)
    return NextResponse.json({ error: "Failed to request the rotation" }, { status: 500 })
  }
}
