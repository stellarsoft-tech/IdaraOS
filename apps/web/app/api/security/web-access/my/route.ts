/**
 * My website access API
 * GET  /api/security/web-access/my - my website-access requests + duration options
 * POST /api/security/web-access/my - request temporary access to a site the filter blocks
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, desc, eq, gt, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { webAccessRequests, type WebAccessRequest } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { normalizeDomainPattern } from "@/lib/security/device-policies"
import { WEB_ACCESS_DURATION_OPTIONS, WEB_ACCESS_MAX_MINUTES, expireDueWebAccess } from "@/lib/security/web-access-server"

const createSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  minutes: z.number().int().positive().max(WEB_ACCESS_MAX_MINUTES),
  reason: z.string().trim().max(500).optional().nullable(),
})

function serialize(r: WebAccessRequest) {
  return {
    id: r.id,
    domain: r.domain,
    reason: r.reason,
    requestedMinutes: r.requestedMinutes,
    status: r.status,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }
}

export async function GET() {
  try {
    const session = await requirePermission(...P.security.myElevation.view())
    await expireDueWebAccess(new Date(), session.orgId)
    const rows = await db
      .select()
      .from(webAccessRequests)
      .where(and(eq(webAccessRequests.requesterId, session.userId), eq(webAccessRequests.orgId, session.orgId)))
      .orderBy(desc(webAccessRequests.createdAt))
      .limit(50)
    return NextResponse.json({ data: rows.map(serialize), options: { durationOptions: WEB_ACCESS_DURATION_OPTIONS } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching website access requests:", error)
    return NextResponse.json({ error: "Failed to fetch your requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myElevation.create())
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 })
    }
    const domain = normalizeDomainPattern(parsed.data.domain)
    if (!domain) {
      return NextResponse.json({ error: "Enter a valid website domain, e.g. example.com" }, { status: 400 })
    }
    const reason = parsed.data.reason?.trim() || null
    const now = new Date()

    // One open request (pending or still-live) per domain
    const [open] = await db
      .select({ id: webAccessRequests.id })
      .from(webAccessRequests)
      .where(
        and(
          eq(webAccessRequests.requesterId, session.userId),
          eq(webAccessRequests.orgId, session.orgId),
          eq(webAccessRequests.domain, domain),
          or(
            eq(webAccessRequests.status, "pending"),
            and(eq(webAccessRequests.status, "approved"), gt(webAccessRequests.expiresAt, now))
          )
        )
      )
      .limit(1)
    if (open) {
      return NextResponse.json({ error: `You already have an open request or active access for ${domain}` }, { status: 409 })
    }

    const [created] = await db
      .insert(webAccessRequests)
      .values({ orgId: session.orgId, requesterId: session.userId, domain, reason, requestedMinutes: parsed.data.minutes })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.software-updates", "web_access_request", {
        id: created.id,
        name: `${domain} - ${session.name}`,
        domain,
        requestedMinutes: parsed.data.minutes,
        reason,
      })
    }
    return NextResponse.json({ data: serialize(created) }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating website access request:", error)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
