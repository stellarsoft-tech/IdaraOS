/**
 * Deny Admin Access Request API
 * POST /api/security/elevation/requests/[id]/deny - Reject a pending request
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { checkCanDecide } from "@/lib/security/elevation"

interface RouteContext {
  params: Promise<{ id: string }>
}

const denySchema = z.object({
  note: z.string().trim().max(500, "Note must be 500 characters or fewer").optional().nullable(),
})

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.elevation.edit())
    const { id } = await context.params

    const parsed = denySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const note = parsed.data.note?.trim() || null

    const [existing] = await db
      .select()
      .from(elevationRequests)
      .where(and(eq(elevationRequests.id, id), eq(elevationRequests.orgId, session.orgId)))
      .limit(1)
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const check = checkCanDecide(existing, session.userId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const now = new Date()
    const [denied] = await db
      .update(elevationRequests)
      .set({ status: "denied", decidedById: session.userId, decidedAt: now, decisionNote: note, updatedAt: now })
      .where(and(eq(elevationRequests.id, id), eq(elevationRequests.status, "pending")))
      .returning()
    if (!denied) {
      return NextResponse.json({ error: "This request has already been decided" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "deny",
        entityType: "elevation_request",
        entityId: id,
        entityName: existing.deviceName,
        current: { note },
        description: `Denied admin access request for ${existing.deviceName}`,
      })
    }

    return NextResponse.json({ data: denied })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error denying admin access request:", error)
    return NextResponse.json({ error: "Failed to deny request" }, { status: 500 })
  }
}
