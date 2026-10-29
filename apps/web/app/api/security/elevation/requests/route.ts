/**
 * Admin Access Approvals API
 * GET /api/security/elevation/requests - All admin access requests with their grants (pending first)
 */

import { NextResponse } from "next/server"
import { alias } from "drizzle-orm/pg-core"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests, users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { expireDueGrants, getElevationSettings } from "@/lib/security/elevation-server"

const requester = alias(users, "requester")
const decider = alias(users, "decider")

export async function GET() {
  try {
    const session = await requirePermission(...P.security.elevation.view())
    await expireDueGrants(new Date(), session.orgId)

    const [settings, rows] = await Promise.all([
      getElevationSettings(session.orgId),
      db
        .select({
          request: elevationRequests,
          grant: elevationGrants,
          requesterName: requester.name,
          requesterEmail: requester.email,
          deciderName: decider.name,
        })
        .from(elevationRequests)
        .innerJoin(requester, eq(elevationRequests.requesterId, requester.id))
        .leftJoin(decider, eq(elevationRequests.decidedById, decider.id))
        .leftJoin(elevationGrants, eq(elevationGrants.requestId, elevationRequests.id))
        .where(eq(elevationRequests.orgId, session.orgId))
        .orderBy(
          sql`CASE WHEN ${elevationRequests.status} = 'pending' THEN 0 ELSE 1 END`,
          desc(elevationRequests.createdAt)
        )
        .limit(200),
    ])

    const data = rows.map(({ request, grant, requesterName, requesterEmail, deciderName }) => ({
      id: request.id,
      requesterId: request.requesterId,
      requesterName,
      requesterEmail,
      assetId: request.assetId,
      deviceName: request.deviceName,
      intuneManaged: !!request.intuneDeviceId,
      requestedMinutes: request.requestedMinutes,
      reason: request.reason,
      status: request.status,
      decidedByName: deciderName,
      decidedAt: request.decidedAt,
      decisionNote: request.decisionNote,
      createdAt: request.createdAt,
      isOwnRequest: request.requesterId === session.userId,
      grant: grant && {
        id: grant.id,
        mode: grant.mode,
        status: grant.status,
        startsAt: grant.startsAt,
        expiresAt: grant.expiresAt,
        endedAt: grant.endedAt,
        endReason: grant.endReason,
        revealCount: grant.revealCount,
        lastRevealedAt: grant.lastRevealedAt,
        rotationStatus: grant.rotationStatus,
        rotationError: grant.rotationError,
        rotationVerifiedAt: grant.rotationVerifiedAt,
      },
    }))

    return NextResponse.json({
      data,
      stats: {
        pending: data.filter((d) => d.status === "pending").length,
        active: data.filter((d) => d.grant?.status === "active").length,
        rotationIssues: data.filter((d) => d.grant?.rotationStatus === "failed").length,
      },
      settings: {
        credentialModeEnabled: settings.credentialModeEnabled,
        maxMinutes: settings.maxMinutes,
      },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching admin access requests:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}
