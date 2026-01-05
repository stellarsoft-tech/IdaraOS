/**
 * Single Category API Routes
 * GET /api/assets/categories/[id] - Get category details
 * PATCH /api/assets/categories/[id] - Update category
 * DELETE /api/assets/categories/[id] - Delete category
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetCategories, assets } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
}

// Update category schema
const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
  defaultDepreciationYears: z.number().min(0).max(50).optional().nullable(),
}).strict()

// Transform DB record to API response
function toApiResponse(record: typeof assetCategories.$inferSelect) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description ?? undefined,
    parentId: record.parentId ?? undefined,
    icon: record.icon ?? "Box",
    color: record.color ?? "gray",
    defaultDepreciationYears: record.defaultDepreciationYears ? Number(record.defaultDepreciationYears) : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/assets/categories/[id]
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.categories.view())
    const orgId = session.orgId
    const { id } = await context.params
    
    const result = await db
      .select()
      .from(assetCategories)
      .where(and(
        eq(assetCategories.id, id),
        eq(assetCategories.orgId, orgId)
      ))
      .limit(1)
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(toApiResponse(result[0]))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching category:", error)
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assets/categories/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.categories.edit())
    const orgId = session.orgId
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateCategorySchema.safeParse(body)
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
      .from(assetCategories)
      .where(and(
        eq(assetCategories.id, id),
        eq(assetCategories.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    
    // Build update object
    const updateData: Partial<typeof assetCategories.$inferInsert> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) {
      updateData.name = data.name
      updateData.slug = slugify(data.name)
    }
    if (data.description !== undefined) updateData.description = data.description
    if (data.parentId !== undefined) {
      // Prevent circular reference
      if (data.parentId === id) {
        return NextResponse.json(
          { error: "Category cannot be its own parent" },
          { status: 400 }
        )
      }
      updateData.parentId = data.parentId
    }
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.color !== undefined) updateData.color = data.color
    if (data.defaultDepreciationYears !== undefined) {
      updateData.defaultDepreciationYears = data.defaultDepreciationYears?.toString() ?? null
    }
    
    // Update
    const result = await db
      .update(assetCategories)
      .set(updateData)
      .where(eq(assetCategories.id, id))
      .returning()
    
    const record = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("assets.categories", "category", record.id, record.name, previousValues as Record<string, unknown>, record as unknown as Record<string, unknown>)
    }
    
    return NextResponse.json(toApiResponse(record))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error updating category:", error)
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assets/categories/[id]
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.categories.delete())
    const orgId = session.orgId
    const { id } = await context.params
    
    // Check exists
    const existing = await db
      .select()
      .from(assetCategories)
      .where(and(
        eq(assetCategories.id, id),
        eq(assetCategories.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }
    
    const category = existing[0]
    
    // Update assets in this category to have no category
    await db
      .update(assets)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(eq(assets.categoryId, id))
    
    // Update child categories to have no parent
    await db
      .update(assetCategories)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(assetCategories.parentId, id))
    
    // Delete category
    await db.delete(assetCategories).where(eq(assetCategories.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("assets.categories", "category", {
        id: category.id,
        name: category.name,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error deleting category:", error)
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    )
  }
}

