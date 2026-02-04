/**
 * Single Asset API Routes
 * GET /api/assets/[id] - Get asset details
 * PATCH /api/assets/[id] - Update asset
 * DELETE /api/assets/[id] - Delete asset
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, assetCategories, persons, assetLifecycleEvents, assetAssignments } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { processWorkflowEvent } from "@/lib/workflows/processor"
import { z } from "zod"

// Helper to convert empty strings to null for optional UUID fields
const optionalUuid = z.string().transform(val => val === "" ? null : val).pipe(z.string().uuid().nullable()).optional()

// Helper to convert empty strings to null for optional string fields
const optionalString = z.string().transform(val => val === "" ? null : val).nullable().optional()

// Update asset schema
const UpdateAssetSchema = z.object({
  assetTag: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: optionalString,
  categoryId: optionalUuid,
  status: z.enum(["available", "assigned", "maintenance", "retired", "disposed"]).optional(),
  serialNumber: optionalString,
  manufacturer: optionalString,
  model: optionalString,
  purchaseDate: optionalString,
  purchaseCost: optionalString,
  warrantyEnd: optionalString,
  location: optionalString,
  notes: optionalString,
  assignedToId: optionalUuid,
  assignedAt: optionalString,
}).strict()

// Category info type
interface CategoryInfo {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
}

// Assignee info type
interface AssigneeInfo {
  id: string
  name: string
  email: string
  slug: string
}

// Transform DB record to API response
function toApiResponse(
  record: typeof assets.$inferSelect,
  category?: CategoryInfo | null,
  assignee?: AssigneeInfo | null
) {
  return {
    id: record.id,
    assetTag: record.assetTag,
    name: record.name,
    description: record.description ?? undefined,
    categoryId: record.categoryId,
    category: category || null,
    status: record.status,
    serialNumber: record.serialNumber ?? undefined,
    manufacturer: record.manufacturer ?? undefined,
    model: record.model ?? undefined,
    purchaseDate: record.purchaseDate ?? undefined,
    purchaseCost: record.purchaseCost ?? undefined,
    warrantyEnd: record.warrantyEnd ?? undefined,
    location: record.location ?? undefined,
    assignedToId: record.assignedToId,
    assignedTo: assignee || null,
    assignedAt: record.assignedAt?.toISOString() ?? undefined,
    source: record.source,
    intuneDeviceId: record.intuneDeviceId ?? undefined,
    intuneComplianceState: record.intuneComplianceState ?? undefined,
    intuneEnrollmentType: record.intuneEnrollmentType ?? undefined,
    intuneLastSyncAt: record.intuneLastSyncAt?.toISOString() ?? undefined,
    syncEnabled: record.syncEnabled,
    notes: record.notes ?? undefined,
    customFields: record.customFields,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/assets/[id]
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.inventory.view())
    const orgId = session.orgId
    const { id } = await context.params
    
    // Fetch asset
    const result = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, id),
        eq(assets.orgId, orgId)
      ))
      .limit(1)
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      )
    }
    
    const asset = result[0]
    
    // Get category
    let category: CategoryInfo | null = null
    if (asset.categoryId) {
      const categoryResult = await db
        .select({
          id: assetCategories.id,
          name: assetCategories.name,
          slug: assetCategories.slug,
          icon: assetCategories.icon,
          color: assetCategories.color,
        })
        .from(assetCategories)
        .where(eq(assetCategories.id, asset.categoryId))
        .limit(1)
      
      if (categoryResult.length > 0) {
        category = categoryResult[0]
      }
    }
    
    // Get assignee
    let assignee: AssigneeInfo | null = null
    if (asset.assignedToId) {
      const assigneeResult = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        })
        .from(persons)
        .where(eq(persons.id, asset.assignedToId))
        .limit(1)
      
      if (assigneeResult.length > 0) {
        assignee = assigneeResult[0]
      }
    }
    
    return NextResponse.json(toApiResponse(asset, category, assignee))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching asset:", error)
    return NextResponse.json(
      { error: "Failed to fetch asset" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assets/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.inventory.edit())
    const orgId = session.orgId
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateAssetSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    // Check asset exists and belongs to org
    const existing = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, id),
        eq(assets.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    const data = parseResult.data
    
    // Check for duplicate asset tag if changing
    if (data.assetTag && data.assetTag !== previousValues.assetTag) {
      const duplicate = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(
          eq(assets.orgId, orgId),
          eq(assets.assetTag, data.assetTag)
        ))
        .limit(1)
      
      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: "An asset with this tag already exists" },
          { status: 409 }
        )
      }
    }
    
    // Build update object
    const updateData: Partial<typeof assets.$inferInsert> = {
      updatedAt: new Date(),
    }
    
    if (data.assetTag !== undefined) updateData.assetTag = data.assetTag
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
    if (data.status !== undefined) updateData.status = data.status
    if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer
    if (data.model !== undefined) updateData.model = data.model
    if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate
    if (data.purchaseCost !== undefined) updateData.purchaseCost = data.purchaseCost
    if (data.warrantyEnd !== undefined) updateData.warrantyEnd = data.warrantyEnd
    if (data.location !== undefined) updateData.location = data.location
    if (data.notes !== undefined) updateData.notes = data.notes
    
    // Handle assignment changes
    const now = new Date()
    const assignmentChanged = data.assignedToId !== undefined && data.assignedToId !== previousValues.assignedToId
    
    if (assignmentChanged) {
      updateData.assignedToId = data.assignedToId
      // Use provided assignedAt date or current time
      updateData.assignedAt = data.assignedAt ? new Date(data.assignedAt) : (data.assignedToId ? now : null)
      
      // Close existing assignment if there was one
      if (previousValues.assignedToId) {
        await db
          .update(assetAssignments)
          .set({ returnedAt: now })
          .where(and(
            eq(assetAssignments.assetId, id),
            eq(assetAssignments.personId, previousValues.assignedToId),
            isNull(assetAssignments.returnedAt)
          ))
        
        // Log return event
        await db.insert(assetLifecycleEvents).values({
          orgId,
          assetId: id,
          eventType: "returned",
          eventDate: now,
          details: {
            source: "manual",
            previousPersonId: previousValues.assignedToId,
          },
          performedById: session.userId,
        })
        
        // Get previous person info for workflow event
        const prevPersonResult = await db
          .select({ name: persons.name })
          .from(persons)
          .where(eq(persons.id, previousValues.assignedToId))
          .limit(1)
        
        // Trigger workflow event for asset return
        await processWorkflowEvent({
          type: "asset.returned",
          assetId: id,
          assetName: previousValues.name,
          previousPersonId: previousValues.assignedToId,
          previousPersonName: prevPersonResult[0]?.name ?? "Unknown",
          orgId,
          triggeredByUserId: session.userId,
        }).catch(err => console.error("[Assets API] Error triggering workflow:", err))
      }
      
      // Create new assignment if there's a new assignee
      if (data.assignedToId) {
        const assignedAt = data.assignedAt ? new Date(data.assignedAt) : now
        
        await db.insert(assetAssignments).values({
          assetId: id,
          personId: data.assignedToId,
          assignedAt,
          assignedById: session.userId,
          notes: "Manual assignment",
        })
        
        // Get person info for lifecycle event
        const personResult = await db
          .select({ name: persons.name, email: persons.email })
          .from(persons)
          .where(eq(persons.id, data.assignedToId))
          .limit(1)
        
        const person = personResult[0]
        
        // Log assignment event
        await db.insert(assetLifecycleEvents).values({
          orgId,
          assetId: id,
          eventType: "assigned",
          eventDate: assignedAt,
          details: {
            source: "manual",
            personId: data.assignedToId,
            personName: person?.name,
            personEmail: person?.email,
          },
          performedById: session.userId,
        })
        
        // Trigger workflow event for asset assignment
        await processWorkflowEvent({
          type: "asset.assigned",
          assetId: id,
          assetName: previousValues.name,
          personId: data.assignedToId,
          personName: person?.name ?? "Unknown",
          orgId,
          triggeredByUserId: session.userId,
        }).catch(err => console.error("[Assets API] Error triggering workflow:", err))
        
        // Auto-set status to "assigned" if currently "available"
        if (previousValues.status === "available" && !data.status) {
          updateData.status = "assigned"
        }
      } else {
        // Unassigning - auto-set status to "available" if currently "assigned"
        if (previousValues.status === "assigned" && !data.status) {
          updateData.status = "available"
        }
      }
    } else if (data.assignedAt !== undefined && previousValues.assignedToId) {
      // Only updating the assigned date without changing assignee
      updateData.assignedAt = data.assignedAt ? new Date(data.assignedAt) : null
    }
    
    // Update asset
    const result = await db
      .update(assets)
      .set(updateData)
      .where(eq(assets.id, id))
      .returning()
    
    const record = result[0]
    
    // Log lifecycle event if status changed (and not already logged via assignment)
    if (data.status && data.status !== previousValues.status && !assignmentChanged) {
      await db.insert(assetLifecycleEvents).values({
        orgId,
        assetId: id,
        eventType: data.status === "retired" ? "retired" : 
                   data.status === "disposed" ? "disposed" : 
                   data.status === "maintenance" ? "maintenance" : "transferred",
        details: {
          previousStatus: previousValues.status,
          newStatus: data.status,
        },
        performedById: session.userId,
      })
    }
    
    // Audit log the update
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("assets.inventory", "asset", record.id, record.name, previousValues as Record<string, unknown>, record as unknown as Record<string, unknown>)
    }
    
    return NextResponse.json(toApiResponse(record))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error updating asset:", error)
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assets/[id]
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.inventory.delete())
    const orgId = session.orgId
    const { id } = await context.params
    
    // Check asset exists
    const existing = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, id),
        eq(assets.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      )
    }
    
    const asset = existing[0]
    
    // Delete asset (cascades to assignments, maintenance, lifecycle)
    await db.delete(assets).where(eq(assets.id, id))
    
    // Audit log the deletion
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("assets.inventory", "asset", {
        id: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error deleting asset:", error)
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    )
  }
}

