/**
 * Update All IdaraOS Agents
 * POST /api/security/software-updates/update-all-agents
 *
 * Flags every active agent device to update to the shipped agent version at its next check-in.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

export async function POST(_request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())

    const now = new Date()
    const updated = await db
      .update(softwareUpdateDevices)
      .set({ agentUpdateRequestedAt: now, updatedAt: now })
      .where(
        and(
          eq(softwareUpdateDevices.orgId, session.orgId),
          eq(softwareUpdateDevices.status, "active"),
          // IdaraOS Agent devices only (a MachineGuid and no Entra device ID)
          isNotNull(softwareUpdateDevices.machineId),
          isNull(softwareUpdateDevices.entraDeviceId)
        )
      )
      .returning({ id: softwareUpdateDevices.id })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "agent_update_requested_all",
        entityType: "software_update_device",
        entityId: session.orgId,
        entityName: "All agent devices",
        description: `Requested agent self-update on ${updated.length} device(s)`,
      })
    }

    return NextResponse.json({ data: { count: updated.length } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error requesting agent updates:", error)
    return NextResponse.json({ error: "Failed to request agent updates" }, { status: 500 })
  }
}
