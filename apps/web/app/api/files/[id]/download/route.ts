/**
 * File Download API Route
 * GET /api/files/[id]/download - Get download URL or stream file
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, storageIntegrations } from "@/lib/db/schema"
import { requireSession } from "@/lib/api/context"
import { getDownloadUrl as getSharePointDownloadUrl } from "@/lib/graph/client"

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
    const metadata = file.metadata as Record<string, unknown> | null
    
    let downloadUrl: string | null = null
    let expiresAt: string | null = null
    const webUrl: string | null = (metadata?.webUrl as string) ?? null
    
    if (storage && storage.status === "connected") {
      switch (storage.provider) {
        case "sharepoint":
          // Get download URL from SharePoint using Microsoft Graph
          if (storage.siteId && file.externalId) {
            try {
              console.log(`[Download] Getting SharePoint download URL for item: ${file.externalId}`)
              const downloadResult = await getSharePointDownloadUrl(
                storage.siteId,
                storage.driveId,
                file.externalId
              )
              
              if (downloadResult) {
                downloadUrl = downloadResult.downloadUrl
                expiresAt = downloadResult.expiresAt.toISOString()
                console.log(`[Download] Got SharePoint download URL, expires: ${expiresAt}`)
              } else {
                console.error("[Download] Failed to get download URL from SharePoint")
              }
            } catch (graphError) {
              console.error("[Download] SharePoint download error:", graphError)
            }
          }
          
          // If we couldn't get a fresh download URL, file might not exist in SharePoint
          if (!downloadUrl) {
            return NextResponse.json(
              { error: "Could not generate download URL. The file may have been deleted from SharePoint." },
              { status: 404 }
            )
          }
          break
          
        case "azure_blob":
          // TODO: Generate SAS URL using @azure/storage-blob SDK
          // For now, return placeholder - Azure Blob implementation pending
          if (storage.accountName && storage.containerName && file.storagePath) {
            // Without SAS, this URL won't work for private containers
            // Full implementation needs @azure/storage-blob SDK
            downloadUrl = `https://${storage.accountName}.blob.core.windows.net/${storage.containerName}/${file.storagePath}`
            expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour
            console.log("[Download] Azure Blob SAS not implemented - returning direct URL")
          }
          break
          
        case "local":
          // For local storage, we would serve the file directly
          // In a real implementation, this would stream from the file system
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
      webUrl, // Include webUrl for "View in Storage" feature
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
