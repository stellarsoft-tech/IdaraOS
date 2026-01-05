/**
 * Asset Return API Routes
 * POST /api/assets/[id]/return - Return asset from assignment
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, assetAssignments, assetLifecycleEvents, persons } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

const ReturnSchema = z.object({
  notes: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/assets/[id]/return
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    
    // Validate
    const parseResult = ReturnSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const session = await requirePermission(...P.assets.assignments.edit())
    const orgId = session.orgId
    const { notes } = parseResult.data
    
    // Check asset exists and belongs to org
    const assetResult = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, id),
        eq(assets.orgId, orgId)
      ))
      .limit(1)
    
    if (assetResult.length === 0) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      )
    }
    
    const asset = assetResult[0]
    
    // Check if assigned
    if (!asset.assignedToId) {
      return NextResponse.json(
        { error: "Asset is not currently assigned" },
        { status: 400 }
      )
    }
    
    // Get the person for the audit log
    const personResult = await db
      .select()
      .from(persons)
      .where(eq(persons.id, asset.assignedToId))
      .limit(1)
    
    const person = personResult[0]
    const now = new Date()
    
    // Update asset
    await db
      .update(assets)
      .set({
        assignedToId: null,
        assignedAt: null,
        status: "available",
        updatedAt: now,
      })
      .where(eq(assets.id, id))
    
    // Update assignment record (mark as returned)
    await db
      .update(assetAssignments)
      .set({
        returnedAt: now,
        notes: notes ? `${assetAssignments.notes ?? ""}\nReturn: ${notes}`.trim() : undefined,
      })
      .where(and(
        eq(assetAssignments.assetId, id),
        isNull(assetAssignments.returnedAt)
      ))
    
    // Create lifecycle event
    await db.insert(assetLifecycleEvents).values({
      orgId,
      assetId: id,
      eventType: "returned",
      eventDate: now,
      details: {
        personId: asset.assignedToId,
        personName: person?.name,
        personEmail: person?.email,
        notes,
      },
      performedById: session.userId,
    })
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("assets.assignments", "asset", asset.id, asset.name, { assignedToId: asset.assignedToId, status: asset.status }, { assignedToId: null, status: "available" })
    }
    
    return NextResponse.json({
      success: true,
      message: person ? `Asset returned from ${person.name}` : "Asset returned",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error returning asset:", error)
    return NextResponse.json(
      { error: "Failed to return asset" },
      { status: 500 }
    )
  }
}

