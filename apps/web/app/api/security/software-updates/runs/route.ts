/**
 * Software Update Runs API
 * GET /api/security/software-updates/runs?deviceId=&status=&limit= - Update log across devices (newest first)
 */

import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices, softwareUpdateRuns, softwareUpdateRunStatusValues, users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const params = request.nextUrl.searchParams

    const deviceId = params.get("deviceId")
    const status = params.get("status")
    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 500)

    const rows = await db
      .select({
        id: softwareUpdateRuns.id,
        deviceId: softwareUpdateRuns.deviceId,
        hostname: softwareUpdateDevices.hostname,
        trigger: softwareUpdateRuns.trigger,
        requestedByName: users.name,
        status: softwareUpdateRuns.status,
        packages: softwareUpdateRuns.packages,
        results: softwareUpdateRuns.results,
        updatedCount: softwareUpdateRuns.updatedCount,
        failedCount: softwareUpdateRuns.failedCount,
        rebootRequired: softwareUpdateRuns.rebootRequired,
        error: softwareUpdateRuns.error,
        startedAt: softwareUpdateRuns.startedAt,
        finishedAt: softwareUpdateRuns.finishedAt,
      })
      .from(softwareUpdateRuns)
      .innerJoin(softwareUpdateDevices, eq(softwareUpdateRuns.deviceId, softwareUpdateDevices.id))
      .leftJoin(users, eq(softwareUpdateRuns.requestedById, users.id))
      .where(and(
        eq(softwareUpdateRuns.orgId, session.orgId),
        deviceId && GUID_PATTERN.test(deviceId) ? eq(softwareUpdateRuns.deviceId, deviceId) : undefined,
        status && (softwareUpdateRunStatusValues as readonly string[]).includes(status)
          ? eq(softwareUpdateRuns.status, status as (typeof softwareUpdateRunStatusValues)[number])
          : undefined
      ))
      .orderBy(desc(softwareUpdateRuns.startedAt))
      .limit(limit)

    return NextResponse.json({ data: rows })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching update runs:", error)
    return NextResponse.json({ error: "Failed to fetch update runs" }, { status: 500 })
  }
}
