/**
 * Device web filtering
 * GET /api/security/software-updates/devices/<id>/web-filtering
 *   - blocked-site attempts the agent reported + the signed-in member's website-access requests
 */

import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices, webAccessRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { expireDueWebAccess } from "@/lib/security/web-access-server"
import { listWebBlockEvents } from "@/lib/security/web-block-server"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const { id } = await context.params

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    await expireDueWebAccess(new Date(), session.orgId)

    const blockEvents = await listWebBlockEvents(device.id)
    const accessRequests = device.userId
      ? (
          await db
            .select()
            .from(webAccessRequests)
            .where(and(eq(webAccessRequests.requesterId, device.userId), eq(webAccessRequests.orgId, session.orgId)))
            .orderBy(desc(webAccessRequests.createdAt))
            .limit(50)
        ).map((r) => ({
          id: r.id,
          domain: r.domain,
          status: r.status,
          requestedMinutes: r.requestedMinutes,
          reason: r.reason,
          decisionNote: r.decisionNote,
          decidedAt: r.decidedAt,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
        }))
      : []

    return NextResponse.json({ blockEvents, accessRequests })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching device web filtering:", error)
    return NextResponse.json({ error: "Failed to fetch web filtering" }, { status: 500 })
  }
}
