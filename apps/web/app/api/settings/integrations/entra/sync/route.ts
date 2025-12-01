/**
 * SCIM Sync API Endpoint
 * Triggers a sync and updates the counts
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrations, users, scimGroups } from "@/lib/db/schema"
import { eq, and, count } from "drizzle-orm"
import { requireOrgId } from "@/lib/api/context"

/**
 * POST /api/settings/integrations/entra/sync
 * Triggers a manual sync and updates the counts
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

    // Count SCIM-provisioned users
    const [userCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.scimProvisioned, true)
        )
      )

    // Count SCIM groups
    const [groupCountResult] = await db
      .select({ count: count() })
      .from(scimGroups)
      .where(eq(scimGroups.orgId, orgId))

    const syncedUserCount = userCountResult?.count || 0
    const syncedGroupCount = groupCountResult?.count || 0

    // Update the integration with the new counts
    const [updated] = await db
      .update(integrations)
      .set({
        syncedUserCount: syncedUserCount.toString(),
        syncedGroupCount: syncedGroupCount.toString(),
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id))
      .returning()

    return NextResponse.json({
      success: true,
      syncedUserCount,
      syncedGroupCount,
      lastSyncAt: updated.lastSyncAt?.toISOString(),
      message: `Synced ${syncedUserCount} users and ${syncedGroupCount} groups`,
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
