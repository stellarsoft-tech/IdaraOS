/**
 * People Sync API
 * POST /api/people/settings/sync - Trigger people sync from Entra
 */

import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { peopleSettings, integrations } from "@/lib/db/schema"
import { performPeopleSync } from "@/lib/people/sync"

// Demo org ID
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

/**
 * POST /api/people/settings/sync
 * Trigger a manual sync of people from Entra
 */
export async function POST() {
  try {
    const orgId = DEMO_ORG_ID

    // Get people settings
    const [settings] = await db
      .select()
      .from(peopleSettings)
      .where(eq(peopleSettings.orgId, orgId))
      .limit(1)

    // Get core Entra integration
    const [entraIntegration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, orgId),
          eq(integrations.provider, "entra")
        )
      )
      .limit(1)

    if (!entraIntegration || entraIntegration.status !== "connected") {
      return NextResponse.json(
        { error: "Entra ID is not connected. Configure it in Settings > Integrations." },
        { status: 400 }
      )
    }

    const syncMode = settings?.syncMode || "linked"

    if (syncMode === "linked") {
      return NextResponse.json(
        { 
          error: "People sync is in linked mode. Sync users in Settings > Integrations to update people.",
          redirectTo: "/settings/integrations"
        },
        { status: 400 }
      )
    }

    // Independent mode - perform people-specific sync
    if (!settings?.peopleGroupPattern) {
      return NextResponse.json(
        { error: "No group pattern configured for people sync. Configure it in People > Settings." },
        { status: 400 }
      )
    }

    // Perform the sync
    const result = await performPeopleSync(orgId, {
      groupPattern: settings.peopleGroupPattern,
      propertyMapping: settings.propertyMapping,
      autoDeleteOnRemoval: settings.autoDeleteOnRemoval,
      defaultStatus: settings.defaultStatus,
    })

    // Update sync stats
    await db
      .update(peopleSettings)
      .set({
        lastSyncAt: new Date(),
        syncedPeopleCount: result.stats.syncedCount.toString(),
        lastSyncError: result.stats.errors.length > 0 ? result.stats.errors.join("; ") : null,
        lastSyncErrorAt: result.stats.errors.length > 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(peopleSettings.id, settings.id))

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: result.stats,
    })
  } catch (error) {
    console.error("[People Sync] Error:", error)
    return NextResponse.json(
      { error: "Failed to sync people" },
      { status: 500 }
    )
  }
}

