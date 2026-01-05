/**
 * Files API Routes
 * GET /api/files - List files with filters
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc, ilike, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, fileCategories, users, storageIntegrations } from "@/lib/db/schema"
import { requireSession } from "@/lib/api/context"

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
 * GET /api/files
 * List files with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    
    // Parse query params
    const moduleScope = searchParams.get("moduleScope")
    const categoryId = searchParams.get("categoryId")
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")
    const search = searchParams.get("search")
    const includeDeleted = searchParams.get("includeDeleted") === "true"
    const page = parseInt(searchParams.get("page") ?? "1", 10)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100)
    const offset = (page - 1) * limit
    
    // Build base query conditions
    const conditions = [eq(files.orgId, session.orgId)]
    
    if (!includeDeleted) {
      conditions.push(eq(files.isDeleted, false))
    }
    
    if (moduleScope) {
      conditions.push(eq(files.moduleScope, moduleScope as typeof files.moduleScope.enumValues[number]))
    }
    
    if (categoryId) {
      conditions.push(eq(files.categoryId, categoryId))
    }
    
    if (entityType && entityId) {
      conditions.push(eq(files.entityType, entityType))
      conditions.push(eq(files.entityId, entityId))
    }
    
    if (search) {
      const searchCondition = or(
        ilike(files.name, `%${search}%`),
        ilike(files.originalName, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)
    
    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(files)
      .where(whereClause)
    
    const total = countResult[0]?.count ?? 0
    
    // Fetch files with relations
    const results = await db
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
      .where(whereClause)
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset)
    
    return NextResponse.json({
      data: results.map(r => toApiResponse(r.file, r.category, r.uploader, r.storage)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.error("Error fetching files:", error)
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    )
  }
}
