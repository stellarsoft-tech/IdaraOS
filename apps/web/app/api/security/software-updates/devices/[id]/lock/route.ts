/**
 * Lock a device's internet
 * POST /api/security/software-updates/devices/<id>/lock - quarantine now (agent blocks all but IdaraOS)
 */

import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const now = new Date()

    const [updated] = await db
      .update(softwareUpdateDevices)
      .set({ quarantineManual: true, quarantinedAt: now, updatedAt: now })
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .returning({ id: softwareUpdateDevices.id, hostname: softwareUpdateDevices.hostname })
    if (!updated) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "internet_locked",
        entityType: "software_update_device",
        entityId: id,
        entityName: updated.hostname,
        description: `Quarantined ${updated.hostname} - internet blocked except IdaraOS`,
      })
    }
    return NextResponse.json({ data: { id: updated.id, quarantineManual: true } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error locking device internet:", error)
    return NextResponse.json({ error: "Failed to lock the device" }, { status: 500 })
  }
}
