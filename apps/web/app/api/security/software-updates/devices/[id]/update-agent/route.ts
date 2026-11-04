/**
 * Update IdaraOS Agent On One Device
 * POST /api/security/software-updates/devices/[id]/update-agent
 *
 * Flags the device to update to the agent version this server ships, at its next check-in. The agent
 * pulls the server's own script and verifies it; no code or URL is supplied here.
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
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    if (device.status !== "active") {
      return NextResponse.json({ error: "This device was revoked" }, { status: 409 })
    }
    if (device.entraDeviceId || !device.machineId) {
      return NextResponse.json({ error: "Self-update is only for IdaraOS Agent devices" }, { status: 409 })
    }

    const now = new Date()
    await db
      .update(softwareUpdateDevices)
      .set({ agentUpdateRequestedAt: now, updatedAt: now })
      .where(eq(softwareUpdateDevices.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "agent_update_requested",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Requested agent self-update on ${device.hostname}`,
      })
    }

    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error requesting agent update:", error)
    return NextResponse.json({ error: "Failed to request the agent update" }, { status: 500 })
  }
}
