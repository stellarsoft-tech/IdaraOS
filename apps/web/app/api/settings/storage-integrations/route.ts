/**
 * Storage Integrations API Routes
 * GET /api/settings/storage-integrations - List all storage integrations
 * POST /api/settings/storage-integrations - Create a new storage integration
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { storageIntegrations } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

// Validation schema for creating storage integration
const CreateStorageIntegrationSchema = z.object({
  provider: z.enum(["sharepoint", "azure_blob", "local"]),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  
  // SharePoint-specific
  siteUrl: z.string().url().optional(),
  siteId: z.string().optional(),
  driveId: z.string().optional(),
  driveName: z.string().optional(),
  
  // Azure Blob-specific
  accountName: z.string().optional(),
  containerName: z.string().optional(),
  connectionString: z.string().optional(), // Will be encrypted
  
  // Common
  basePath: z.string().optional(),
  useEntraAuth: z.boolean().default(true),
  settings: z.record(z.unknown()).optional(),
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
 * GET /api/settings/storage-integrations
 * List all storage integrations for the organization
 */
export async function GET(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission("settings.integrations", "view")
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get("provider")
    const status = searchParams.get("status")
    
    // Build conditions
    const conditions = [eq(storageIntegrations.orgId, session.orgId)]
    
    if (provider) {
      conditions.push(eq(storageIntegrations.provider, provider as "sharepoint" | "azure_blob" | "local"))
    }
    
    if (status) {
      conditions.push(eq(storageIntegrations.status, status as "connected" | "disconnected" | "error" | "pending"))
    }
    
    const results = await db
      .select()
      .from(storageIntegrations)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(storageIntegrations.createdAt))
    
    return NextResponse.json({
      data: results.map(toApiResponse),
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching storage integrations:", error)
    return NextResponse.json(
      { error: "Failed to fetch storage integrations" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/storage-integrations
 * Create a new storage integration
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission("settings.integrations", "create")
    const body = await request.json()
    
    // Validate
    const parseResult = CreateStorageIntegrationSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // TODO: Encrypt connection string if provided
    let connectionStringEncrypted: string | null = null
    if (data.connectionString) {
      // For now, store as-is (in production, use proper encryption)
      connectionStringEncrypted = data.connectionString
    }
    
    // Create integration
    const result = await db
      .insert(storageIntegrations)
      .values({
        orgId: session.orgId,
        provider: data.provider,
        name: data.name,
        description: data.description ?? null,
        status: "disconnected",
        
        // SharePoint
        siteUrl: data.siteUrl ?? null,
        siteId: data.siteId ?? null,
        driveId: data.driveId ?? null,
        driveName: data.driveName ?? null,
        
        // Azure Blob
        accountName: data.accountName ?? null,
        containerName: data.containerName ?? null,
        connectionStringEncrypted,
        
        // Common
        basePath: data.basePath ?? null,
        useEntraAuth: data.useEntraAuth,
        settings: data.settings ?? null,
        
        createdById: session.userId,
      })
      .returning()
    
    const integration = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("settings.integrations", "storage_integration", {
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
      })
    }
    
    return NextResponse.json(toApiResponse(integration), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error creating storage integration:", error)
    return NextResponse.json(
      { error: "Failed to create storage integration" },
      { status: 500 }
    )
  }
}
