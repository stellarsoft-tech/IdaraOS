/**
 * Revoke Admin Access Grant API
 * POST /api/security/elevation/grants/[id]/revoke - End an active grant now (rotates a revealed password)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { rotationStatusAfterEnd } from "@/lib/security/elevation"
import { expireDueGrants, rotateGrantPassword } from "@/lib/security/elevation-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const revokeSchema = z.object({
  reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional().nullable(),
})

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.elevation.edit())
    const { id } = await context.params

    const parsed = revokeSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const reason = parsed.data.reason?.trim() || null

    const now = new Date()
    await expireDueGrants(now, session.orgId)

    const [row] = await db
      .select({ grant: elevationGrants, request: elevationRequests })
      .from(elevationGrants)
      .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
      .where(and(eq(elevationGrants.id, id), eq(elevationGrants.orgId, session.orgId)))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 })
    }

    const [revoked] = await db
      .update(elevationGrants)
      .set({
        status: "revoked",
        endedAt: now,
        endReason: reason ? `revoked: ${reason}` : "revoked",
        revokedById: session.userId,
        rotationStatus: rotationStatusAfterEnd(row.grant),
        updatedAt: now,
      })
      .where(and(eq(elevationGrants.id, id), eq(elevationGrants.status, "active")))
      .returning()
    if (!revoked) {
      return NextResponse.json({ error: "This grant has already ended" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "revoke",
        entityType: "elevation_grant",
        entityId: id,
        entityName: row.request.deviceName,
        current: { reason },
        description: `Revoked admin access on ${row.request.deviceName}`,
      })
    }

    // Rotate straight away rather than waiting for the next sweep
    if (revoked.rotationStatus === "pending") {
      await rotateGrantPassword(revoked, row.request.intuneDeviceId, now)
    }

    return NextResponse.json({ data: revoked })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revoking admin access grant:", error)
    return NextResponse.json({ error: "Failed to revoke access" }, { status: 500 })
  }
}
