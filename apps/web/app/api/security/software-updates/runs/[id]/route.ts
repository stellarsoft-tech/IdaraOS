/**
 * Software Update Run API
 * GET /api/security/software-updates/runs/[id] - One run with its per-package results and device log
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices, softwareUpdateRuns } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const { id } = await context.params

    const [row] = await db
      .select({ run: softwareUpdateRuns, hostname: softwareUpdateDevices.hostname })
      .from(softwareUpdateRuns)
      .innerJoin(softwareUpdateDevices, eq(softwareUpdateRuns.deviceId, softwareUpdateDevices.id))
      .where(and(eq(softwareUpdateRuns.id, id), eq(softwareUpdateRuns.orgId, session.orgId)))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    return NextResponse.json({ data: { ...row.run, hostname: row.hostname } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching update run:", error)
    return NextResponse.json({ error: "Failed to fetch the run" }, { status: 500 })
  }
}
