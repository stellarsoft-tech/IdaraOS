/**
 * Reveal LAPS Password API
 * POST /api/security/my-elevation/grants/[id]/reveal - Fetch the device's LAPS password for an active credentials grant
 *
 * The password is fetched from Entra on demand and returned once. It is never stored or logged.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq, gt, lt, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import type { SessionPayload } from "@/lib/auth/session"
import { checkReveal, needsRecentAuth } from "@/lib/security/elevation"
import { getElevationSettings } from "@/lib/security/elevation-server"
import { LapsError, getLapsPassword } from "@/lib/security/elevation-laps"

interface RouteContext {
  params: Promise<{ id: string }>
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }

const lapsErrorStatus: Record<LapsError["code"], number> = {
  not_configured: 503,
  not_found: 404,
  forbidden: 502,
  graph_error: 502,
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myElevation.view())
    const { id } = await context.params
    const now = new Date()

    const [row] = await db
      .select({ grant: elevationGrants, request: elevationRequests })
      .from(elevationGrants)
      .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
      .where(and(eq(elevationGrants.id, id), eq(elevationGrants.orgId, session.orgId)))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 })
    }

    const settings = await getElevationSettings(session.orgId)
    const check = checkReveal(row.grant, session.userId, now, settings.maxRevealsPerGrant)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    // Session JWTs carry the standard `iat` claim
    const issuedAt = (session as SessionPayload & { iat?: number }).iat
    if (needsRecentAuth(settings, issuedAt, now)) {
      return NextResponse.json(
        {
          error: `Sign in with Microsoft again to reveal the password (required every ${settings.recentAuthMinutes} min)`,
          code: "reauth_required",
          reauthUrl: "/api/auth/login/azure-ad?reauth=1&returnTo=/security/my-elevation",
        },
        { status: 401 }
      )
    }

    let credential
    try {
      credential = await getLapsPassword(row.request.entraDeviceId)
    } catch (error) {
      if (error instanceof LapsError) {
        return NextResponse.json({ error: error.message }, { status: lapsErrorStatus[error.code] })
      }
      throw error
    }

    // Count the reveal only if the grant is still live and under the limit (guards concurrent reveals)
    const [counted] = await db
      .update(elevationGrants)
      .set({
        revealCount: sql`${elevationGrants.revealCount} + 1`,
        firstRevealedAt: sql`COALESCE(${elevationGrants.firstRevealedAt}, ${now.toISOString()}::timestamptz)`,
        lastRevealedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(elevationGrants.id, id),
        eq(elevationGrants.status, "active"),
        gt(elevationGrants.expiresAt, now),
        lt(elevationGrants.revealCount, settings.maxRevealsPerGrant)
      ))
      .returning({ revealCount: elevationGrants.revealCount })
    if (!counted) {
      return NextResponse.json({ error: "This grant has ended or reached its reveal limit" }, { status: 410 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "reveal",
        entityType: "elevation_grant",
        entityId: id,
        entityName: row.request.deviceName,
        description: `Revealed the LAPS password (${credential.accountName}) for ${row.request.deviceName} - reveal ${counted.revealCount} of ${settings.maxRevealsPerGrant}`,
      })
    }

    return NextResponse.json(
      {
        data: {
          accountName: credential.accountName,
          password: credential.password,
          deviceName: row.request.deviceName,
          expiresAt: row.grant.expiresAt,
          revealCount: counted.revealCount,
        },
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revealing LAPS password:", error)
    return NextResponse.json({ error: "Failed to reveal the password" }, { status: 500, headers: NO_STORE })
  }
}
