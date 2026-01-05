/**
 * Storage Integration Test Connection API
 * POST /api/settings/storage-integrations/[id]/test - Test the integration connection
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { storageIntegrations } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/settings/storage-integrations/[id]/test
 * Test the connection to the storage provider
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    // Get the integration
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
    
    const integration = result[0]
    
    let testSuccess = false
    let testError: string | null = null
    let testDetails: Record<string, unknown> = {}
    
    try {
      switch (integration.provider) {
        case "sharepoint":
          // Test SharePoint connection
          // In a real implementation, this would use Microsoft Graph API
          if (!integration.siteUrl) {
            throw new Error("SharePoint site URL is required")
          }
          
          // TODO: Implement actual SharePoint connection test
          // For now, validate the configuration
          if (integration.useEntraAuth) {
            // Would use the existing Entra integration to get a token
            // and call Microsoft Graph to list the site
            testDetails = {
              message: "SharePoint configuration validated",
              siteUrl: integration.siteUrl,
              requiresEntraConnection: true,
            }
            testSuccess = true
          } else {
            throw new Error("Non-Entra authentication not yet supported for SharePoint")
          }
          break
          
        case "azure_blob":
          // Test Azure Blob Storage connection
          if (!integration.accountName || !integration.containerName) {
            throw new Error("Storage account name and container name are required")
          }
          
          // TODO: Implement actual Blob Storage connection test
          // Would use @azure/storage-blob to list blobs
          testDetails = {
            message: "Azure Blob Storage configuration validated",
            accountName: integration.accountName,
            containerName: integration.containerName,
          }
          testSuccess = true
          break
          
        case "local":
          // Local storage is always "connected" for dev purposes
          testDetails = {
            message: "Local storage is ready",
            basePath: integration.basePath || "./uploads",
          }
          testSuccess = true
          break
          
        default:
          throw new Error(`Unsupported provider: ${integration.provider}`)
      }
    } catch (error) {
      testError = error instanceof Error ? error.message : "Unknown error"
      testSuccess = false
    }
    
    // Update the integration with test results
    const updateData: Record<string, unknown> = {
      lastTestedAt: new Date(),
      updatedAt: new Date(),
    }
    
    if (testSuccess) {
      updateData.status = "connected"
      updateData.lastError = null
      updateData.lastErrorAt = null
    } else {
      updateData.status = "error"
      updateData.lastError = testError
      updateData.lastErrorAt = new Date()
    }
    
    await db
      .update(storageIntegrations)
      .set(updateData)
      .where(eq(storageIntegrations.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "settings.integrations",
        action: "test_connection",
        entityType: "storage_integration",
        entityId: id,
        entityName: integration.name,
        description: testSuccess ? "Connection test succeeded" : "Connection test failed",
        current: { success: testSuccess, error: testError },
      })
    }
    
    return NextResponse.json({
      success: testSuccess,
      error: testError,
      details: testDetails,
      testedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error testing storage integration:", error)
    return NextResponse.json(
      { error: "Failed to test storage integration" },
      { status: 500 }
    )
  }
}
