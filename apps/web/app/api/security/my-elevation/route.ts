/**
 * My Admin Access API
 * GET  /api/security/my-elevation - My devices, my requests and grants, approved software, and request options
 * POST /api/security/my-elevation - Request temporary admin access, or an approved app install, for one of my devices
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  assets,
  elevationGrants,
  elevationRequests,
  softwareCatalog,
  softwareInstalls,
  softwareUpdateDevices,
  users,
  type ElevationDeviceProvider,
} from "@/lib/db/schema"
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

interface MyDevice {
  id: string // asset ID
  name: string
  assetTag: string
  model: string | null
  entraDeviceId: string | null
  intuneDeviceId: string | null
  agentDeviceId: string | null
}

/**
 * My devices: intune provider - assets assigned to me (via my person) that Entra knows about;
 * agent provider - devices I linked by signing in to the IdaraOS Agent
 */
async function getMyDevices(userId: string, orgId: string, provider: ElevationDeviceProvider): Promise<MyDevice[]> {
  if (provider === "agent") {
    return db
      .select({
        id: assets.id,
        name: assets.name,
        assetTag: assets.assetTag,
        model: assets.model,
        entraDeviceId: softwareUpdateDevices.entraDeviceId,
        intuneDeviceId: softwareUpdateDevices.intuneDeviceId,
        agentDeviceId: softwareUpdateDevices.id,
      })
      .from(softwareUpdateDevices)
      .innerJoin(assets, eq(softwareUpdateDevices.assetId, assets.id))
      .where(and(
        eq(softwareUpdateDevices.orgId, orgId),
        eq(softwareUpdateDevices.userId, userId),
        eq(softwareUpdateDevices.status, "active")
      ))
      .orderBy(asc(assets.name))
  }

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
      agentDeviceId: sql<string | null>`NULL`,
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

    const settings = await getElevationSettings(session.orgId)
    const provider = settings.deviceProvider
    const [devices, rows, catalog] = await Promise.all([
      getMyDevices(session.userId, session.orgId, provider),
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
          wingetId: softwareCatalog.wingetId,
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
      devices: devices.map(({ entraDeviceId: _e, intuneDeviceId, agentDeviceId, ...d }) => ({
        ...d,
        intuneManaged: !!intuneDeviceId,
        agentLinked: !!agentDeviceId,
      })),
      catalog: catalog.map(({ intuneAppId, installGroupId, wingetId, ...app }) => ({
        ...app,
        // Requests need an Intune install group, or a winget ID for the agent
        requestable: app.access === "approval" && (provider === "agent" ? !!wingetId : !!installGroupId),
        companyPortalUrl:
          provider === "intune" && app.access === "self_service" && intuneAppId
            ? `companyportal:ApplicationId=${intuneAppId}`
            : null,
      })),
      options: {
        durationOptions: allowedDurations(settings),
        requireReason: settings.requireReason,
        maxRevealsPerGrant: settings.maxRevealsPerGrant,
        provider,
        // Intune devices reveal Windows LAPS from Entra; agent devices reveal the IdaraOS-managed
        // StellarAdmin password, available only when managed admin passwords are turned on.
        credentialsAvailable:
          settings.credentialModeEnabled &&
          (provider === "intune" || (provider === "agent" && settings.manageAgentAdmin)),
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

    const provider = settings.deviceProvider
    const device = (await getMyDevices(session.userId, session.orgId, provider)).find((d) => d.id === assetId)
    if (!device || (provider === "agent" ? !device.agentDeviceId : !device.entraDeviceId)) {
      return NextResponse.json(
        {
          error:
            provider === "agent"
              ? "Device not found or not linked to you. Sign in to the IdaraOS Agent on the device first."
              : "Device not found, not assigned to you, or not joined to Entra",
        },
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
      if (provider === "agent") {
        if (!app.wingetId) {
          return NextResponse.json({ error: "IT hasn't set up this app yet - try again later" }, { status: 400 })
        }
      } else {
        if (!app.installGroupId) {
          return NextResponse.json(
            { error: "IT hasn't set up this app in Intune yet - try again later" },
            { status: 400 }
          )
        }
        if (!device.intuneDeviceId) {
          return NextResponse.json({ error: "This device isn't managed by Intune" }, { status: 400 })
        }
      }
      catalogApp = { id: app.id, name: app.name, publisher: app.publisher }
    } else {
      if (provider === "agent" && !settings.manageAgentAdmin) {
        return NextResponse.json(
          { error: "Admin access requests aren't enabled for IdaraOS Agent devices. Ask IT to turn on managed admin passwords, or request an approved app." },
          { status: 400 }
        )
      }
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
        agentDeviceId: device.agentDeviceId,
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
