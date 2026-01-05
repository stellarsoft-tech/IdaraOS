/**
 * File Categories API Routes
 * GET /api/filing/categories - List all file categories
 * POST /api/filing/categories - Create a new file category
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc, ilike, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { fileCategories, storageIntegrations } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

// Validation schema for creating file category
const CreateFileCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Slug must be lowercase alphanumeric with hyphens/underscores").optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  moduleScope: z.enum(["people", "assets", "workflows", "security", "docs", "vendors"]),
  storageIntegrationId: z.string().uuid().optional().nullable(),
  folderPath: z.string().optional(),
  isRequired: z.boolean().default(false),
  maxFileSize: z.number().int().positive().optional().nullable(),
  allowedMimeTypes: z.array(z.string()).optional().nullable(),
  sortOrder: z.number().int().default(0),
})

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .substring(0, 50)
}

// Response transformer
function toApiResponse(
  category: typeof fileCategories.$inferSelect,
  storageIntegration?: typeof storageIntegrations.$inferSelect | null
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
  }
}

/**
 * GET /api/filing/categories
 * List all file categories for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const moduleScope = searchParams.get("moduleScope")
    const search = searchParams.get("search")
    const activeOnly = searchParams.get("activeOnly") === "true"
    
    // Build conditions
    const conditions = [eq(fileCategories.orgId, session.orgId)]
    
    if (moduleScope) {
      conditions.push(eq(fileCategories.moduleScope, moduleScope as typeof fileCategories.moduleScope.enumValues[number]))
    }
    
    if (activeOnly) {
      conditions.push(eq(fileCategories.isActive, true))
    }
    
    if (search) {
      const searchCondition = or(
        ilike(fileCategories.name, `%${search}%`),
        ilike(fileCategories.description, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    // Fetch categories with storage integration info
    const results = await db
      .select({
        category: fileCategories,
        storageIntegration: storageIntegrations,
      })
      .from(fileCategories)
      .leftJoin(storageIntegrations, eq(fileCategories.storageIntegrationId, storageIntegrations.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(fileCategories.moduleScope, fileCategories.sortOrder, desc(fileCategories.createdAt))
    
    return NextResponse.json({
      data: results.map(r => toApiResponse(r.category, r.storageIntegration)),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error fetching file categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch file categories" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/filing/categories
 * Create a new file category
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    const body = await request.json()
    
    // Validate
    const parseResult = CreateFileCategorySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name)
    
    // Check for duplicate slug in same org + module
    const existing = await db
      .select({ id: fileCategories.id })
      .from(fileCategories)
      .where(
        and(
          eq(fileCategories.orgId, session.orgId),
          eq(fileCategories.moduleScope, data.moduleScope),
          eq(fileCategories.slug, slug)
        )
      )
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A category with this slug already exists in this module" },
        { status: 409 }
      )
    }
    
    // Validate storage integration if provided
    if (data.storageIntegrationId) {
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
    
    // Create category
    const result = await db
      .insert(fileCategories)
      .values({
        orgId: session.orgId,
        name: data.name,
        slug,
        description: data.description ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        moduleScope: data.moduleScope,
        storageIntegrationId: data.storageIntegrationId ?? null,
        folderPath: data.folderPath ?? null,
        isRequired: data.isRequired,
        maxFileSize: data.maxFileSize ?? null,
        allowedMimeTypes: data.allowedMimeTypes ?? null,
        sortOrder: data.sortOrder,
        createdById: session.userId,
      })
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
      await audit.logCreate("filing.categories", "file_category", {
        id: category.id,
        name: category.name,
        moduleScope: category.moduleScope,
      })
    }
    
    return NextResponse.json(toApiResponse(category, storageIntegration), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error creating file category:", error)
    return NextResponse.json(
      { error: "Failed to create file category" },
      { status: 500 }
    )
  }
}
