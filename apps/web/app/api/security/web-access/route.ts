/**
 * Website access approvals (admin)
 * GET /api/security/web-access - all website-access requests for the org (pending first)
 *
 * Gated by the device-policy edit permission - the same people who manage web filtering approve
 * exceptions to it.
 */

import { NextResponse } from "next/server"
import { alias } from "drizzle-orm/pg-core"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { webAccessRequests, users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { WEB_ACCESS_DURATION_OPTIONS, expireDueWebAccess } from "@/lib/security/web-access-server"

const requester = alias(users, "requester")
const decider = alias(users, "decider")

export async function GET() {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    await expireDueWebAccess(new Date(), session.orgId)

    const rows = await db
      .select({
        request: webAccessRequests,
        requesterName: requester.name,
        requesterEmail: requester.email,
        deciderName: decider.name,
      })
      .from(webAccessRequests)
      .innerJoin(requester, eq(webAccessRequests.requesterId, requester.id))
      .leftJoin(decider, eq(webAccessRequests.decidedById, decider.id))
      .where(eq(webAccessRequests.orgId, session.orgId))
      .orderBy(
        sql`CASE WHEN ${webAccessRequests.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(webAccessRequests.createdAt)
      )
      .limit(200)

    const data = rows.map(({ request, requesterName, requesterEmail, deciderName }) => ({
      id: request.id,
      domain: request.domain,
      requesterName,
      requesterEmail,
      reason: request.reason,
      requestedMinutes: request.requestedMinutes,
      status: request.status,
      decidedByName: deciderName,
      decidedAt: request.decidedAt,
      decisionNote: request.decisionNote,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
    }))

    return NextResponse.json({
      data,
      stats: { pending: data.filter((d) => d.status === "pending").length },
      options: { durationOptions: WEB_ACCESS_DURATION_OPTIONS },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching website access approvals:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}
