/**
 * Organizational Level Detail API Routes
 * GET /api/people/levels/[id] - Get level by ID
 * PUT /api/people/levels/[id] - Update level
 * DELETE /api/people/levels/[id] - Delete level
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizationalLevels, organizationalRoles } from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Update level schema
const UpdateLevelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  code: z.string().min(1, "Code is required").max(10, "Code too long").optional(),
  description: z.string().max(500, "Description too long").nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// Transform DB record to API response
function toApiResponse(record: typeof organizationalLevels.$inferSelect, roleCount?: number) {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    description: record.description ?? undefined,
    sortOrder: record.sortOrder,
    roleCount: roleCount ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/people/levels/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    
    // Fetch the level
    const [level] = await db
      .select()
      .from(organizationalLevels)
      .where(
        and(
          eq(organizationalLevels.id, id),
          eq(organizationalLevels.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!level) {
      return NextResponse.json(
        { error: "Level not found" },
        { status: 404 }
      )
    }
    
    // Get count of roles using this level
    const [roleCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationalRoles)
      .where(eq(organizationalRoles.levelId, level.id))
    
    const roleCount = roleCountResult?.count ?? 0
    
    return NextResponse.json(toApiResponse(level, roleCount))
  } catch (error) {
    console.error("[Levels API] Error fetching level:", error)
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Failed to fetch level" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/levels/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    await requireSession()
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = UpdateLevelSchema.parse(body)
    
    // Fetch existing level
    const [existing] = await db
      .select()
      .from(organizationalLevels)
      .where(
        and(
          eq(organizationalLevels.id, id),
          eq(organizationalLevels.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json(
        { error: "Level not found" },
        { status: 404 }
      )
    }
    
    // Check for duplicate code if changing
    if (data.code && data.code !== existing.code) {
      const duplicate = await db
        .select({ id: organizationalLevels.id })
        .from(organizationalLevels)
        .where(
          and(
            eq(organizationalLevels.orgId, orgId),
            eq(organizationalLevels.code, data.code)
          )
        )
        .limit(1)
      
      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: "A level with this code already exists" },
          { status: 409 }
        )
      }
    }
    
    // Build update data
    const updateData: Partial<typeof organizationalLevels.$inferInsert> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.code !== undefined) {
      updateData.code = data.code
    }
    if (data.description !== undefined) {
      updateData.description = data.description
    }
    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder
    }
    
    // Update the level
    const [record] = await db
      .update(organizationalLevels)
      .set(updateData)
      .where(eq(organizationalLevels.id, id))
      .returning()
    
    // Build changes for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (data.name !== undefined && data.name !== existing.name) {
      changes.name = { old: existing.name, new: data.name }
    }
    if (data.code !== undefined && data.code !== existing.code) {
      changes.code = { old: existing.code, new: data.code }
    }
    if (data.description !== undefined && data.description !== existing.description) {
      changes.description = { old: existing.description, new: data.description }
    }
    if (data.sortOrder !== undefined && data.sortOrder !== existing.sortOrder) {
      changes.sortOrder = { old: existing.sortOrder, new: data.sortOrder }
    }
    
    // Audit log the update
    if (Object.keys(changes).length > 0 && auditLog) {
      await auditLog.logUpdate(
        "people.levels",
        "organizational_level",
        record.id,
        record.name,
        existing,
        record
      )
    }
    
    return NextResponse.json(toApiResponse(record))
  } catch (error) {
    console.error("[Levels API] Error updating level:", error)
    
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
      { error: "Failed to update level" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/people/levels/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    await requireSession()
    const auditLog = await getAuditLogger()
    
    // Fetch existing level
    const [existing] = await db
      .select()
      .from(organizationalLevels)
      .where(
        and(
          eq(organizationalLevels.id, id),
          eq(organizationalLevels.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json(
        { error: "Level not found" },
        { status: 404 }
      )
    }
    
    // Check if level is in use
    const [roleCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationalRoles)
      .where(eq(organizationalRoles.levelId, id))
    
    if (roleCount && roleCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete level that is assigned to ${roleCount.count} role(s). Reassign roles first.` },
        { status: 400 }
      )
    }
    
    // Delete the level
    await db.delete(organizationalLevels).where(eq(organizationalLevels.id, id))
    
    // Audit log the deletion
    if (auditLog) {
      await auditLog.logDelete("people.levels", "organizational_level", {
        id: existing.id,
        name: existing.name,
        code: existing.code,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Levels API] Error deleting level:", error)
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Failed to delete level" },
      { status: 500 }
    )
  }
}

