/**
 * Asset Assignment API Routes
 * POST /api/assets/[id]/assign - Assign asset to person
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, assetAssignments, assetLifecycleEvents, persons } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

const AssignSchema = z.object({
  personId: z.string().uuid("Invalid person ID"),
  notes: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/assets/[id]/assign
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = AssignSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const session = await requirePermission(...P.assets.assignments.create())
    const orgId = session.orgId
    const { personId, notes } = parseResult.data
    
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
    
    // Check if already assigned
    if (asset.assignedToId) {
      return NextResponse.json(
        { error: "Asset is already assigned. Return it first." },
        { status: 400 }
      )
    }
    
    // Check person exists and belongs to org
    const personResult = await db
      .select()
      .from(persons)
      .where(and(
        eq(persons.id, personId),
        eq(persons.orgId, orgId)
      ))
      .limit(1)
    
    if (personResult.length === 0) {
      return NextResponse.json(
        { error: "Person not found" },
        { status: 404 }
      )
    }
    
    const person = personResult[0]
    const now = new Date()
    
    // Update asset
    await db
      .update(assets)
      .set({
        assignedToId: personId,
        assignedAt: now,
        status: "assigned",
        updatedAt: now,
      })
      .where(eq(assets.id, id))
    
    // Create assignment record
    await db.insert(assetAssignments).values({
      assetId: id,
      personId,
      assignedAt: now,
      assignedById: session.userId,
      notes: notes ?? null,
    })
    
    // Create lifecycle event
    await db.insert(assetLifecycleEvents).values({
      orgId,
      assetId: id,
      eventType: "assigned",
      eventDate: now,
      details: {
        personId,
        personName: person.name,
        personEmail: person.email,
        notes,
      },
      performedById: session.userId,
    })
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("assets.assignments", "asset", asset.id, asset.name, { assignedToId: null, status: asset.status }, { assignedToId: personId, status: "assigned" })
    }
    
    return NextResponse.json({
      success: true,
      message: `Asset assigned to ${person.name}`,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error assigning asset:", error)
    return NextResponse.json(
      { error: "Failed to assign asset" },
      { status: 500 }
    )
  }
}

