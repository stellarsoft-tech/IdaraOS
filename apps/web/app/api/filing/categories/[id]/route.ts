/**
 * File Category Detail API Routes
 * GET /api/filing/categories/[id] - Get single category
 * PATCH /api/filing/categories/[id] - Update category
 * DELETE /api/filing/categories/[id] - Delete category
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { fileCategories, storageIntegrations, files } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Validation schema for updating file category
const UpdateFileCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  storageIntegrationId: z.string().uuid().optional().nullable(),
  folderPath: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
  maxFileSize: z.number().int().positive().optional().nullable(),
  allowedMimeTypes: z.array(z.string()).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

// Response transformer
function toApiResponse(
  category: typeof fileCategories.$inferSelect,
  storageIntegration?: typeof storageIntegrations.$inferSelect | null,
  fileCount?: number
) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    color: category.color,
    moduleScope: category.moduleScope,
    storageIntegrationId: category.storageIntegrationId,
    folderPath: category.folderPath,
    isRequired: category.isRequired,
    maxFileSize: category.maxFileSize,
    allowedMimeTypes: category.allowedMimeTypes,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    isSystemCategory: category.isSystemCategory,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    
    // Include storage info if available
    storageIntegration: storageIntegration ? {
      id: storageIntegration.id,
      provider: storageIntegration.provider,
      name: storageIntegration.name,
      status: storageIntegration.status,
    } : null,
    
    // Include file count if available
    fileCount: fileCount ?? undefined,
  }
}

/**
 * GET /api/filing/categories/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    const result = await db
      .select({
        category: fileCategories,
        storageIntegration: storageIntegrations,
      })
      .from(fileCategories)
      .leftJoin(storageIntegrations, eq(fileCategories.storageIntegrationId, storageIntegrations.id))
      .where(
        and(
          eq(fileCategories.id, id),
          eq(fileCategories.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: "File category not found" },
        { status: 404 }
      )
    }
    
    // Count files in this category
    const fileCountResult = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.categoryId, id),
          eq(files.isDeleted, false)
        )
      )
    
    return NextResponse.json(
      toApiResponse(result[0].category, result[0].storageIntegration, fileCountResult.length)
    )
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error fetching file category:", error)
    return NextResponse.json(
      { error: "Failed to fetch file category" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/filing/categories/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateFileCategorySchema.safeParse(body)
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
      .from(fileCategories)
      .where(
        and(
          eq(fileCategories.id, id),
          eq(fileCategories.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "File category not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    
    // Check slug uniqueness if changing
    if (data.slug && data.slug !== previousValues.slug) {
      const slugExists = await db
        .select({ id: fileCategories.id })
        .from(fileCategories)
        .where(
          and(
            eq(fileCategories.orgId, session.orgId),
            eq(fileCategories.moduleScope, previousValues.moduleScope),
            eq(fileCategories.slug, data.slug)
          )
        )
        .limit(1)
      
      if (slugExists.length > 0) {
        return NextResponse.json(
          { error: "A category with this slug already exists in this module" },
          { status: 409 }
        )
      }
    }
    
    // Validate storage integration if changing
    if (data.storageIntegrationId !== undefined && data.storageIntegrationId !== null) {
      const storageExists = await db
        .select({ id: storageIntegrations.id })
        .from(storageIntegrations)
        .where(
          and(
            eq(storageIntegrations.id, data.storageIntegrationId),
            eq(storageIntegrations.orgId, session.orgId)
          )
        )
        .limit(1)
      
      if (storageExists.length === 0) {
        return NextResponse.json(
          { error: "Storage integration not found" },
          { status: 400 }
        )
      }
    }
    
    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.description !== undefined) updateData.description = data.description
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.color !== undefined) updateData.color = data.color
    if (data.storageIntegrationId !== undefined) updateData.storageIntegrationId = data.storageIntegrationId
    if (data.folderPath !== undefined) updateData.folderPath = data.folderPath
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired
    if (data.maxFileSize !== undefined) updateData.maxFileSize = data.maxFileSize
    if (data.allowedMimeTypes !== undefined) updateData.allowedMimeTypes = data.allowedMimeTypes
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    
    // Update
    const result = await db
      .update(fileCategories)
      .set(updateData)
      .where(eq(fileCategories.id, id))
      .returning()
    
    const category = result[0]
    
    // Fetch storage integration for response
    let storageIntegration = null
    if (category.storageIntegrationId) {
      const storageResult = await db
        .select()
        .from(storageIntegrations)
        .where(eq(storageIntegrations.id, category.storageIntegrationId))
        .limit(1)
      storageIntegration = storageResult[0] ?? null
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "filing.categories",
        "file_category",
        id,
        category.name,
        previousValues as Record<string, unknown>,
        category as unknown as Record<string, unknown>
      )
    }
    
    return NextResponse.json(toApiResponse(category, storageIntegration))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error updating file category:", error)
    return NextResponse.json(
      { error: "Failed to update file category" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/filing/categories/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    
    // Check exists
    const existing = await db
      .select()
      .from(fileCategories)
      .where(
        and(
          eq(fileCategories.id, id),
          eq(fileCategories.orgId, session.orgId)
        )
      )
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "File category not found" },
        { status: 404 }
      )
    }
    
    // Check if any non-deleted files are using this category
    const filesUsingCategory = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.categoryId, id),
          eq(files.isDeleted, false)
        )
      )
      .limit(1)
    
    if (filesUsingCategory.length > 0) {
      // Soft delete - just deactivate
      await db
        .update(fileCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(fileCategories.id, id))
      
      // Audit log
      const audit = await getAuditLogger()
      if (audit) {
        await audit.log({
          module: "filing.categories",
          action: "deactivate",
          entityType: "file_category",
          entityId: id,
          entityName: existing[0].name,
          description: "Category deactivated (has associated files)",
          current: { reason: "Category has files, soft deleted instead" },
        })
      }
      
      return NextResponse.json({
        success: true,
        message: "Category deactivated (has associated files)",
      })
    }
    
    // Hard delete if no files
    await db
      .delete(fileCategories)
      .where(eq(fileCategories.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("filing.categories", "file_category", {
        id: existing[0].id,
        name: existing[0].name,
        moduleScope: existing[0].moduleScope,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error deleting file category:", error)
    return NextResponse.json(
      { error: "Failed to delete file category" },
      { status: 500 }
    )
  }
}
