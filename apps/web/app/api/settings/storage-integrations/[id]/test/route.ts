/**
 * Storage Integration Test Connection API
 * POST /api/settings/storage-integrations/[id]/test - Test the integration connection
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { storageIntegrations, integrations } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { testSharePointConnection } from "@/lib/graph/client"

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
    let sharepointSiteId: string | null = null
    let sharepointDriveId: string | null = null
    let sharepointDriveName: string | null = null
    
    try {
      switch (integration.provider) {
        case "sharepoint":
          // Test SharePoint connection
          if (!integration.siteUrl) {
            throw new Error("SharePoint site URL is required")
          }
          
          if (integration.useEntraAuth) {
            // Check if Entra integration is connected first
            const entraIntegration = await db
              .select()
              .from(integrations)
              .where(
                and(
                  eq(integrations.orgId, session.orgId),
                  eq(integrations.provider, "entra")
                )
              )
              .limit(1)
            
            if (entraIntegration.length === 0 || entraIntegration[0].status !== "connected") {
              throw new Error(
                "Microsoft 365 integration is not connected. Please configure the Microsoft 365 integration first in the Integrations settings."
              )
            }
            
            // Actually test the SharePoint connection using Microsoft Graph
            const spResult = await testSharePointConnection(integration.siteUrl)
            
            if (!spResult.success) {
              throw new Error(spResult.error || "Failed to connect to SharePoint site")
            }
            
            // Store the site ID and drive ID for future uploads
            if (spResult.site) {
              sharepointSiteId = spResult.site.id
            }
            if (spResult.drive) {
              sharepointDriveId = spResult.drive.id
              sharepointDriveName = spResult.drive.name
            }
            
            testDetails = {
              message: spResult.warning 
                ? "SharePoint site accessible but document library access limited" 
                : "SharePoint connection verified successfully",
              warning: spResult.warning,
              siteUrl: integration.siteUrl,
              siteName: spResult.site?.displayName,
              siteId: spResult.site?.id,
              driveName: spResult.drive?.name,
              driveId: spResult.drive?.id,
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
          
          // Check authentication method
          const hasConnectionString = integration.connectionStringEncrypted && integration.connectionStringEncrypted.length > 0
          
          if (!hasConnectionString && integration.useEntraAuth) {
            // Using managed identity - check if Entra is connected
            const entraIntegration = await db
              .select()
              .from(integrations)
              .where(
                and(
                  eq(integrations.orgId, session.orgId),
                  eq(integrations.provider, "entra")
                )
              )
              .limit(1)
            
            if (entraIntegration.length === 0 || entraIntegration[0].status !== "connected") {
              throw new Error(
                "Using Entra authentication but Microsoft 365 integration is not connected. Either provide a connection string or configure the Microsoft 365 integration first."
              )
            }
          }
          
          // TODO: Implement actual Blob Storage connection test
          // Would use @azure/storage-blob to list containers
          testDetails = {
            message: "Azure Blob Storage configuration validated",
            accountName: integration.accountName,
            containerName: integration.containerName,
            authMethod: hasConnectionString ? "connection_string" : "managed_identity",
            note: "Full storage API validation will be performed on first file upload.",
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
      
      // Store SharePoint site/drive IDs if available
      if (sharepointSiteId) {
        updateData.siteId = sharepointSiteId
      }
      if (sharepointDriveId) {
        updateData.driveId = sharepointDriveId
      }
      if (sharepointDriveName) {
        updateData.driveName = sharepointDriveName
      }
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
