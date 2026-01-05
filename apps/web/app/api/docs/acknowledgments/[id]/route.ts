/**
 * Document Acknowledgment Detail API Routes
 * GET /api/docs/acknowledgments/[id] - Get acknowledgment details
 * PUT /api/docs/acknowledgments/[id] - Update acknowledgment (view/acknowledge/sign)
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { documents, documentAcknowledgments, documentRollouts } from "@/lib/db/schema"
import { UpdateAcknowledgmentSchema } from "@/lib/docs/types"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/docs/acknowledgments/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.acknowledgments.view())
    
    const { id } = await context.params
    
    // Get acknowledgment with org check
    const [ack] = await db
      .select()
      .from(documentAcknowledgments)
      .innerJoin(documents, and(
        eq(documentAcknowledgments.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .where(eq(documentAcknowledgments.id, id))
      .limit(1)
    
    if (!ack) {
      return NextResponse.json({ error: "Acknowledgment not found" }, { status: 404 })
    }
    
    return NextResponse.json({ data: ack.docs_document_acknowledgments })
  } catch (error) {
    console.error("Error fetching acknowledgment:", error)
    return NextResponse.json({ error: "Failed to fetch acknowledgment" }, { status: 500 })
  }
}

/**
 * PUT /api/docs/acknowledgments/[id]
 * Update acknowledgment status (view, acknowledge, sign)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.acknowledgments.view())
    
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = UpdateAcknowledgmentSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Find existing acknowledgment (must belong to current user or user has admin permission)
    const [existing] = await db
      .select({
        ack: documentAcknowledgments,
        doc: documents,
        rollout: documentRollouts,
      })
      .from(documentAcknowledgments)
      .innerJoin(documents, and(
        eq(documentAcknowledgments.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .leftJoin(documentRollouts, eq(documentAcknowledgments.rolloutId, documentRollouts.id))
      .where(eq(documentAcknowledgments.id, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Acknowledgment not found" }, { status: 404 })
    }
    
    // Users can only update their own acknowledgments
    if (existing.ack.userId !== session.userId) {
      // Check if user has admin permission (would need RBAC check here)
      // For now, deny non-self updates
      return NextResponse.json({ error: "Cannot update another user's acknowledgment" }, { status: 403 })
    }
    
    // Validate status transition
    const currentStatus = existing.ack.status
    const newStatus = data.status
    
    // Valid transitions: pending -> viewed -> acknowledged -> signed
    const validTransitions: Record<string, string[]> = {
      pending: ["viewed", "acknowledged", "signed"],
      viewed: ["acknowledged", "signed"],
      acknowledged: ["signed"],
      signed: [], // Cannot transition from signed
    }
    
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${currentStatus} to ${newStatus}` },
        { status: 400 }
      )
    }
    
    // Check if signature is required
    if (existing.rollout?.requirement === "required_with_signature" && newStatus === "acknowledged") {
      return NextResponse.json(
        { error: "This document requires a signature" },
        { status: 400 }
      )
    }
    
    // Build update data
    const now = new Date()
    const updateData: Record<string, unknown> = {
      status: newStatus,
      versionAcknowledged: data.versionAcknowledged || existing.doc.currentVersion,
      notes: data.notes,
      updatedAt: now,
    }
    
    // Set timestamps based on new status
    if (newStatus === "viewed" && !existing.ack.viewedAt) {
      updateData.viewedAt = now
    }
    if (newStatus === "acknowledged" && !existing.ack.acknowledgedAt) {
      updateData.viewedAt = existing.ack.viewedAt || now
      updateData.acknowledgedAt = now
    }
    if (newStatus === "signed") {
      updateData.viewedAt = existing.ack.viewedAt || now
      updateData.acknowledgedAt = existing.ack.acknowledgedAt || now
      updateData.signedAt = now
      
      if (data.signatureData) {
        updateData.signatureData = {
          ...data.signatureData,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        }
      }
    }
    
    // Update acknowledgment
    const [updated] = await db
      .update(documentAcknowledgments)
      .set(updateData)
      .where(eq(documentAcknowledgments.id, id))
      .returning()
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "docs.acknowledgments",
        "acknowledgment",
        updated.id,
        existing.doc.title,
        { status: currentStatus },
        { status: newStatus }
      )
    }
    
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating acknowledgment:", error)
    return NextResponse.json({ error: "Failed to update acknowledgment" }, { status: 500 })
  }
}

