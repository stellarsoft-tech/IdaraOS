/**
 * SCIM Sync API Endpoint
 * POST - Triggers a full sync from Entra ID
 * GET - Get the current sync status and counts
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrations, users, scimGroups } from "@/lib/db/schema"
import { eq, and, count } from "drizzle-orm"
import { requireOrgId, getAuditLogger } from "@/lib/api/context"
import { performFullSync } from "@/lib/scim/full-sync"

/**
 * POST /api/settings/integrations/entra/sync
 * Triggers a full sync from Entra ID
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = await requireOrgId(request)

    // Get the integration
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, orgId),
          eq(integrations.provider, "entra")
        )
      )
      .limit(1)

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      )
    }

    if (!integration.scimEnabled) {
      return NextResponse.json(
        { error: "SCIM is not enabled" },
        { status: 400 }
      )
    }

    // Perform full sync
    const result = await performFullSync(orgId)

    if (!result.success && result.stats.groupsSynced === 0) {
      return NextResponse.json(
        { 
          error: result.message,
          stats: result.stats,
        },
        { status: 500 }
      )
    }

    // Get updated counts
    const [userCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.scimProvisioned, true)))

    const [groupCountResult] = await db
      .select({ count: count() })
      .from(scimGroups)
      .where(eq(scimGroups.orgId, orgId))

    // Log the sync action
    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "settings.integrations",
        action: "sync",
        entityType: "entra_sync",
        entityName: "Entra ID Full Sync",
        description: `Synced ${result.stats.usersCreated} users created, ${result.stats.usersUpdated} updated, ${result.stats.groupsSynced} groups`,
        current: {
          usersCreated: result.stats.usersCreated,
          usersUpdated: result.stats.usersUpdated,
          usersDeleted: result.stats.usersDeleted,
          groupsSynced: result.stats.groupsSynced,
          rolesAssigned: result.stats.rolesAssigned,
          success: result.success,
        },
      })
    }

    return NextResponse.json({
      success: result.success,
      syncedUserCount: userCountResult?.count || 0,
      syncedGroupCount: groupCountResult?.count || 0,
      lastSyncAt: new Date().toISOString(),
      message: result.message,
      stats: result.stats,
    })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    console.error("Error syncing:", error)
    return NextResponse.json(
      { error: "Failed to sync" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/settings/integrations/entra/sync
 * Get the current sync status and counts
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireOrgId(request)

    // Get the integration
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, orgId),
          eq(integrations.provider, "entra")
        )
      )
      .limit(1)

    if (!integration) {
      return NextResponse.json({
        syncedUserCount: 0,
        syncedGroupCount: 0,
        lastSyncAt: null,
      })
    }

    // Count current SCIM-provisioned users (live count)
    const [userCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.scimProvisioned, true)
        )
      )

    // Count current SCIM groups (live count)
    const [groupCountResult] = await db
      .select({ count: count() })
      .from(scimGroups)
      .where(eq(scimGroups.orgId, orgId))

    return NextResponse.json({
      syncedUserCount: userCountResult?.count || 0,
      syncedGroupCount: groupCountResult?.count || 0,
      lastSyncAt: integration.lastSyncAt?.toISOString() || null,
      lastError: integration.lastError,
      lastErrorAt: integration.lastErrorAt?.toISOString() || null,
    })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    console.error("Error getting sync status:", error)
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    )
  }
}
