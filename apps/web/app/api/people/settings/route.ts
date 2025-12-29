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

    // Debug logging to help diagnose Entra connection status
    console.log("[People Settings] Entra integration query result:", {
      found: !!entraIntegration,
      status: entraIntegration?.status,
      scimEnabled: entraIntegration?.scimEnabled,
      syncPeopleEnabled: entraIntegration?.syncPeopleEnabled,
    })

    const isEntraConnected = entraIntegration?.status === "connected"
    const isCoreScimEnabled = entraIntegration?.scimEnabled ?? false
    const isSyncPeopleEnabledInCore = entraIntegration?.syncPeopleEnabled ?? false
    const isDeletePeopleOnUserDeleteInCore = entraIntegration?.deletePeopleOnUserDelete ?? true
    
    console.log("[People Settings] Computed values:", {
      isEntraConnected,
      isCoreScimEnabled,
      isSyncPeopleEnabledInCore,
    })

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
        
        // Workflow settings
        autoOnboardingWorkflow: false,
        defaultOnboardingWorkflowTemplateId: null,
        autoOffboardingWorkflow: false,
        defaultOffboardingWorkflowTemplateId: null,
        
        // Core integration status (read-only info)
        entraConnected: isEntraConnected,
        coreScimEnabled: isCoreScimEnabled,
        syncPeopleEnabledInCore: isSyncPeopleEnabledInCore,
        deletePeopleOnUserDeleteInCore: isDeletePeopleOnUserDeleteInCore,
      })
    }

    console.log("[People Settings] GET returning settings:", {
      syncMode: settings.syncMode,
      peopleGroupPattern: settings.peopleGroupPattern,
      autoOnboardingWorkflow: settings.autoOnboardingWorkflow,
    })
    
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

    console.log("[People Settings] PUT request body:", JSON.stringify(body, null, 2))

    const {
      syncMode,
      peopleGroupPattern,
      propertyMapping,
      autoDeleteOnRemoval,
      defaultStatus,
      scimEnabled,
      // Workflow settings
      autoOnboardingWorkflow,
      defaultOnboardingWorkflowTemplateId,
      autoOffboardingWorkflow,
      defaultOffboardingWorkflowTemplateId,
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

    let result: typeof peopleSettings.$inferSelect | undefined
    
    if (existing) {
      console.log("[People Settings] Existing settings found:", {
        id: existing.id,
        syncMode: existing.syncMode,
        peopleGroupPattern: existing.peopleGroupPattern,
      })
      
      // Update existing settings - only include fields that were explicitly provided
      const updateData: Partial<typeof peopleSettings.$inferInsert> = {
        updatedAt: new Date(),
      }

      // Integration settings - only update if provided
      // Use 'key in body' check to distinguish between undefined and not sent
      if ("syncMode" in body) {
        updateData.syncMode = syncMode
      }
      if ("peopleGroupPattern" in body) {
        // Only set peopleGroupPattern if syncMode is being set to independent, 
        // OR if syncMode isn't changing and existing syncMode is independent
        const effectiveSyncMode = "syncMode" in body ? syncMode : existing.syncMode
        updateData.peopleGroupPattern = effectiveSyncMode === "independent" ? peopleGroupPattern : null
      }
      if ("propertyMapping" in body) {
        updateData.propertyMapping = propertyMapping
      }
      if ("autoDeleteOnRemoval" in body) {
        updateData.autoDeleteOnRemoval = autoDeleteOnRemoval
      }
      if ("defaultStatus" in body) {
        updateData.defaultStatus = defaultStatus
      }
      if ("scimEnabled" in body) {
        updateData.scimEnabled = scimEnabled
      }

      // Workflow settings - only update if provided
      if ("autoOnboardingWorkflow" in body) {
        updateData.autoOnboardingWorkflow = autoOnboardingWorkflow
      }
      if ("defaultOnboardingWorkflowTemplateId" in body) {
        updateData.defaultOnboardingWorkflowTemplateId = defaultOnboardingWorkflowTemplateId || null
      }
      if ("autoOffboardingWorkflow" in body) {
        updateData.autoOffboardingWorkflow = autoOffboardingWorkflow
      }
      if ("defaultOffboardingWorkflowTemplateId" in body) {
        updateData.defaultOffboardingWorkflowTemplateId = defaultOffboardingWorkflowTemplateId || null
      }

      console.log("[People Settings] Update data (only fields being updated):", JSON.stringify(updateData, null, 2))

      const updateResult = await db
        .update(peopleSettings)
        .set(updateData)
        .where(eq(peopleSettings.id, existing.id))
        .returning()
      result = updateResult[0]
    } else {
      console.log("[People Settings] No existing settings, creating new")
      // Create new settings - use defaults for fields not provided
      const insertResult = await db
        .insert(peopleSettings)
        .values({
          orgId,
          syncMode: syncMode || "linked",
          peopleGroupPattern: syncMode === "independent" ? peopleGroupPattern : null,
          propertyMapping: propertyMapping || DEFAULT_PROPERTY_MAPPING,
          autoDeleteOnRemoval: autoDeleteOnRemoval ?? false,
          defaultStatus: defaultStatus || "active",
          scimEnabled: scimEnabled ?? false,
          autoOnboardingWorkflow: autoOnboardingWorkflow ?? false,
          defaultOnboardingWorkflowTemplateId: defaultOnboardingWorkflowTemplateId || null,
          autoOffboardingWorkflow: autoOffboardingWorkflow ?? false,
          defaultOffboardingWorkflowTemplateId: defaultOffboardingWorkflowTemplateId || null,
          updatedAt: new Date(),
        })
        .returning()
      result = insertResult[0]
    }
    
    if (!result) {
      throw new Error("Failed to save settings")
    }
    
    console.log("[People Settings] Save result:", {
      syncMode: result.syncMode,
      peopleGroupPattern: result.peopleGroupPattern,
      autoOnboardingWorkflow: result.autoOnboardingWorkflow,
    })

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

    // Log what we're returning
    console.log("[People Settings] PUT returning:", {
      syncMode: result.syncMode,
      peopleGroupPattern: result.peopleGroupPattern,
      autoOnboardingWorkflow: result.autoOnboardingWorkflow,
    })

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

