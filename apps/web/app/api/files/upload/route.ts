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

// Utility to generate a unique file path
function generateStoragePath(
  orgId: string,
  moduleScope: string,
  categorySlug: string,
  originalName: string
): string {
  const timestamp = Date.now()
  const uuid = randomUUID().split("-")[0]
  const ext = originalName.includes(".") 
    ? originalName.substring(originalName.lastIndexOf(".")) 
    : ""
  const sanitizedName = originalName
    .replace(ext, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 50)
  
  return `${orgId}/${moduleScope}/${categorySlug}/${timestamp}_${uuid}_${sanitizedName}${ext}`
}

// Response transformer
function toApiResponse(
  file: typeof files.$inferSelect,
  category?: typeof fileCategories.$inferSelect | null
) {
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
    const entityType = formData.get("entityType") as string | null
    const entityId = formData.get("entityId") as string | null
    const customName = formData.get("name") as string | null
    
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
    
    // Generate storage path
    const storagePath = generateStoragePath(
      session.orgId,
      category.moduleScope,
      category.slug,
      file.name
    )
    
    // Prepend base path and folder path if configured
    let fullPath = storagePath
    if (storageIntegration?.basePath) {
      fullPath = `${storageIntegration.basePath.replace(/^\/|\/$/g, "")}/${fullPath}`
    }
    if (category.folderPath) {
      fullPath = `${category.folderPath.replace(/^\/|\/$/g, "")}/${fullPath}`
    }
    
    let externalId: string | null = null
    
    // Upload to storage provider
    if (storageIntegration && storageIntegration.status === "connected") {
      try {
        switch (storageIntegration.provider) {
          case "sharepoint":
            // TODO: Implement SharePoint upload using Microsoft Graph
            // const graphClient = await getGraphClient()
            // const result = await graphClient.api(`/sites/${storageIntegration.siteId}/drive/root:/${fullPath}:/content`)
            //   .put(await file.arrayBuffer())
            // externalId = result.id
            console.log(`[Storage] Would upload to SharePoint: ${fullPath}`)
            externalId = `sp_${randomUUID()}`
            break
            
          case "azure_blob":
            // TODO: Implement Azure Blob upload using @azure/storage-blob
            // const blobServiceClient = BlobServiceClient.fromConnectionString(...)
            // const containerClient = blobServiceClient.getContainerClient(storageIntegration.containerName)
            // const blockBlobClient = containerClient.getBlockBlobClient(fullPath)
            // await blockBlobClient.uploadData(await file.arrayBuffer())
            console.log(`[Storage] Would upload to Azure Blob: ${fullPath}`)
            externalId = `blob_${randomUUID()}`
            break
            
          case "local":
            // TODO: Implement local file storage
            // For local development, we could store in ./uploads
            console.log(`[Storage] Would upload to local storage: ${fullPath}`)
            externalId = `local_${randomUUID()}`
            break
        }
      } catch (storageError) {
        console.error("Storage upload error:", storageError)
        return NextResponse.json(
          { error: "Failed to upload file to storage provider" },
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
