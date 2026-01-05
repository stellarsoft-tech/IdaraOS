/**
 * File Upload API Route
 * POST /api/files/upload - Upload a file
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, fileCategories, storageIntegrations } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { randomUUID } from "crypto"
import { uploadFile as uploadToSharePoint } from "@/lib/graph/client"

// Response transformer
function toApiResponse(
  file: typeof files.$inferSelect,
  category?: typeof fileCategories.$inferSelect | null
) {
  const metadata = file.metadata as Record<string, unknown> | null
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    categoryId: file.categoryId,
    categoryName: category?.name,
    storagePath: file.storagePath,
    externalId: file.externalId,
    entityType: file.entityType,
    entityId: file.entityId,
    moduleScope: file.moduleScope,
    metadata: file.metadata,
    // Expose webUrl for "View in Storage" feature
    webUrl: metadata?.webUrl as string | undefined,
    storageProvider: metadata?.storageProvider as string | undefined,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  }
}

/**
 * POST /api/files/upload
 * Upload a file to the configured storage provider
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const categoryId = formData.get("categoryId") as string | null
    const entityTypeRaw = formData.get("entityType") as string | null
    const entityIdRaw = formData.get("entityId") as string | null
    const customName = formData.get("name") as string | null
    
    // Convert empty strings and "none" to null for optional fields
    const entityType = entityTypeRaw && entityTypeRaw !== "none" && entityTypeRaw !== "" ? entityTypeRaw : null
    const entityId = entityIdRaw && entityIdRaw !== "none" && entityIdRaw !== "" ? entityIdRaw : null
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }
    
    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      )
    }
    
    // Get the category
    const categoryResult = await db
      .select({
        category: fileCategories,
        storageIntegration: storageIntegrations,
      })
      .from(fileCategories)
      .leftJoin(storageIntegrations, eq(fileCategories.storageIntegrationId, storageIntegrations.id))
      .where(
        and(
          eq(fileCategories.id, categoryId),
          eq(fileCategories.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (categoryResult.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }
    
    const category = categoryResult[0].category
    const storageIntegration = categoryResult[0].storageIntegration
    
    // Validate file size
    if (category.maxFileSize && file.size > category.maxFileSize) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${Math.round(category.maxFileSize / 1024 / 1024)}MB` },
        { status: 400 }
      )
    }
    
    // Validate MIME type
    const allowedTypes = category.allowedMimeTypes as string[] | null
    if (allowedTypes && allowedTypes.length > 0) {
      const isAllowed = allowedTypes.some(type => {
        if (type.endsWith("/*")) {
          return file.type.startsWith(type.replace("/*", "/"))
        }
        return file.type === type
      })
      
      if (!isAllowed) {
        return NextResponse.json(
          { error: `File type ${file.type || "unknown"} is not allowed` },
          { status: 400 }
        )
      }
    }
    
    // Generate unique filename
    const timestamp = Date.now()
    const uuid = randomUUID().split("-")[0]
    const ext = file.name.includes(".") 
      ? file.name.substring(file.name.lastIndexOf(".")) 
      : ""
    const sanitizedName = file.name
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50)
    const uniqueFilename = `${timestamp}_${uuid}_${sanitizedName}${ext}`
    
    // Build storage path
    // Priority: category.folderPath > auto-generated path
    let fullPath: string
    
    if (category.folderPath) {
      // Use the configured folder path directly + unique filename
      fullPath = `${category.folderPath.replace(/^\/|\/$/g, "")}/${uniqueFilename}`
    } else {
      // Auto-generate path: orgId/moduleScope/categorySlug/filename
      fullPath = `${session.orgId}/${category.moduleScope}/${category.slug}/${uniqueFilename}`
    }
    
    // Prepend storage integration's base path if configured
    if (storageIntegration?.basePath) {
      fullPath = `${storageIntegration.basePath.replace(/^\/|\/$/g, "")}/${fullPath}`
    }
    
    let externalId: string | null = null
    let webUrl: string | null = null
    
    // Upload to storage provider
    if (storageIntegration && storageIntegration.status === "connected") {
      try {
        switch (storageIntegration.provider) {
          case "sharepoint":
            if (!storageIntegration.siteId) {
              console.error("[Storage] SharePoint site ID not configured")
              return NextResponse.json(
                { error: "SharePoint integration not fully configured (missing site ID)" },
                { status: 400 }
              )
            }
            
            // Get file content as ArrayBuffer
            const fileBuffer = await file.arrayBuffer()
            
            // Upload to SharePoint using Microsoft Graph
            console.log(`[Storage] Uploading to SharePoint: ${fullPath}`)
            const driveItem = await uploadToSharePoint(
              storageIntegration.siteId,
              storageIntegration.driveId,
              fullPath.includes("/") ? fullPath.substring(0, fullPath.lastIndexOf("/")) : "",
              fullPath.includes("/") ? fullPath.substring(fullPath.lastIndexOf("/") + 1) : fullPath,
              fileBuffer,
              file.type || "application/octet-stream"
            )
            
            if (!driveItem) {
              throw new Error("Failed to upload file to SharePoint")
            }
            
            externalId = driveItem.id
            webUrl = driveItem.webUrl
            console.log(`[Storage] SharePoint upload successful: ${driveItem.id}, webUrl: ${webUrl}`)
            break
            
          case "azure_blob":
            // TODO: Implement Azure Blob upload using @azure/storage-blob SDK
            // For now, store metadata with a reference that can be updated later
            console.log(`[Storage] Azure Blob storage not yet implemented, storing metadata: ${fullPath}`)
            externalId = `blob_pending_${randomUUID()}`
            break
            
          case "local":
            // Local file storage - store metadata only for now
            // In production, would write to local filesystem
            console.log(`[Storage] Local storage - metadata only: ${fullPath}`)
            externalId = `local_${randomUUID()}`
            break
        }
      } catch (storageError) {
        console.error("Storage upload error:", storageError)
        return NextResponse.json(
          { error: storageError instanceof Error ? storageError.message : "Failed to upload file to storage provider" },
          { status: 500 }
        )
      }
    } else {
      // No storage configured - store metadata only
      console.log(`[Storage] No storage configured, storing metadata only`)
      externalId = `metadata_${randomUUID()}`
    }
    
    // Create file record
    const result = await db
      .insert(files)
      .values({
        orgId: session.orgId,
        categoryId: category.id,
        name: customName || file.name,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storageIntegrationId: storageIntegration?.id ?? null,
        storagePath: fullPath,
        externalId,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        moduleScope: category.moduleScope,
        uploadedById: session.userId,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalMimeType: file.type,
          webUrl: webUrl ?? undefined, // SharePoint web URL for "View in SharePoint" feature
          storageProvider: storageIntegration?.provider ?? "metadata",
        },
      })
      .returning()
    
    const uploadedFile = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("filing.files", "file", {
        id: uploadedFile.id,
        name: uploadedFile.name,
        categoryId: category.id,
        categoryName: category.name,
        entityType,
        entityId,
      })
    }
    
    return NextResponse.json(toApiResponse(uploadedFile, category), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
