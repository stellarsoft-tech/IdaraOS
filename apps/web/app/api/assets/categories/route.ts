/**
 * Asset Categories API Routes
 * GET /api/assets/categories - List all categories
 * POST /api/assets/categories - Create a category
 * PUT /api/assets/categories - Bulk update categories (positions)
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, asc, and, sql, inArray } from "drizzle-orm"
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

// Create category schema
const CreateCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  icon: z.string().default("Box"),
  color: z.string().default("gray"),
  defaultDepreciationYears: z.number().min(0).max(50).optional(),
  level: z.number().int().min(0).default(0),
  sortOrder: z.number().int().min(0).default(0),
  positionX: z.number().int().default(0),
  positionY: z.number().int().default(0),
})

// Bulk update schema
const BulkUpdateCategoriesSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    positionX: z.number().int().optional(),
    positionY: z.number().int().optional(),
    parentId: z.string().uuid().nullable().optional(),
    level: z.number().int().min(0).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })),
})

// Transform DB record to API response
function toApiResponse(
  record: typeof assetCategories.$inferSelect,
  counts?: { childCount: number; assetCount: number }
) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description ?? undefined,
    parentId: record.parentId ?? null,
    icon: record.icon ?? "Box",
    color: record.color ?? "gray",
    defaultDepreciationYears: record.defaultDepreciationYears ? Number(record.defaultDepreciationYears) : undefined,
    level: record.level,
    sortOrder: record.sortOrder,
    positionX: record.positionX,
    positionY: record.positionY,
    childCount: counts?.childCount ?? 0,
    assetCount: counts?.assetCount ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * GET /api/assets/categories
 */
export async function GET(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.categories.view())
    const orgId = session.orgId
    
    // Get all categories
    const results = await db
      .select()
      .from(assetCategories)
      .where(eq(assetCategories.orgId, orgId))
      .orderBy(asc(assetCategories.sortOrder), asc(assetCategories.level), asc(assetCategories.name))
    
    // Get child counts
    const childCountsQuery = await db
      .select({
        parentId: assetCategories.parentId,
        count: sql<number>`count(*)::int`,
      })
      .from(assetCategories)
      .where(eq(assetCategories.orgId, orgId))
      .groupBy(assetCategories.parentId)
    
    const childCountMap = new Map<string, number>()
    for (const row of childCountsQuery) {
      if (row.parentId) {
        childCountMap.set(row.parentId, row.count)
      }
    }
    
    // Get asset counts
    const assetCountsQuery = await db
      .select({
        categoryId: assets.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(assets)
      .where(eq(assets.orgId, orgId))
      .groupBy(assets.categoryId)
    
    const assetCountMap = new Map<string, number>()
    for (const row of assetCountsQuery) {
      if (row.categoryId) {
        assetCountMap.set(row.categoryId, row.count)
      }
    }
    
    // Build response with counts
    const response = results.map(record => toApiResponse(record, {
      childCount: childCountMap.get(record.id) ?? 0,
      assetCount: assetCountMap.get(record.id) ?? 0,
    }))
    
    return NextResponse.json(response)
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assets/categories
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.categories.create())
    const orgId = session.orgId
    
    const body = await request.json()
    
    // Validate
    const parseResult = CreateCategorySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const data = parseResult.data
    const slug = slugify(data.name)
    
    // Check duplicate slug
    const existing = await db
      .select({ id: assetCategories.id })
      .from(assetCategories)
      .where(and(
        eq(assetCategories.orgId, orgId),
        eq(assetCategories.slug, slug)
      ))
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      )
    }
    
    // If parentId provided, verify it exists and get level
    let parentLevel = -1
    if (data.parentId) {
      const parent = await db
        .select({ id: assetCategories.id, level: assetCategories.level })
        .from(assetCategories)
        .where(and(
          eq(assetCategories.id, data.parentId),
          eq(assetCategories.orgId, orgId)
        ))
        .limit(1)
      
      if (parent.length === 0) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 }
        )
      }
      parentLevel = parent[0].level
    }
    
    // Calculate level if not provided
    const level = data.level ?? (parentLevel + 1)
    
    // Insert
    const result = await db
      .insert(assetCategories)
      .values({
        orgId,
        name: data.name,
        slug,
        description: data.description ?? null,
        parentId: data.parentId ?? null,
        icon: data.icon,
        color: data.color,
        defaultDepreciationYears: data.defaultDepreciationYears?.toString() ?? null,
        level,
        sortOrder: data.sortOrder,
        positionX: data.positionX,
        positionY: data.positionY,
      })
      .returning()
    
    const record = result[0]
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("assets.categories", "category", {
        id: record.id,
        name: record.name,
        slug: record.slug,
        parentId: record.parentId,
      })
    }
    
    return NextResponse.json(toApiResponse(record, { childCount: 0, assetCount: 0 }), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error creating category:", error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/assets/categories
 * Bulk update categories (for chart designer positions)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.categories.edit())
    const orgId = session.orgId
    
    const body = await request.json()
    
    // Validate
    const parseResult = BulkUpdateCategoriesSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const { updates } = parseResult.data
    
    if (updates.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0 })
    }
    
    // Verify all IDs belong to this org
    const categoryIds = updates.map(u => u.id)
    const existingCategories = await db
      .select({ id: assetCategories.id })
      .from(assetCategories)
      .where(and(
        eq(assetCategories.orgId, orgId),
        inArray(assetCategories.id, categoryIds)
      ))
    
    const existingIds = new Set(existingCategories.map(c => c.id))
    const invalidIds = categoryIds.filter(id => !existingIds.has(id))
    
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Some category IDs are invalid", invalidIds },
        { status: 400 }
      )
    }
    
    // Update each category
    let updatedCount = 0
    for (const update of updates) {
      const updateData: Partial<typeof assetCategories.$inferInsert> = {
        updatedAt: new Date(),
      }
      
      if (update.positionX !== undefined) updateData.positionX = update.positionX
      if (update.positionY !== undefined) updateData.positionY = update.positionY
      if (update.level !== undefined) updateData.level = update.level
      if (update.sortOrder !== undefined) updateData.sortOrder = update.sortOrder
      if (update.parentId !== undefined) updateData.parentId = update.parentId
      
      await db
        .update(assetCategories)
        .set(updateData)
        .where(and(
          eq(assetCategories.id, update.id),
          eq(assetCategories.orgId, orgId)
        ))
      
      updatedCount++
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "assets.categories",
        "bulk_update",
        categoryIds.join(","),
        `${updatedCount} categories`,
        { categoryIds, count: categoryIds.length },
        { categoryIds, updatedCount }
      )
    }
    
    return NextResponse.json({ success: true, updatedCount })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error bulk updating categories:", error)
    return NextResponse.json(
      { error: "Failed to bulk update categories" },
      { status: 500 }
    )
  }
}