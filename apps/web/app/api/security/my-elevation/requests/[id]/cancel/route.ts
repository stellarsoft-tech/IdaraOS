/**
 * Cancel My Admin Access Request API
 * POST /api/security/my-elevation/requests/[id]/cancel - Withdraw a pending request
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myElevation.create())
    const { id } = await context.params

    const [cancelled] = await db
      .update(elevationRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(elevationRequests.id, id),
        eq(elevationRequests.orgId, session.orgId),
        eq(elevationRequests.requesterId, session.userId),
        eq(elevationRequests.status, "pending")
      ))
      .returning()

    if (!cancelled) {
      return NextResponse.json({ error: "Request not found or already decided" }, { status: 404 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "cancel",
        entityType: "elevation_request",
        entityId: id,
        entityName: cancelled.deviceName,
        description: `Cancelled admin access request for ${cancelled.deviceName}`,
      })
    }

    return NextResponse.json({ data: cancelled })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error cancelling admin access request:", error)
    return NextResponse.json({ error: "Failed to cancel request" }, { status: 500 })
  }
}
