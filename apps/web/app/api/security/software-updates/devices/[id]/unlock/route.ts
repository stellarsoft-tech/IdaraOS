/**
 * Unlock a device's internet
 * POST /api/security/software-updates/devices/<id>/unlock - clear a manual quarantine
 *
 * Clears the manual lock. If the device is still non-compliant past the grace period and quarantine
 * is enabled, the next check-in re-quarantines it automatically.
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
      .set({ quarantineManual: false, quarantinedAt: null, updatedAt: now })
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .returning({ id: softwareUpdateDevices.id, hostname: softwareUpdateDevices.hostname })
    if (!updated) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "internet_unlocked",
        entityType: "software_update_device",
        entityId: id,
        entityName: updated.hostname,
        description: `Cleared the internet quarantine on ${updated.hostname}`,
      })
    }
    return NextResponse.json({ data: { id: updated.id, quarantineManual: false } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error unlocking device internet:", error)
    return NextResponse.json({ error: "Failed to unlock the device" }, { status: 500 })
  }
}
