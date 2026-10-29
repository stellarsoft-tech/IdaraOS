/**
 * Rotate LAPS Password API
 * POST /api/security/elevation/grants/[id]/rotate - Request a LAPS rotation for an ended credentials grant now
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { rotateGrantPassword } from "@/lib/security/elevation-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.elevation.edit())
    const { id } = await context.params

    const [row] = await db
      .select({ grant: elevationGrants, request: elevationRequests })
      .from(elevationGrants)
      .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
      .where(and(eq(elevationGrants.id, id), eq(elevationGrants.orgId, session.orgId)))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 })
    }
    if (row.grant.mode !== "credentials") {
      return NextResponse.json({ error: "Only credentials grants have a password to rotate" }, { status: 400 })
    }
    if (row.grant.status === "active") {
      return NextResponse.json({ error: "Revoke the grant first - rotating now would lock the user out mid-task" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "rotate",
        entityType: "elevation_grant",
        entityId: id,
        entityName: row.request.deviceName,
        description: `Manually requested LAPS rotation for ${row.request.deviceName}`,
      })
    }

    const ok = await rotateGrantPassword(row.grant, row.request.intuneDeviceId)
    const [updated] = await db.select().from(elevationGrants).where(eq(elevationGrants.id, id)).limit(1)

    if (!ok) {
      return NextResponse.json({ error: updated.rotationError ?? "Rotation request failed", data: updated }, { status: 502 })
    }
    return NextResponse.json({ data: updated })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error rotating LAPS password:", error)
    return NextResponse.json({ error: "Failed to request rotation" }, { status: 500 })
  }
}
