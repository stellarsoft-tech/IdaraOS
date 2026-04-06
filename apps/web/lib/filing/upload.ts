/**
 * Reusable server-side file upload logic for the Filing module.
 * Extracted from the upload API route so other modules (e.g., Docs)
 * can persist content to the configured storage backend programmatically.
 */

import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, fileCategories, storageIntegrations } from "@/lib/db/schema"
import { randomUUID } from "crypto"
import { uploadFile as uploadToSharePoint } from "@/lib/graph/client"

export interface ServerUploadInput {
  orgId: string
  categoryId: string
  fileName: string
  content: Buffer | ArrayBuffer
  mimeType: string
  entityType?: string
  entityId?: string
  uploadedById: string
  pathPrefix?: string
}

export interface ServerUploadResult {
  fileId: string
  storagePath: string
  externalId: string | null
  webUrl: string | null
}

/**
 * Upload a file to the configured storage backend (server-side, no HTTP).
 * Mirrors the logic in POST /api/files/upload but accepts raw buffers.
 */
export async function uploadFileServerSide(input: ServerUploadInput): Promise<ServerUploadResult> {
  const categoryResult = await db
    .select({
      category: fileCategories,
      storageIntegration: storageIntegrations,
    })
    .from(fileCategories)
    .leftJoin(storageIntegrations, eq(fileCategories.storageIntegrationId, storageIntegrations.id))
    .where(
      and(
        eq(fileCategories.id, input.categoryId),
        eq(fileCategories.orgId, input.orgId)
      )
    )
    .limit(1)

  if (categoryResult.length === 0) {
    throw new Error("File category not found")
  }

  const category = categoryResult[0].category
  const storageIntegration = categoryResult[0].storageIntegration

  const timestamp = Date.now()
  const uuid = randomUUID().split("-")[0]
  const ext = input.fileName.includes(".")
    ? input.fileName.substring(input.fileName.lastIndexOf("."))
    : ""
  const sanitizedName = input.fileName
    .replace(ext, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 50)
  const uniqueFilename = `${timestamp}_${uuid}_${sanitizedName}${ext}`

  let fullPath: string
  if (category.folderPath) {
    const baseFolderPath = category.folderPath.replace(/^\/|\/$/g, "")
    fullPath = input.pathPrefix
      ? `${baseFolderPath}/${input.pathPrefix}/${uniqueFilename}`
      : `${baseFolderPath}/${uniqueFilename}`
  } else {
    const basePath = `${input.orgId}/${category.moduleScope}/${category.slug}`
    fullPath = input.pathPrefix
      ? `${basePath}/${input.pathPrefix}/${uniqueFilename}`
      : `${basePath}/${uniqueFilename}`
  }

  if (storageIntegration?.basePath) {
    fullPath = `${storageIntegration.basePath.replace(/^\/|\/$/g, "")}/${fullPath}`
  }

  let externalId: string | null = null
  let webUrl: string | null = null

  if (storageIntegration && storageIntegration.status === "connected") {
    switch (storageIntegration.provider) {
      case "sharepoint": {
        if (!storageIntegration.siteId) {
          throw new Error("SharePoint integration not fully configured (missing site ID)")
        }
        const buffer: ArrayBuffer =
          input.content instanceof ArrayBuffer
            ? input.content
            : (() => {
                const src = new Uint8Array(input.content)
                const copy = new Uint8Array(src.byteLength)
                copy.set(src)
                return copy.buffer
              })()

        const driveItem = await uploadToSharePoint(
          storageIntegration.siteId,
          storageIntegration.driveId,
          fullPath.includes("/") ? fullPath.substring(0, fullPath.lastIndexOf("/")) : "",
          fullPath.includes("/") ? fullPath.substring(fullPath.lastIndexOf("/") + 1) : fullPath,
          buffer,
          input.mimeType
        )

        if (!driveItem) {
          throw new Error("Failed to upload file to SharePoint")
        }
        externalId = driveItem.id
        webUrl = driveItem.webUrl
        break
      }
      case "azure_blob":
        externalId = `blob_pending_${randomUUID()}`
        break
      case "local":
        externalId = `local_${randomUUID()}`
        break
    }
  } else {
    externalId = `metadata_${randomUUID()}`
  }

  const contentSize = input.content instanceof ArrayBuffer
    ? input.content.byteLength
    : input.content.length

  const result = await db
    .insert(files)
    .values({
      orgId: input.orgId,
      categoryId: category.id,
      name: input.fileName,
      originalName: input.fileName,
      mimeType: input.mimeType,
      size: contentSize,
      storageIntegrationId: storageIntegration?.id ?? null,
      storagePath: fullPath,
      externalId,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      moduleScope: category.moduleScope,
      uploadedById: input.uploadedById,
      metadata: {
        uploadedAt: new Date().toISOString(),
        originalMimeType: input.mimeType,
        webUrl: webUrl ?? undefined,
        storageProvider: storageIntegration?.provider ?? "metadata",
      },
    })
    .returning()

  return {
    fileId: result[0].id,
    storagePath: fullPath,
    externalId,
    webUrl,
  }
}
