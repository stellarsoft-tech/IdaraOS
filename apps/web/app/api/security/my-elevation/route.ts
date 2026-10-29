/**
 * My Admin Access API
 * GET  /api/security/my-elevation - My devices, my requests and grants, approved software, and request options
 * POST /api/security/my-elevation - Request temporary admin access, or an approved app install, for one of my devices
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, elevationGrants, elevationRequests, softwareCatalog, softwareInstalls, users } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { allowedDurations, checkRequestedMinutes, formatMinutes } from "@/lib/security/elevation"
import { expireDueGrants, getElevationSettings } from "@/lib/security/elevation-server"
import { ensureDefaultCatalog } from "@/lib/security/software-server"
import { notifyNewRequest } from "@/lib/security/elevation-notify"

const createRequestSchema = z.object({
  assetId: z.string().uuid("Choose a device"),
  // Install an approved catalog app...
  catalogAppId: z.string().uuid().optional().nullable(),
  // ...or temporary admin access (credentials)
  minutes: z.number().int().optional().nullable(),
  appName: z.string().trim().max(200, "App name must be 200 characters or fewer").optional().nullable(),
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
    await ensureDefaultCatalog(session.orgId)

    const [settings, devices, rows, catalog] = await Promise.all([
      getElevationSettings(session.orgId),
      getMyDevices(session.userId, session.orgId),
      db
        .select({ request: elevationRequests, grant: elevationGrants, install: softwareInstalls })
        .from(elevationRequests)
        .leftJoin(elevationGrants, eq(elevationGrants.requestId, elevationRequests.id))
        .leftJoin(softwareInstalls, eq(softwareInstalls.grantId, elevationGrants.id))
        .where(and(
          eq(elevationRequests.requesterId, session.userId),
          eq(elevationRequests.orgId, session.orgId)
        ))
        .orderBy(desc(elevationRequests.createdAt))
        .limit(50),
      db
        .select({
          id: softwareCatalog.id,
          name: softwareCatalog.name,
          publisher: softwareCatalog.publisher,
          description: softwareCatalog.description,
          access: softwareCatalog.access,
          intuneAppId: softwareCatalog.intuneAppId,
          installGroupId: softwareCatalog.installGroupId,
        })
        .from(softwareCatalog)
        .where(and(eq(softwareCatalog.orgId, session.orgId), eq(softwareCatalog.enabled, true)))
        .orderBy(asc(softwareCatalog.name)),
    ])

    const data = rows.map(({ request, grant, install }) => ({
      id: request.id,
      assetId: request.assetId,
      deviceName: request.deviceName,
      catalogAppId: request.catalogAppId,
      appName: request.app?.name ?? null,
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
      install: install && {
        status: install.status,
        installedAt: install.installedAt,
      },
    }))

    return NextResponse.json({
      data,
      devices: devices.map(({ entraDeviceId: _e, intuneDeviceId, ...d }) => ({
        ...d,
        intuneManaged: !!intuneDeviceId,
      })),
      catalog: catalog.map(({ intuneAppId, installGroupId, ...app }) => ({
        ...app,
        // Requests are only possible once IT linked the app to an Intune install group
        requestable: app.access === "approval" && !!installGroupId,
        companyPortalUrl:
          app.access === "self_service" && intuneAppId ? `companyportal:ApplicationId=${intuneAppId}` : null,
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
    const { assetId, catalogAppId } = parsed.data
    const reason = parsed.data.reason?.trim() || null
    const appName = parsed.data.appName?.trim() || null

    const settings = await getElevationSettings(session.orgId)
    if (settings.requireReason && !reason) {
      return NextResponse.json({ error: "Tell the approver why you need this" }, { status: 400 })
    }

    const device = (await getMyDevices(session.userId, session.orgId)).find((d) => d.id === assetId)
    if (!device?.entraDeviceId) {
      return NextResponse.json(
        { error: "Device not found, not assigned to you, or not joined to Entra" },
        { status: 404 }
      )
    }

    // Install request for an approved catalog app
    let catalogApp: { id: string; name: string; publisher: string | null } | null = null
    let minutes: number | null = null
    if (catalogAppId) {
      const [app] = await db
        .select()
        .from(softwareCatalog)
        .where(and(eq(softwareCatalog.id, catalogAppId), eq(softwareCatalog.orgId, session.orgId)))
        .limit(1)
      if (!app || !app.enabled || app.access !== "approval") {
        return NextResponse.json({ error: "This app can't be requested" }, { status: 400 })
      }
      if (!app.installGroupId) {
        return NextResponse.json(
          { error: "IT hasn't set up this app in Intune yet - try again later" },
          { status: 400 }
        )
      }
      if (!device.intuneDeviceId) {
        return NextResponse.json({ error: "This device isn't managed by Intune" }, { status: 400 })
      }
      catalogApp = { id: app.id, name: app.name, publisher: app.publisher }
    } else {
      minutes = parsed.data.minutes ?? null
      if (minutes === null) {
        return NextResponse.json({ error: "Choose how long you need admin access" }, { status: 400 })
      }
      const minutesCheck = checkRequestedMinutes(minutes, settings)
      if (!minutesCheck.ok) {
        return NextResponse.json({ error: minutesCheck.error }, { status: minutesCheck.status })
      }
    }

    // One open request or live grant per device (per app for installs)
    const now = new Date()
    const [open] = await db
      .select({ id: elevationRequests.id })
      .from(elevationRequests)
      .leftJoin(elevationGrants, eq(elevationGrants.requestId, elevationRequests.id))
      .where(and(
        eq(elevationRequests.requesterId, session.userId),
        eq(elevationRequests.assetId, assetId),
        catalogApp ? eq(elevationRequests.catalogAppId, catalogApp.id) : isNull(elevationRequests.catalogAppId),
        or(
          eq(elevationRequests.status, "pending"),
          and(eq(elevationGrants.status, "active"), gt(elevationGrants.expiresAt, now))
        )
      ))
      .limit(1)
    if (open) {
      return NextResponse.json(
        {
          error: catalogApp
            ? `You already have an open request for ${catalogApp.name} on this device`
            : "You already have an open request or active access for this device",
        },
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
        catalogAppId: catalogApp?.id ?? null,
        app: catalogApp
          ? { name: catalogApp.name, ...(catalogApp.publisher && { publisher: catalogApp.publisher }) }
          : appName
            ? { name: appName }
            : null,
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
        app: created.app?.name ?? null,
        requestedMinutes: minutes,
        reason,
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    void notifyNewRequest(settings.teamsWebhookUrlEncrypted, {
      requesterName: session.name,
      requesterEmail: session.email,
      deviceName: device.name,
      summary: catalogApp ? `Install ${catalogApp.name}` : `Admin access for ${formatMinutes(minutes!)}${appName ? ` (${appName})` : ""}`,
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
