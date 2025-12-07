/**
 * Asset Maintenance Record API Routes
 * GET /api/assets/maintenance/[id] - Get a maintenance record
 * PATCH /api/assets/maintenance/[id] - Update a maintenance record
 * DELETE /api/assets/maintenance/[id] - Delete a maintenance record
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetMaintenanceRecords, assets, users, persons, assetLifecycleEvents } from "@/lib/db/schema"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

// Update maintenance schema
const UpdateMaintenanceSchema = z.object({
  type: z.enum(["scheduled", "repair", "upgrade"]).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  description: z.string().optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
  completedDate: z.string().optional().nullable(),
  cost: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/assets/maintenance/[id]
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const session = await requireSession()
    const orgId = session.orgId
    
    // Fetch record
    const results = await db
      .select()
      .from(assetMaintenanceRecords)
      .where(and(
        eq(assetMaintenanceRecords.id, id),
        eq(assetMaintenanceRecords.orgId, orgId)
      ))
      .limit(1)
    
    if (results.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found" },
        { status: 404 }
      )
    }
    
    const record = results[0]
    
    // Get asset
    const assetResult = record.assetId
      ? await db.select().from(assets).where(eq(assets.id, record.assetId)).limit(1)
      : []
    
    // Get performed by
    const performedByResult = record.performedById
      ? await db.select().from(users).where(eq(users.id, record.performedById)).limit(1)
      : []
    
    // Get assigned to
    const assignedToResult = record.assignedToId
      ? await db.select().from(persons).where(eq(persons.id, record.assignedToId)).limit(1)
      : []
    
    return NextResponse.json({
      id: record.id,
      assetId: record.assetId,
      asset: assetResult[0] ? {
        id: assetResult[0].id,
        assetTag: assetResult[0].assetTag,
        name: assetResult[0].name,
      } : null,
      type: record.type,
      status: record.status,
      description: record.description,
      scheduledDate: record.scheduledDate,
      completedDate: record.completedDate,
      cost: record.cost,
      vendor: record.vendor,
      performedBy: performedByResult[0] ? {
        id: performedByResult[0].id,
        name: performedByResult[0].name,
        email: performedByResult[0].email,
      } : null,
      assignedToId: record.assignedToId,
      assignedTo: assignedToResult[0] ? {
        id: assignedToResult[0].id,
        name: assignedToResult[0].name,
        email: assignedToResult[0].email,
        slug: assignedToResult[0].slug,
      } : null,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching maintenance record:", error)
    return NextResponse.json(
      { error: "Failed to fetch maintenance record" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assets/maintenance/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateMaintenanceSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const session = await requireSession()
    const orgId = session.orgId
    const data = parseResult.data
    
    // Check record exists and belongs to org
    const existing = await db
      .select()
      .from(assetMaintenanceRecords)
      .where(and(
        eq(assetMaintenanceRecords.id, id),
        eq(assetMaintenanceRecords.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found" },
        { status: 404 }
      )
    }
    
    const oldRecord = existing[0]
    const now = new Date()
    
    // Validate assignedToId if provided
    if (data.assignedToId) {
      const personResult = await db
        .select()
        .from(persons)
        .where(and(
          eq(persons.id, data.assignedToId),
          eq(persons.orgId, orgId)
        ))
        .limit(1)
      
      if (personResult.length === 0) {
        return NextResponse.json(
          { error: "Assigned person not found" },
          { status: 400 }
        )
      }
    }
    
    // Build update object
    const updateData: Partial<typeof assetMaintenanceRecords.$inferInsert> = {
      updatedAt: now,
    }
    
    if (data.type !== undefined) updateData.type = data.type
    if (data.status !== undefined) updateData.status = data.status
    if (data.description !== undefined) updateData.description = data.description || null
    
    // Handle date fields: convert empty strings to null
    if (data.scheduledDate !== undefined) {
      updateData.scheduledDate = data.scheduledDate || null
    }
    if (data.completedDate !== undefined) {
      updateData.completedDate = data.completedDate || null
    }
    
    // Handle numeric fields: convert empty strings to null
    if (data.cost !== undefined) {
      updateData.cost = data.cost || null
    }
    
    // Handle other nullable string fields
    if (data.vendor !== undefined) updateData.vendor = data.vendor || null
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null
    if (data.notes !== undefined) updateData.notes = data.notes || null
    
    // Update record
    const result = await db
      .update(assetMaintenanceRecords)
      .set(updateData)
      .where(eq(assetMaintenanceRecords.id, id))
      .returning()
    
    const record = result[0]
    
    // Handle status transitions
    if (data.status && data.status !== oldRecord.status) {
      // If completing, set completed date if not provided
      if (data.status === "completed" && !data.completedDate && !record.completedDate) {
        await db
          .update(assetMaintenanceRecords)
          .set({ completedDate: now.toISOString().split("T")[0] })
          .where(eq(assetMaintenanceRecords.id, id))
      }
      
      // If starting work, update asset status to maintenance
      if (data.status === "in_progress") {
        const asset = await db.select().from(assets).where(eq(assets.id, oldRecord.assetId)).limit(1)
        if (asset.length > 0 && asset[0].status !== "maintenance") {
          await db
            .update(assets)
            .set({ status: "maintenance", updatedAt: now })
            .where(eq(assets.id, oldRecord.assetId))
          
          // Add lifecycle event
          await db.insert(assetLifecycleEvents).values({
            orgId,
            assetId: oldRecord.assetId,
            eventType: "maintenance",
            details: {
              maintenanceId: id,
              type: record.type,
              description: record.description,
            },
            performedById: session.userId,
          })
        }
      }
      
      // If completed, reset asset status if it was in maintenance
      if (data.status === "completed") {
        const asset = await db.select().from(assets).where(eq(assets.id, oldRecord.assetId)).limit(1)
        if (asset.length > 0 && asset[0].status === "maintenance") {
          // Check if there are other in_progress maintenance records
          const otherMaintenance = await db
            .select()
            .from(assetMaintenanceRecords)
            .where(and(
              eq(assetMaintenanceRecords.assetId, oldRecord.assetId),
              eq(assetMaintenanceRecords.status, "in_progress")
            ))
          
          if (otherMaintenance.length === 0) {
            // Restore to assigned or available based on assignedToId
            const newStatus = asset[0].assignedToId ? "assigned" : "available"
            await db
              .update(assets)
              .set({ status: newStatus, updatedAt: now })
              .where(eq(assets.id, oldRecord.assetId))
          }
        }
      }
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "assets.maintenance",
        "maintenance",
        id,
        `Maintenance #${id.slice(0, 8)}`,
        { status: oldRecord.status, type: oldRecord.type },
        { status: record.status, type: record.type }
      )
    }
    
    return NextResponse.json({
      id: record.id,
      assetId: record.assetId,
      type: record.type,
      status: record.status,
      description: record.description,
      scheduledDate: record.scheduledDate,
      completedDate: record.completedDate,
      cost: record.cost,
      vendor: record.vendor,
      assignedToId: record.assignedToId,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error updating maintenance record:", error)
    return NextResponse.json(
      { error: "Failed to update maintenance record" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assets/maintenance/[id]
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const session = await requireSession()
    const orgId = session.orgId
    
    // Check record exists and belongs to org
    const existing = await db
      .select()
      .from(assetMaintenanceRecords)
      .where(and(
        eq(assetMaintenanceRecords.id, id),
        eq(assetMaintenanceRecords.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found" },
        { status: 404 }
      )
    }
    
    // Delete record
    await db
      .delete(assetMaintenanceRecords)
      .where(eq(assetMaintenanceRecords.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("assets.maintenance", "maintenance", {
        id,
        assetId: existing[0].assetId,
        type: existing[0].type,
      })
    }
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error deleting maintenance record:", error)
    return NextResponse.json(
      { error: "Failed to delete maintenance record" },
      { status: 500 }
    )
  }
}

