/**
 * File Detail API Routes
 * GET /api/files/[id] - Get file details
 * PATCH /api/files/[id] - Update file metadata
 * DELETE /api/files/[id] - Soft delete file
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, fileCategories, users, storageIntegrations } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Update schema
const UpdateFileSchema = z.object({
  name: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Response transformer
function toApiResponse(
  file: typeof files.$inferSelect,
  category?: typeof fileCategories.$inferSelect | null,
  uploader?: { id: string; name: string | null; email: string } | null,
  storage?: typeof storageIntegrations.$inferSelect | null
) {
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    storagePath: file.storagePath,
    externalId: file.externalId,
    entityType: file.entityType,
    entityId: file.entityId,
    moduleScope: file.moduleScope,
    metadata: file.metadata,
    isDeleted: file.isDeleted,
    deletedAt: file.deletedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    
    // Relations
    category: category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      color: category.color,
    } : null,
    
    uploadedBy: uploader ? {
      id: uploader.id,
      name: uploader.name,
      email: uploader.email,
    } : null,
    
    storageIntegration: storage ? {
      id: storage.id,
      provider: storage.provider,
      name: storage.name,
    } : null,
  }
}

/**
 * GET /api/files/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    const result = await db
      .select({
        file: files,
        category: fileCategories,
        uploader: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        storage: storageIntegrations,
      })
      .from(files)
      .leftJoin(fileCategories, eq(files.categoryId, fileCategories.id))
      .leftJoin(users, eq(files.uploadedById, users.id))
      .leftJoin(storageIntegrations, eq(files.storageIntegrationId, storageIntegrations.id))
      .where(
        and(
          eq(files.id, id),
          eq(files.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(toApiResponse(
      result[0].file,
      result[0].category,
      result[0].uploader,
      result[0].storage
    ))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error fetching file:", error)
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/files/[id]
 * Update file metadata (name, custom metadata)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateFileSchema.safeParse(body)
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
      .from(files)
      .where(
        and(
          eq(files.id, id),
          eq(files.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    
    // Build update
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.metadata !== undefined) {
      // Merge metadata
      updateData.metadata = {
        ...(previousValues.metadata as Record<string, unknown> || {}),
        ...data.metadata,
      }
    }
    
    // Update
    const result = await db
      .update(files)
      .set(updateData)
      .where(eq(files.id, id))
      .returning()
    
    const updatedFile = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "filing.files",
        "file",
        id,
        updatedFile.name,
        { name: previousValues.name },
        { name: updatedFile.name }
      )
    }
    
    // Fetch full file with relations
    const fullResult = await db
      .select({
        file: files,
        category: fileCategories,
        uploader: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        storage: storageIntegrations,
      })
      .from(files)
      .leftJoin(fileCategories, eq(files.categoryId, fileCategories.id))
      .leftJoin(users, eq(files.uploadedById, users.id))
      .leftJoin(storageIntegrations, eq(files.storageIntegrationId, storageIntegrations.id))
      .where(eq(files.id, id))
      .limit(1)
    
    return NextResponse.json(toApiResponse(
      fullResult[0].file,
      fullResult[0].category,
      fullResult[0].uploader,
      fullResult[0].storage
    ))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error updating file:", error)
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/files/[id]
 * Soft delete file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    // Check exists
    const existing = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, id),
          eq(files.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }
    
    const file = existing[0]
    
    // Soft delete
    await db
      .update(files)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(files.id, id))
    
    // TODO: Optionally delete from storage provider
    // For now, we just soft delete the metadata
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("filing.files", "file", {
        id: file.id,
        name: file.name,
        categoryId: file.categoryId,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error deleting file:", error)
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    )
  }
}
