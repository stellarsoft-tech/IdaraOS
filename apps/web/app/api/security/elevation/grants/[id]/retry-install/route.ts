/**
 * Retry App Install API
 * POST /api/security/elevation/grants/[id]/retry-install - Re-add the device to the install group with a new deadline
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationGrants, elevationRequests, softwareCatalog, softwareInstalls } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { retryInstall } from "@/lib/security/software-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.elevation.edit())
    const { id } = await context.params

    const [row] = await db
      .select({
        grant: elevationGrants,
        install: softwareInstalls,
        deviceName: elevationRequests.deviceName,
        deadlineHours: softwareCatalog.installDeadlineHours,
      })
      .from(elevationGrants)
      .innerJoin(elevationRequests, eq(elevationGrants.requestId, elevationRequests.id))
      .innerJoin(softwareInstalls, eq(softwareInstalls.grantId, elevationGrants.id))
      .leftJoin(softwareCatalog, eq(softwareInstalls.catalogAppId, softwareCatalog.id))
      .where(and(eq(elevationGrants.id, id), eq(elevationGrants.orgId, session.orgId)))
      .limit(1)
    if (!row || row.grant.mode !== "app_install") {
      return NextResponse.json({ error: "Install not found" }, { status: 404 })
    }
    if (row.grant.status === "revoked" || row.install.status === "installed" || row.install.status === "cancelled") {
      return NextResponse.json({ error: "This install can't be retried" }, { status: 409 })
    }

    const now = new Date()
    const deadline = new Date(now.getTime() + (row.deadlineHours ?? 24) * 60 * 60_000)
    const install = await retryInstall(id, deadline, now)
    if (!install) {
      return NextResponse.json({ error: "This install can't be retried" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "retry_install",
        entityType: "elevation_grant",
        entityId: id,
        entityName: row.deviceName,
        description: `Retried install of ${row.install.appName} on ${row.deviceName}`,
      })
    }

    return NextResponse.json({ data: install })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error retrying install:", error)
    return NextResponse.json({ error: "Failed to retry the install" }, { status: 500 })
  }
}
