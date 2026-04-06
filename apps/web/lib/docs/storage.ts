/**
 * Document Content Storage Resolver
 *
 * Provides a unified interface for reading/writing document MDX content
 * across three configurable storage modes:
 *   - database:  content stored in docs_documents.content column (default)
 *   - filing:    content stored in the Filing module (SharePoint / Azure Blob)
 *   - hybrid:    DB is the primary read store; writes go to both DB and Filing
 */

import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  documents,
  documentSettings,
  files,
  storageIntegrations,
} from "@/lib/db/schema"
import type { ContentStorageMode } from "@/lib/db/schema/docs"
import { uploadFileServerSide } from "@/lib/filing/upload"
import { getDownloadUrl as getSharePointDownloadUrl } from "@/lib/graph/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgSettings {
  contentStorageMode: ContentStorageMode
  defaultFileCategoryId: string | null
}

interface DocumentRecord {
  id: string
  orgId: string
  slug: string
  content: string | null
  storageMode: ContentStorageMode | null
  fileId: string | null
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Determine the effective storage mode for a document.
 * Per-document override wins, then org settings, then "database" default.
 */
export function resolveStorageMode(
  doc: Pick<DocumentRecord, "storageMode">,
  orgSettings: OrgSettings | null
): ContentStorageMode {
  return doc.storageMode ?? orgSettings?.contentStorageMode ?? "database"
}

/**
 * Fetch the org-level docs settings for the given organization.
 */
export async function getOrgDocsSettings(orgId: string): Promise<OrgSettings | null> {
  const [row] = await db
    .select({
      contentStorageMode: documentSettings.contentStorageMode,
      defaultFileCategoryId: documentSettings.defaultFileCategoryId,
    })
    .from(documentSettings)
    .where(eq(documentSettings.orgId, orgId))
    .limit(1)

  return row ?? null
}

/**
 * Read document content from the resolved storage backend.
 */
export async function readContent(
  doc: DocumentRecord,
  orgSettings: OrgSettings | null
): Promise<string | null> {
  const mode = resolveStorageMode(doc, orgSettings)

  switch (mode) {
    case "database":
    case "hybrid":
      return doc.content ?? null

    case "filing":
      return readContentFromFiling(doc)

    default:
      return doc.content ?? null
  }
}

/**
 * Write document content to the resolved storage backend(s).
 * Returns the updated fileId (if filing was involved), or null.
 */
export async function writeContent(
  doc: DocumentRecord,
  orgSettings: OrgSettings | null,
  content: string,
  userId: string
): Promise<{ fileId: string | null }> {
  const mode = resolveStorageMode(doc, orgSettings)
  let fileId = doc.fileId

  switch (mode) {
    case "database": {
      await db
        .update(documents)
        .set({ content, updatedAt: new Date() })
        .where(eq(documents.id, doc.id))
      break
    }

    case "filing": {
      const result = await writeContentToFiling(doc, orgSettings, content, userId)
      fileId = result.fileId
      await db
        .update(documents)
        .set({ fileId, content: null, updatedAt: new Date() })
        .where(eq(documents.id, doc.id))
      break
    }

    case "hybrid": {
      await db
        .update(documents)
        .set({ content, updatedAt: new Date() })
        .where(eq(documents.id, doc.id))

      // Fire-and-forget sync to filing – failures are logged but don't block
      writeContentToFiling(doc, orgSettings, content, userId)
        .then((result) => {
          db.update(documents)
            .set({ fileId: result.fileId })
            .where(eq(documents.id, doc.id))
            .then(() => {})
            .catch((e) => console.error("[Docs/Storage] Failed to persist fileId after hybrid sync:", e))
        })
        .catch((e) => {
          console.error("[Docs/Storage] Hybrid filing sync failed (non-blocking):", e)
        })
      break
    }
  }

  return { fileId }
}

/**
 * Delete content artefacts associated with a document.
 * Call this when a document is deleted so we don't leave orphans.
 */
export async function deleteContent(doc: DocumentRecord): Promise<void> {
  if (doc.fileId) {
    await db
      .update(files)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(files.id, doc.fileId))
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readContentFromFiling(doc: DocumentRecord): Promise<string | null> {
  if (!doc.fileId) {
    return doc.content ?? null
  }

  const result = await db
    .select({
      file: files,
      storage: storageIntegrations,
    })
    .from(files)
    .leftJoin(storageIntegrations, eq(files.storageIntegrationId, storageIntegrations.id))
    .where(and(eq(files.id, doc.fileId), eq(files.isDeleted, false)))
    .limit(1)

  if (result.length === 0) {
    return doc.content ?? null
  }

  const file = result[0].file
  const storage = result[0].storage

  if (!storage || storage.status !== "connected") {
    return doc.content ?? null
  }

  switch (storage.provider) {
    case "sharepoint": {
      if (!storage.siteId || !file.externalId) {
        return doc.content ?? null
      }
      const dlResult = await getSharePointDownloadUrl(
        storage.siteId,
        storage.driveId,
        file.externalId
      )
      if (!dlResult) {
        return doc.content ?? null
      }
      const res = await fetch(dlResult.downloadUrl)
      if (!res.ok) {
        return doc.content ?? null
      }
      return res.text()
    }

    case "azure_blob": {
      if (!storage.accountName || !storage.containerName || !file.storagePath) {
        return doc.content ?? null
      }
      const blobUrl = `https://${storage.accountName}.blob.core.windows.net/${storage.containerName}/${file.storagePath}`
      try {
        const res = await fetch(blobUrl)
        if (!res.ok) {
          return doc.content ?? null
        }
        return res.text()
      } catch {
        return doc.content ?? null
      }
    }

    default:
      return doc.content ?? null
  }
}

async function writeContentToFiling(
  doc: DocumentRecord,
  orgSettings: OrgSettings | null,
  content: string,
  userId: string
): Promise<{ fileId: string }> {
  const categoryId = orgSettings?.defaultFileCategoryId
  if (!categoryId) {
    throw new Error(
      "Filing storage is configured but no default file category is set. " +
      "Go to Docs > Settings and select a file category for document storage."
    )
  }

  // If there's an existing file record, soft-delete it before creating a new version
  if (doc.fileId) {
    await db
      .update(files)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(files.id, doc.fileId))
  }

  const mdxBuffer = Buffer.from(content, "utf-8")

  const result = await uploadFileServerSide({
    orgId: doc.orgId,
    categoryId,
    fileName: `${doc.slug}.mdx`,
    content: mdxBuffer,
    mimeType: "text/mdx",
    entityType: "document",
    entityId: doc.id,
    uploadedById: userId,
  })

  return { fileId: result.fileId }
}
