/**
 * Approve Admin Access Request API
 * POST /api/security/elevation/requests/[id]/approve - Approve with credentials (time-boxed LAPS reveal)
 * or app_install (Intune installs the requested catalog app)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  elevationGrants,
  elevationRequests,
  elevationGrantModeValues,
  softwareCatalog,
  softwareInstalls,
  type SoftwareCatalogApp,
} from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { ACTIONS, MODULES, P } from "@/lib/rbac/resources"
import { checkUserPermission } from "@/lib/rbac/server"
import { checkApproval, computeGrantWindow, elevationGrantModeLabels, formatMinutes } from "@/lib/security/elevation"
import { getElevationSettings } from "@/lib/security/elevation-server"
import { startInstall } from "@/lib/security/software-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  mode: z.enum(elevationGrantModeValues),
  // Credentials only
  minutes: z.number().int().optional().nullable(),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer").optional().nullable(),
})

function installTargetFor(app: SoftwareCatalogApp | undefined, intuneDeviceId: string | null) {
  if (!app) return { ready: false, error: "This request isn't for an approved catalog app" }
  if (!app.enabled) return { ready: false, error: `${app.name} is disabled in Approved Software` }
  if (!app.installGroupId) {
    return { ready: false, error: `Link ${app.name} to its Intune install group in Approved Software first` }
  }
  if (!intuneDeviceId) return { ready: false, error: "The device isn't managed by Intune" }
  return { ready: true }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.elevation.edit())
    const { id } = await context.params

    const parsed = approveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const { mode } = parsed.data
    const minutes = parsed.data.minutes ?? 0
    const note = parsed.data.note?.trim() || null

    const [existing] = await db
      .select()
      .from(elevationRequests)
      .where(and(eq(elevationRequests.id, id), eq(elevationRequests.orgId, session.orgId)))
      .limit(1)
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const [settings, canUseCredentials, catalogRows] = await Promise.all([
      getElevationSettings(session.orgId),
      checkUserPermission(session.userId, MODULES.SECURITY_ELEVATION_CREDENTIALS, ACTIONS.EDIT),
      existing.catalogAppId
        ? db
            .select()
            .from(softwareCatalog)
            .where(and(eq(softwareCatalog.id, existing.catalogAppId), eq(softwareCatalog.orgId, session.orgId)))
            .limit(1)
        : Promise.resolve([] as SoftwareCatalogApp[]),
    ])
    const app = catalogRows[0]

    const check = checkApproval({
      request: existing,
      deciderId: session.userId,
      mode,
      minutes,
      settings,
      canUseCredentials,
      installTarget: mode === "app_install" ? installTargetFor(app, existing.intuneDeviceId) : undefined,
    })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const now = new Date()
    // Installs get a deadline instead of an access window
    const { startsAt, expiresAt } = computeGrantWindow(
      now,
      mode === "app_install" ? app!.installDeadlineHours * 60 : minutes
    )

    const result = await db.transaction(async (tx) => {
      // Conditional update guards against two approvers deciding at once
      const [approved] = await tx
        .update(elevationRequests)
        .set({ status: "approved", decidedById: session.userId, decidedAt: now, decisionNote: note, updatedAt: now })
        .where(and(eq(elevationRequests.id, id), eq(elevationRequests.status, "pending")))
        .returning()
      if (!approved) return null

      const [grant] = await tx
        .insert(elevationGrants)
        .values({
          orgId: session.orgId,
          requestId: id,
          userId: existing.requesterId,
          approvedById: session.userId,
          mode,
          startsAt,
          expiresAt,
        })
        .returning()

      const [install] =
        mode === "app_install"
          ? await tx
              .insert(softwareInstalls)
              .values({
                orgId: session.orgId,
                grantId: grant.id,
                catalogAppId: app!.id,
                appName: app!.name,
                wingetId: app!.wingetId,
                intuneAppId: app!.intuneAppId,
                groupId: app!.installGroupId!,
                removeFromGroupAfterInstall: app!.removeFromGroupAfterInstall,
                entraDeviceId: existing.entraDeviceId,
                intuneDeviceId: existing.intuneDeviceId,
              })
              .returning()
          : [null]
      return { request: approved, grant, install }
    })

    if (!result) {
      return NextResponse.json({ error: "This request has already been decided" }, { status: 409 })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.elevation",
        action: "approve",
        entityType: "elevation_request",
        entityId: id,
        entityName: existing.deviceName,
        current: { mode, minutes: mode === "credentials" ? minutes : null, expiresAt: expiresAt.toISOString(), note },
        description:
          mode === "app_install"
            ? `Approved install of ${app!.name} on ${existing.deviceName}`
            : `Approved admin access on ${existing.deviceName} for ${formatMinutes(minutes)} (${elevationGrantModeLabels[mode]})`,
      })
    }

    // Add the device to the install group now; the sweep retries if Graph fails
    const install = result.install ? await startInstall(result.install, now) : null

    return NextResponse.json({ data: { ...result, install } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error approving admin access request:", error)
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 })
  }
}
