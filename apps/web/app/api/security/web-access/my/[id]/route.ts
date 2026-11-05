/**
 * Cancel my own website-access request
 * DELETE /api/security/web-access/my/<id> - withdraw a pending request
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { webAccessRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.myElevation.create())
    const { id } = await context.params
    const [updated] = await db
      .update(webAccessRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(webAccessRequests.id, id),
          eq(webAccessRequests.requesterId, session.userId),
          eq(webAccessRequests.orgId, session.orgId),
          eq(webAccessRequests.status, "pending")
        )
      )
      .returning()
    if (!updated) {
      return NextResponse.json({ error: "Request not found or already decided" }, { status: 404 })
    }
    return NextResponse.json({ data: { id: updated.id, status: updated.status } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error cancelling website access request:", error)
    return NextResponse.json({ error: "Failed to cancel request" }, { status: 500 })
  }
}
