/**
 * Document Rollout Detail API Routes
 * GET /api/docs/rollouts/[id] - Get rollout details
 * PUT /api/docs/rollouts/[id] - Update rollout
 * DELETE /api/docs/rollouts/[id] - Delete rollout
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { documents, documentRollouts, documentAcknowledgments } from "@/lib/db/schema"
import { UpdateRolloutSchema } from "@/lib/docs/types"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/docs/rollouts/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.rollouts.view())
    
    const { id } = await context.params
    
    // Get rollout with document check
    const [rollout] = await db
      .select({
        id: documentRollouts.id,
        documentId: documentRollouts.documentId,
        targetType: documentRollouts.targetType,
        targetId: documentRollouts.targetId,
        requirement: documentRollouts.requirement,
        dueDate: documentRollouts.dueDate,
        isActive: documentRollouts.isActive,
        sendNotification: documentRollouts.sendNotification,
        reminderFrequencyDays: documentRollouts.reminderFrequencyDays,
        createdAt: documentRollouts.createdAt,
        updatedAt: documentRollouts.updatedAt,
      })
      .from(documentRollouts)
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .where(eq(documentRollouts.id, id))
      .limit(1)
    
    if (!rollout) {
      return NextResponse.json({ error: "Rollout not found" }, { status: 404 })
    }
    
    return NextResponse.json({ data: rollout })
  } catch (error) {
    console.error("Error fetching rollout:", error)
    return NextResponse.json({ error: "Failed to fetch rollout" }, { status: 500 })
  }
}

/**
 * PUT /api/docs/rollouts/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.rollouts.view())
    
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateRolloutSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Verify rollout exists and belongs to org
    const [existing] = await db
      .select({
        rolloutId: documentRollouts.id,
        documentId: documentRollouts.documentId,
      })
      .from(documentRollouts)
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .where(eq(documentRollouts.id, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Rollout not found" }, { status: 404 })
    }
    
    // Update rollout
    const [updated] = await db
      .update(documentRollouts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(documentRollouts.id, id))
      .returning()
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "docs.rollouts",
        "rollout",
        updated.id,
        `Rollout for document ${existing.documentId}`,
        {},
        data as Record<string, unknown>
      )
    }
    
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating rollout:", error)
    return NextResponse.json({ error: "Failed to update rollout" }, { status: 500 })
  }
}

/**
 * DELETE /api/docs/rollouts/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.rollouts.view())
    
    const { id } = await context.params
    
    // Verify rollout exists and belongs to org
    const [existing] = await db
      .select({
        rolloutId: documentRollouts.id,
        documentId: documentRollouts.documentId,
      })
      .from(documentRollouts)
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .where(eq(documentRollouts.id, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Rollout not found" }, { status: 404 })
    }
    
    // Delete acknowledgments first (schema uses onDelete: "set null", not cascade)
    await db.delete(documentAcknowledgments).where(eq(documentAcknowledgments.rolloutId, id))
    
    // Then delete the rollout
    await db.delete(documentRollouts).where(eq(documentRollouts.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("docs.rollouts", "rollout", {
        id: existing.rolloutId,
        documentId: existing.documentId,
      })
    }
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting rollout:", error)
    return NextResponse.json({ error: "Failed to delete rollout" }, { status: 500 })
  }
}

