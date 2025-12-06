/**
 * Asset Categories API Routes
 * GET /api/assets/categories - List all categories
 * POST /api/assets/categories - Create a category
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, asc, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetCategories } from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
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
})

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

/**
 * GET /api/assets/categories
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireOrgId(request)
    
    const results = await db
      .select()
      .from(assetCategories)
      .where(eq(assetCategories.orgId, orgId))
      .orderBy(asc(assetCategories.name))
    
    return NextResponse.json(results.map(toApiResponse))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
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
    const body = await request.json()
    
    // Validate
    const parseResult = CreateCategorySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const session = await requireSession()
    const orgId = session.orgId
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
    
    // If parentId provided, verify it exists
    if (data.parentId) {
      const parent = await db
        .select({ id: assetCategories.id })
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
    }
    
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
    
    return NextResponse.json(toApiResponse(record), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error creating category:", error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}

