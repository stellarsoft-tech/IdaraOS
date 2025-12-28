/**
 * Organizational Levels API Routes
 * GET /api/people/levels - List all organizational levels
 * POST /api/people/levels - Create a level
 * PUT /api/people/levels - Bulk update (for reordering)
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizationalLevels } from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Create level schema
const CreateLevelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  code: z.string().min(1, "Code is required").max(10, "Code too long"),
  description: z.string().max(500, "Description too long").optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// Bulk update schema for reordering
const BulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(10).optional(),
    description: z.string().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })),
})

// Transform DB record to API response
function toApiResponse(record: typeof organizationalLevels.$inferSelect) {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    description: record.description ?? undefined,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * GET /api/people/levels
 */
export async function GET(request: NextRequest) {
  try {
    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)
    
    // Fetch all levels ordered by sortOrder
    const levels = await db
      .select()
      .from(organizationalLevels)
      .where(eq(organizationalLevels.orgId, orgId))
      .orderBy(asc(organizationalLevels.sortOrder), asc(organizationalLevels.name))
    
    return NextResponse.json(levels.map(toApiResponse))
  } catch (error) {
    console.error("[Levels API] Error listing levels:", error)
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Failed to fetch levels" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/people/levels
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = await requireOrgId(request)
    await requireSession()
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = CreateLevelSchema.parse(body)
    
    // Check for duplicate code
    const existing = await db
      .select({ id: organizationalLevels.id })
      .from(organizationalLevels)
      .where(eq(organizationalLevels.orgId, orgId))
    
    const duplicateCode = existing.length > 0 
      ? await db
          .select({ id: organizationalLevels.id })
          .from(organizationalLevels)
          .where(eq(organizationalLevels.code, data.code))
          .limit(1)
      : []
    
    if (duplicateCode.length > 0) {
      return NextResponse.json(
        { error: "A level with this code already exists" },
        { status: 409 }
      )
    }
    
    // Calculate sortOrder if not provided
    let sortOrder = data.sortOrder
    if (sortOrder === undefined) {
      const [maxOrder] = await db
        .select({ max: organizationalLevels.sortOrder })
        .from(organizationalLevels)
        .where(eq(organizationalLevels.orgId, orgId))
        .limit(1)
      
      sortOrder = (maxOrder?.max ?? -1) + 1
    }
    
    // Create the level
    const [record] = await db
      .insert(organizationalLevels)
      .values({
        orgId,
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        sortOrder,
      })
      .returning()
    
    // Audit log the creation
    if (auditLog) {
      await auditLog.logCreate("people.levels", "organizational_level", {
        id: record.id,
        name: record.name,
        code: record.code,
      })
    }
    
    return NextResponse.json(toApiResponse(record), { status: 201 })
  } catch (error) {
    console.error("[Levels API] Error creating level:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: "Failed to create level" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/levels - Bulk update for reordering
 */
export async function PUT(request: NextRequest) {
  try {
    const orgId = await requireOrgId(request)
    await requireSession()
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = BulkUpdateSchema.parse(body)
    
    // Update each level
    const results = []
    for (const update of data.updates) {
      // Verify the level belongs to this org
      const [existing] = await db
        .select()
        .from(organizationalLevels)
        .where(eq(organizationalLevels.id, update.id))
        .limit(1)
      
      if (!existing || existing.orgId !== orgId) {
        continue // Skip levels that don't exist or belong to another org
      }
      
      // Build update data
      const updateData: Partial<typeof organizationalLevels.$inferInsert> = {
        updatedAt: new Date(),
      }
      
      if (update.name !== undefined) {
        updateData.name = update.name
      }
      if (update.code !== undefined) {
        updateData.code = update.code
      }
      if (update.description !== undefined) {
        updateData.description = update.description
      }
      if (update.sortOrder !== undefined) {
        updateData.sortOrder = update.sortOrder
      }
      
      const [record] = await db
        .update(organizationalLevels)
        .set(updateData)
        .where(eq(organizationalLevels.id, update.id))
        .returning()
      
      results.push(toApiResponse(record))
    }
    
    // Audit log the bulk update
    if (auditLog && results.length > 0) {
      await auditLog.logUpdate(
        "people.levels",
        "organizational_level_bulk",
        "bulk",
        `Updated ${results.length} levels`,
        {},
        { count: results.length }
      )
    }
    
    return NextResponse.json(results)
  } catch (error) {
    console.error("[Levels API] Error bulk updating levels:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: "Failed to update levels" },
      { status: 500 }
    )
  }
}

