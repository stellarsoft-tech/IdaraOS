/**
 * My Admin Access API
 * GET  /api/security/my-elevation - My devices, my requests and grants, and request options
 * POST /api/security/my-elevation - Request temporary admin access for one of my devices
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, desc, eq, gt, isNotNull, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, elevationGrants, elevationRequests, users } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { allowedDurations, checkRequestedMinutes } from "@/lib/security/elevation"
import { expireDueGrants, getElevationSettings } from "@/lib/security/elevation-server"
import { notifyNewRequest } from "@/lib/security/elevation-notify"

const createRequestSchema = z.object({
  assetId: z.string().uuid("Choose a device"),
  minutes: z.number().int(),
  reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional().nullable(),
})

/**
 * Devices assigned to the user (via their linked person) that Entra knows about
 */
async function getMyDevices(userId: string, orgId: string) {
  const [user] = await db
    .select({ personId: users.personId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user?.personId) return []

  return db
    .select({
      id: assets.id,
      name: assets.name,
      assetTag: assets.assetTag,
      model: assets.model,
      entraDeviceId: assets.entraDeviceId,
      intuneDeviceId: assets.intuneDeviceId,
    })
    .from(assets)
    .where(and(
      eq(assets.orgId, orgId),
      eq(assets.assignedToId, user.personId),
      isNotNull(assets.entraDeviceId)
    ))
    .orderBy(asc(assets.name))
}

export async function GET() {
  try {
    const session = await requirePermission(...P.security.myElevation.view())
    await expireDueGrants(new Date(), session.orgId)

    const [settings, devices, rows] = await Promise.all([
      getElevationSettings(session.orgId),
      getMyDevices(session.userId, session.orgId),
      db
        .select({ request: elevationRequests, grant: elevationGrants })
        .from(elevationRequests)
        .leftJoin(elevationGrants, eq(elevationGrants.requestId, elevationRequests.id))
        .where(and(
          eq(elevationRequests.requesterId, session.userId),
          eq(elevationRequests.orgId, session.orgId)
        ))
        .orderBy(desc(elevationRequests.createdAt))
        .limit(50),
    ])

    const data = rows.map(({ request, grant }) => ({
      id: request.id,
      assetId: request.assetId,
      deviceName: request.deviceName,
      requestedMinutes: request.requestedMinutes,
      reason: request.reason,
      status: request.status,
      decisionNote: request.decisionNote,
      decidedAt: request.decidedAt,
      createdAt: request.createdAt,
      grant: grant && {
        id: grant.id,
        mode: grant.mode,
        status: grant.status,
        startsAt: grant.startsAt,
        expiresAt: grant.expiresAt,
        endedAt: grant.endedAt,
        revealCount: grant.revealCount,
        rotationStatus: grant.rotationStatus,
      },
    }))

    return NextResponse.json({
      data,
      devices: devices.map(({ entraDeviceId: _e, intuneDeviceId, ...d }) => ({
        ...d,
        intuneManaged: !!intuneDeviceId,
      })),
      options: {
        durationOptions: allowedDurations(settings),
        requireReason: settings.requireReason,
        maxRevealsPerGrant: settings.maxRevealsPerGrant,
      },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching my admin access:", error)
    return NextResponse.json({ error: "Failed to fetch your admin access requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myElevation.create())

    const parsed = createRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const { assetId, minutes } = parsed.data
    const reason = parsed.data.reason?.trim() || null

    const settings = await getElevationSettings(session.orgId)
    const minutesCheck = checkRequestedMinutes(minutes, settings)
    if (!minutesCheck.ok) {
      return NextResponse.json({ error: minutesCheck.error }, { status: minutesCheck.status })
    }
    if (settings.requireReason && !reason) {
      return NextResponse.json({ error: "Tell the approver why you need admin access" }, { status: 400 })
    }

    const device = (await getMyDevices(session.userId, session.orgId)).find((d) => d.id === assetId)
    if (!device?.entraDeviceId) {
      return NextResponse.json(
        { error: "Device not found, not assigned to you, or not joined to Entra" },
        { status: 404 }
      )
    }

    // One open request or live grant per device at a time
    const now = new Date()
    const [open] = await db
      .select({ id: elevationRequests.id })
      .from(elevationRequests)
      .leftJoin(elevationGrants, eq(elevationGrants.requestId, elevationRequests.id))
      .where(and(
        eq(elevationRequests.requesterId, session.userId),
        eq(elevationRequests.assetId, assetId),
        or(
          eq(elevationRequests.status, "pending"),
          and(eq(elevationGrants.status, "active"), gt(elevationGrants.expiresAt, now))
        )
      ))
      .limit(1)
    if (open) {
      return NextResponse.json(
        { error: "You already have an open request or active access for this device" },
        { status: 409 }
      )
    }

    const [created] = await db
      .insert(elevationRequests)
      .values({
        orgId: session.orgId,
        requesterId: session.userId,
        assetId: device.id,
        deviceName: device.name,
        entraDeviceId: device.entraDeviceId,
        intuneDeviceId: device.intuneDeviceId,
        requestedMinutes: minutes,
        reason,
      })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.elevation", "elevation_request", {
        id: created.id,
        name: `${device.name} - ${session.name}`,
        deviceName: device.name,
        requestedMinutes: minutes,
        reason,
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    void notifyNewRequest(settings.teamsWebhookUrlEncrypted, {
      requesterName: session.name,
      requesterEmail: session.email,
      deviceName: device.name,
      requestedMinutes: minutes,
      reason,
      reviewUrl: `${appUrl}/security/elevation`,
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating admin access request:", error)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
