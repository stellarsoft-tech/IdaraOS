/**
 * Deny a website-access request (admin)
 * POST /api/security/web-access/<id>/deny
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { webAccessRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

const denySchema = z.object({ note: z.string().trim().max(500).optional().nullable() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params
    const parsed = denySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }
    const note = parsed.data.note?.trim() || null
    const now = new Date()

    const [updated] = await db
      .update(webAccessRequests)
      .set({ status: "denied", decidedById: session.userId, decidedAt: now, decisionNote: note, updatedAt: now })
      .where(and(eq(webAccessRequests.id, id), eq(webAccessRequests.orgId, session.orgId), eq(webAccessRequests.status, "pending")))
      .returning()
    if (!updated) {
      return NextResponse.json({ error: "Request not found or already decided" }, { status: 404 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "deny",
        entityType: "web_access_request",
        entityId: id,
        entityName: updated.domain,
        current: { note },
        description: `Denied website access to ${updated.domain}`,
      })
    }

    return NextResponse.json({ data: { id: updated.id, status: updated.status } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error denying website access request:", error)
    return NextResponse.json({ error: "Failed to deny request" }, { status: 500 })
  }
}
