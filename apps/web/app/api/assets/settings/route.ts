/**
 * Assets Settings API Routes
 * GET /api/assets/settings - Get asset module settings
 * POST /api/assets/settings - Save asset module settings
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetsSettings } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

/**
 * GET /api/assets/settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(...P.assets.settings.view())
    const orgId = session.orgId
    
    const result = await db
      .select()
      .from(assetsSettings)
      .where(eq(assetsSettings.orgId, orgId))
      .limit(1)
    
    if (result.length === 0) {
      // Return default settings
      return NextResponse.json({
        autoGenerateTags: true,
        tagPrefix: "AST",
        tagSequence: "0",
        defaultStatus: "available",
        syncSettings: {},
        lastSyncAt: null,
        syncedAssetCount: "0",
        lastSyncError: null,
      })
    }
    
    const settings = result[0]
    
    return NextResponse.json({
      id: settings.id,
      autoGenerateTags: settings.autoGenerateTags,
      tagPrefix: settings.tagPrefix,
      tagSequence: settings.tagSequence,
      defaultStatus: settings.defaultStatus,
      syncSettings: settings.syncSettings || {},
      lastSyncAt: settings.lastSyncAt?.toISOString() ?? null,
      syncedAssetCount: settings.syncedAssetCount || "0",
      lastSyncError: settings.lastSyncError,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching assets settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assets/settings
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.assets.settings.edit())
    const orgId = session.orgId
    const body = await request.json()
    
    // Check if settings exist
    const existing = await db
      .select()
      .from(assetsSettings)
      .where(eq(assetsSettings.orgId, orgId))
      .limit(1)
    
    const now = new Date()
    
    if (existing.length === 0) {
      // Create new settings
      const result = await db
        .insert(assetsSettings)
        .values({
          orgId,
          autoGenerateTags: body.autoGenerateTags ?? true,
          tagPrefix: body.tagPrefix ?? "AST",
          tagSequence: body.tagSequence ?? "0",
          defaultStatus: body.defaultStatus ?? "available",
          syncSettings: body.syncSettings ?? {},
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      
      const settings = result[0]
      
      return NextResponse.json({
        id: settings.id,
        autoGenerateTags: settings.autoGenerateTags,
        tagPrefix: settings.tagPrefix,
        tagSequence: settings.tagSequence,
        defaultStatus: settings.defaultStatus,
        syncSettings: settings.syncSettings || {},
        lastSyncAt: settings.lastSyncAt?.toISOString() ?? null,
        syncedAssetCount: settings.syncedAssetCount || "0",
        lastSyncError: settings.lastSyncError,
      }, { status: 201 })
    }
    
    // Update existing settings
    const updateData: Partial<typeof assetsSettings.$inferInsert> = {
      updatedAt: now,
    }
    
    if (body.autoGenerateTags !== undefined) updateData.autoGenerateTags = body.autoGenerateTags
    if (body.tagPrefix !== undefined) updateData.tagPrefix = body.tagPrefix
    if (body.tagSequence !== undefined) updateData.tagSequence = body.tagSequence
    if (body.defaultStatus !== undefined) updateData.defaultStatus = body.defaultStatus
    if (body.syncSettings !== undefined) updateData.syncSettings = body.syncSettings
    
    const result = await db
      .update(assetsSettings)
      .set(updateData)
      .where(eq(assetsSettings.orgId, orgId))
      .returning()
    
    const settings = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("assets.settings", "settings", settings.id, "Asset Settings", existing[0] as Record<string, unknown>, settings as unknown as Record<string, unknown>)
    }
    
    return NextResponse.json({
      id: settings.id,
      autoGenerateTags: settings.autoGenerateTags,
      tagPrefix: settings.tagPrefix,
      tagSequence: settings.tagSequence,
      defaultStatus: settings.defaultStatus,
      syncSettings: settings.syncSettings || {},
      lastSyncAt: settings.lastSyncAt?.toISOString() ?? null,
      syncedAssetCount: settings.syncedAssetCount || "0",
      lastSyncError: settings.lastSyncError,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error saving assets settings:", error)
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    )
  }
}

