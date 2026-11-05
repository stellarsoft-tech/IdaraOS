/**
 * Approve a website-access request (admin)
 * POST /api/security/web-access/<id>/approve - grant a time-boxed exception
 *
 * Sets a window (expiresAt); until it passes, the domain is merged into the member's web-filtering
 * allowlist at check-in, so the agent unblocks it. When it passes the agent re-blocks the site.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { webAccessRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { WEB_ACCESS_MAX_MINUTES } from "@/lib/security/web-access-server"

const approveSchema = z.object({
  minutes: z.number().int().positive().max(WEB_ACCESS_MAX_MINUTES).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const parsed = approveSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(webAccessRequests)
      .where(and(eq(webAccessRequests.id, id), eq(webAccessRequests.orgId, session.orgId)))
      .limit(1)
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "This request has already been decided" }, { status: 409 })
    }

    const minutes = parsed.data.minutes ?? existing.requestedMinutes
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > WEB_ACCESS_MAX_MINUTES) {
      return NextResponse.json({ error: "Choose a valid duration" }, { status: 400 })
    }
    const note = parsed.data.note?.trim() || null
    const now = new Date()
    const expiresAt = new Date(now.getTime() + minutes * 60_000)

    const [updated] = await db
      .update(webAccessRequests)
      .set({
        status: "approved",
        decidedById: session.userId,
        decidedAt: now,
        decisionNote: note,
        expiresAt,
        updatedAt: now,
      })
      .where(and(eq(webAccessRequests.id, id), eq(webAccessRequests.status, "pending")))
      .returning()
    if (!updated) {
      return NextResponse.json({ error: "This request has already been decided" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "approve",
        entityType: "web_access_request",
        entityId: id,
        entityName: existing.domain,
        current: { minutes, expiresAt: expiresAt.toISOString(), note },
        description: `Approved website access to ${existing.domain} for ${minutes} min`,
      })
    }

    return NextResponse.json({ data: { id: updated.id, status: updated.status, expiresAt: updated.expiresAt } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error approving website access request:", error)
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 })
  }
}
