/**
 * Storage Integration Detail API Routes
 * GET /api/settings/storage-integrations/[id] - Get single integration
 * PATCH /api/settings/storage-integrations/[id] - Update integration
 * DELETE /api/settings/storage-integrations/[id] - Delete integration
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { storageIntegrations, fileCategories } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Validation schema for updating storage integration
const UpdateStorageIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["connected", "disconnected", "error", "pending"]).optional(),
  
  // SharePoint-specific
  siteUrl: z.string().url().optional().nullable(),
  siteId: z.string().optional().nullable(),
  driveId: z.string().optional().nullable(),
  driveName: z.string().optional().nullable(),
  
  // Azure Blob-specific
  accountName: z.string().optional().nullable(),
  containerName: z.string().optional().nullable(),
  connectionString: z.string().optional().nullable(), // Will be encrypted
  
  // Common
  basePath: z.string().optional().nullable(),
  useEntraAuth: z.boolean().optional(),
  settings: z.record(z.unknown()).optional().nullable(),
})

// Response transformer
function toApiResponse(integration: typeof storageIntegrations.$inferSelect) {
  return {
    id: integration.id,
    provider: integration.provider,
    name: integration.name,
    description: integration.description,
    status: integration.status,
    
    // SharePoint
    siteUrl: integration.siteUrl,
    siteId: integration.siteId,
    driveId: integration.driveId,
    driveName: integration.driveName,
    
    // Azure Blob
    accountName: integration.accountName,
    containerName: integration.containerName,
    hasConnectionString: !!integration.connectionStringEncrypted,
    
    // Common
    basePath: integration.basePath,
    useEntraAuth: integration.useEntraAuth,
    settings: integration.settings,
    
    // Status
    lastTestedAt: integration.lastTestedAt?.toISOString() ?? null,
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt?.toISOString() ?? null,
    
    // Audit
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString(),
  }
}

/**
 * GET /api/settings/storage-integrations/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    const result = await db
      .select()
      .from(storageIntegrations)
      .where(
        and(
          eq(storageIntegrations.id, id),
          eq(storageIntegrations.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Storage integration not found" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(toApiResponse(result[0]))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error fetching storage integration:", error)
    return NextResponse.json(
      { error: "Failed to fetch storage integration" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/storage-integrations/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateStorageIntegrationSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Check exists
    const existing = await db
      .select()
      .from(storageIntegrations)
      .where(
        and(
          eq(storageIntegrations.id, id),
          eq(storageIntegrations.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Storage integration not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    
    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    
    // SharePoint
    if (data.siteUrl !== undefined) updateData.siteUrl = data.siteUrl
    if (data.siteId !== undefined) updateData.siteId = data.siteId
    if (data.driveId !== undefined) updateData.driveId = data.driveId
    if (data.driveName !== undefined) updateData.driveName = data.driveName
    
    // Azure Blob
    if (data.accountName !== undefined) updateData.accountName = data.accountName
    if (data.containerName !== undefined) updateData.containerName = data.containerName
    if (data.connectionString !== undefined) {
      // TODO: Encrypt in production
      updateData.connectionStringEncrypted = data.connectionString
    }
    
    // Common
    if (data.basePath !== undefined) updateData.basePath = data.basePath
    if (data.useEntraAuth !== undefined) updateData.useEntraAuth = data.useEntraAuth
    if (data.settings !== undefined) updateData.settings = data.settings
    
    // Update
    const result = await db
      .update(storageIntegrations)
      .set(updateData)
      .where(eq(storageIntegrations.id, id))
      .returning()
    
    const integration = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "settings.integrations",
        "storage_integration",
        id,
        integration.name,
        previousValues as Record<string, unknown>,
        integration as unknown as Record<string, unknown>
      )
    }
    
    return NextResponse.json(toApiResponse(integration))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error updating storage integration:", error)
    return NextResponse.json(
      { error: "Failed to update storage integration" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/storage-integrations/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    // Check exists
    const existing = await db
      .select()
      .from(storageIntegrations)
      .where(
        and(
          eq(storageIntegrations.id, id),
          eq(storageIntegrations.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Storage integration not found" },
        { status: 404 }
      )
    }
    
    // Check if any categories are using this integration
    const categoriesUsingIntegration = await db
      .select({ id: fileCategories.id })
      .from(fileCategories)
      .where(eq(fileCategories.storageIntegrationId, id))
      .limit(1)
    
    if (categoriesUsingIntegration.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete integration that is in use by file categories" },
        { status: 409 }
      )
    }
    
    // Delete
    await db
      .delete(storageIntegrations)
      .where(eq(storageIntegrations.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("settings.integrations", "storage_integration", {
        id: existing[0].id,
        provider: existing[0].provider,
        name: existing[0].name,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error deleting storage integration:", error)
    return NextResponse.json(
      { error: "Failed to delete storage integration" },
      { status: 500 }
    )
  }
}
