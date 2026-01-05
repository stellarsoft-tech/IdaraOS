/**
 * File Download API Route
 * GET /api/files/[id]/download - Get download URL or stream file
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, storageIntegrations } from "@/lib/db/schema"
import { requireSession } from "@/lib/api/context"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/files/[id]/download
 * Returns a download URL or redirects to the file
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    // Get file with storage integration
    const result = await db
      .select({
        file: files,
        storage: storageIntegrations,
      })
      .from(files)
      .leftJoin(storageIntegrations, eq(files.storageIntegrationId, storageIntegrations.id))
      .where(
        and(
          eq(files.id, id),
          eq(files.orgId, session.orgId),
          eq(files.isDeleted, false)
        )
      )
      .limit(1)
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }
    
    const file = result[0].file
    const storage = result[0].storage
    
    let downloadUrl: string | null = null
    let expiresAt: string | null = null
    
    if (storage && storage.status === "connected") {
      switch (storage.provider) {
        case "sharepoint":
          // TODO: Generate SharePoint download URL using Microsoft Graph
          // const graphClient = await getGraphClient()
          // const driveItem = await graphClient.api(`/sites/${storage.siteId}/drive/items/${file.externalId}`)
          //   .select('@microsoft.graph.downloadUrl')
          //   .get()
          // downloadUrl = driveItem['@microsoft.graph.downloadUrl']
          
          // Placeholder URL for development
          downloadUrl = `https://placeholder.sharepoint.com/download/${file.externalId}`
          expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour
          break
          
        case "azure_blob":
          // TODO: Generate SAS URL using @azure/storage-blob
          // const blobServiceClient = BlobServiceClient.fromConnectionString(...)
          // const containerClient = blobServiceClient.getContainerClient(storage.containerName)
          // const blobClient = containerClient.getBlobClient(file.storagePath)
          // const sasUrl = blobClient.generateSasUrl({
          //   permissions: BlobSASPermissions.parse('r'),
          //   expiresOn: new Date(Date.now() + 3600000),
          // })
          
          // Placeholder URL for development
          downloadUrl = `https://${storage.accountName}.blob.core.windows.net/${storage.containerName}/${file.storagePath}`
          expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour
          break
          
        case "local":
          // For local storage, we would serve the file directly
          // In a real implementation, this would read from the file system
          downloadUrl = `/api/files/${id}/stream`
          break
      }
    }
    
    if (!downloadUrl) {
      // No storage configured or not connected - file is metadata only
      return NextResponse.json(
        { error: "File content not available - metadata only" },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      downloadUrl,
      expiresAt,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error generating download URL:", error)
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    )
  }
}
