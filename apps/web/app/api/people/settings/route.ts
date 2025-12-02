/**
 * People Settings API
 * GET /api/people/settings - Get people module settings
 * PUT /api/people/settings - Update people module settings
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { peopleSettings, integrations, DEFAULT_PROPERTY_MAPPING } from "@/lib/db/schema"

// Demo org ID
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

/**
 * GET /api/people/settings
 * Returns people module settings including Entra sync configuration
 */
export async function GET() {
  try {
    const orgId = DEMO_ORG_ID

    // Get people settings
    const [settings] = await db
      .select()
      .from(peopleSettings)
      .where(eq(peopleSettings.orgId, orgId))
      .limit(1)

    // Get core Entra integration status to check if Entra features should be available
    const [entraIntegration] = await db
      .select({
        status: integrations.status,
        scimEnabled: integrations.scimEnabled,
        syncPeopleEnabled: integrations.syncPeopleEnabled,
        deletePeopleOnUserDelete: integrations.deletePeopleOnUserDelete,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, orgId),
          eq(integrations.provider, "entra")
        )
      )
      .limit(1)

    const isEntraConnected = entraIntegration?.status === "connected"
    const isCoreScimEnabled = entraIntegration?.scimEnabled ?? false
    const isSyncPeopleEnabledInCore = entraIntegration?.syncPeopleEnabled ?? false
    const isDeletePeopleOnUserDeleteInCore = entraIntegration?.deletePeopleOnUserDelete ?? true

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        // People module settings
        syncMode: "linked",
        peopleGroupPattern: null,
        propertyMapping: DEFAULT_PROPERTY_MAPPING,
        autoDeleteOnRemoval: false,
        defaultStatus: "active",
        scimEnabled: false,
        lastSyncAt: null,
        syncedPeopleCount: "0",
        lastSyncError: null,
        
        // Core integration status (read-only info)
        entraConnected: isEntraConnected,
        coreScimEnabled: isCoreScimEnabled,
        syncPeopleEnabledInCore: isSyncPeopleEnabledInCore,
        deletePeopleOnUserDeleteInCore: isDeletePeopleOnUserDeleteInCore,
      })
    }

    return NextResponse.json({
      ...settings,
      propertyMapping: settings.propertyMapping || DEFAULT_PROPERTY_MAPPING,
      
      // Core integration status (read-only info)
      entraConnected: isEntraConnected,
      coreScimEnabled: isCoreScimEnabled,
      syncPeopleEnabledInCore: isSyncPeopleEnabledInCore,
      deletePeopleOnUserDeleteInCore: isDeletePeopleOnUserDeleteInCore,
    })
  } catch (error) {
    console.error("[People Settings] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch people settings" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/settings
 * Update people module settings
 */
export async function PUT(request: NextRequest) {
  try {
    const orgId = DEMO_ORG_ID
    const body = await request.json()

    const {
      syncMode,
      peopleGroupPattern,
      propertyMapping,
      autoDeleteOnRemoval,
      defaultStatus,
      scimEnabled,
    } = body

    // Validate sync mode
    if (syncMode && !["linked", "independent"].includes(syncMode)) {
      return NextResponse.json(
        { error: "Invalid sync mode. Must be 'linked' or 'independent'" },
        { status: 400 }
      )
    }

    // If switching to independent mode, require group pattern
    if (syncMode === "independent" && !peopleGroupPattern) {
      return NextResponse.json(
        { error: "Group pattern is required for independent sync mode" },
        { status: 400 }
      )
    }

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(peopleSettings)
      .where(eq(peopleSettings.orgId, orgId))
      .limit(1)

    const updateData = {
      syncMode: syncMode || "linked",
      peopleGroupPattern: syncMode === "independent" ? peopleGroupPattern : null,
      propertyMapping: propertyMapping || DEFAULT_PROPERTY_MAPPING,
      autoDeleteOnRemoval: autoDeleteOnRemoval ?? false,
      defaultStatus: defaultStatus || "active",
      scimEnabled: scimEnabled ?? false,
      updatedAt: new Date(),
    }

    let result
    if (existing) {
      // Update existing settings
      [result] = await db
        .update(peopleSettings)
        .set(updateData)
        .where(eq(peopleSettings.id, existing.id))
        .returning()
    } else {
      // Create new settings
      [result] = await db
        .insert(peopleSettings)
        .values({
          orgId,
          ...updateData,
        })
        .returning()
    }

    // If switching to independent mode, disable syncPeopleEnabled in core integration
    if (syncMode === "independent") {
      await db
        .update(integrations)
        .set({
          syncPeopleEnabled: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(integrations.orgId, orgId),
            eq(integrations.provider, "entra")
          )
        )
    }

    return NextResponse.json({
      ...result,
      propertyMapping: result.propertyMapping || DEFAULT_PROPERTY_MAPPING,
      message: syncMode === "independent" 
        ? "People sync is now independent. User sync will no longer create people records."
        : "People settings updated successfully.",
    })
  } catch (error) {
    console.error("[People Settings] PUT error:", error)
    return NextResponse.json(
      { error: "Failed to update people settings" },
      { status: 500 }
    )
  }
}

