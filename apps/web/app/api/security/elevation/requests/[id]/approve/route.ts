/**
 * Approve Admin Access Request API
 * POST /api/security/elevation/requests/[id]/approve - Approve and create a time-boxed grant
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests, elevationGrantModeValues } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { ACTIONS, MODULES, P } from "@/lib/rbac/resources"
import { checkUserPermission } from "@/lib/rbac/server"
import { checkApproval, computeGrantWindow, elevationGrantModeLabels, formatMinutes } from "@/lib/security/elevation"
import { getElevationSettings } from "@/lib/security/elevation-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  mode: z.enum(elevationGrantModeValues),
  minutes: z.number().int(),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer").optional().nullable(),
})

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.elevation.edit())
    const { id } = await context.params

    const parsed = approveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const { mode, minutes } = parsed.data
    const note = parsed.data.note?.trim() || null

    const [existing] = await db
      .select()
      .from(elevationRequests)
      .where(and(eq(elevationRequests.id, id), eq(elevationRequests.orgId, session.orgId)))
      .limit(1)
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const [settings, canUseCredentials] = await Promise.all([
      getElevationSettings(session.orgId),
      checkUserPermission(session.userId, MODULES.SECURITY_ELEVATION_CREDENTIALS, ACTIONS.EDIT),
    ])
    const check = checkApproval({
      request: existing,
      deciderId: session.userId,
      mode,
      minutes,
      settings,
      canUseCredentials,
    })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const now = new Date()
    const { startsAt, expiresAt } = computeGrantWindow(now, minutes)

    const result = await db.transaction(async (tx) => {
      // Conditional update guards against two approvers deciding at once
      const [approved] = await tx
        .update(elevationRequests)
        .set({ status: "approved", decidedById: session.userId, decidedAt: now, decisionNote: note, updatedAt: now })
        .where(and(eq(elevationRequests.id, id), eq(elevationRequests.status, "pending")))
        .returning()
      if (!approved) return null

      const [grant] = await tx
        .insert(elevationGrants)
        .values({
          orgId: session.orgId,
          requestId: id,
          userId: existing.requesterId,
          approvedById: session.userId,
          mode,
          startsAt,
          expiresAt,
        })
        .returning()
      return { request: approved, grant }
    })

    if (!result) {
      return NextResponse.json({ error: "This request has already been decided" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "approve",
        entityType: "elevation_request",
        entityId: id,
        entityName: existing.deviceName,
        current: { mode, minutes, expiresAt: expiresAt.toISOString(), note },
        description: `Approved admin access on ${existing.deviceName} for ${formatMinutes(minutes)} (${elevationGrantModeLabels[mode]})`,
      })
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error approving admin access request:", error)
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 })
  }
}
