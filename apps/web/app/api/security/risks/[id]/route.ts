/**
 * Security Risk Detail API
 * Get, update, delete individual risks
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityRisks,
  securityRiskControls,
  securityControls,
  riskLikelihoodValues,
  riskImpactValues,
  riskLevelValues,
  riskStatusValues,
  riskTreatmentValues,
  riskCategoryValues
} from "@/lib/db/schema/security"
import { persons } from "@/lib/db/schema/people"
import { getSession } from "@/lib/auth/session"
import { eq, and } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateRiskSchema = z.object({
  riskId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(riskCategoryValues).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  inherentLikelihood: z.enum(riskLikelihoodValues).optional(),
  inherentImpact: z.enum(riskImpactValues).optional(),
  residualLikelihood: z.enum(riskLikelihoodValues).optional().nullable(),
  residualImpact: z.enum(riskImpactValues).optional().nullable(),
  status: z.enum(riskStatusValues).optional(),
  treatment: z.enum(riskTreatmentValues).optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  treatmentDueDate: z.string().optional().nullable(),
  affectedAssets: z.string().optional().nullable(),
  lastReviewedAt: z.string().optional().nullable(),
  nextReviewAt: z.string().optional().nullable(),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateRiskLevel(likelihood: string, impact: string): string {
  const likelihoodScores: Record<string, number> = {
    very_low: 1, low: 2, medium: 3, high: 4, very_high: 5
  }
  const impactScores: Record<string, number> = {
    negligible: 1, minor: 2, moderate: 3, major: 4, severe: 5
  }
  
  const score = likelihoodScores[likelihood] * impactScores[impact]
  
  if (score >= 20) return "critical"
  if (score >= 12) return "high"
  if (score >= 6) return "medium"
  return "low"
}

// ============================================================================
// GET - Get Risk Detail
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Fetch risk with owner
    const [risk] = await db
      .select({
        id: securityRisks.id,
        orgId: securityRisks.orgId,
        riskId: securityRisks.riskId,
        title: securityRisks.title,
        description: securityRisks.description,
        category: securityRisks.category,
        ownerId: securityRisks.ownerId,
        ownerName: persons.name,
        ownerEmail: persons.email,
        inherentLikelihood: securityRisks.inherentLikelihood,
        inherentImpact: securityRisks.inherentImpact,
        inherentLevel: securityRisks.inherentLevel,
        residualLikelihood: securityRisks.residualLikelihood,
        residualImpact: securityRisks.residualImpact,
        residualLevel: securityRisks.residualLevel,
        status: securityRisks.status,
        treatment: securityRisks.treatment,
        treatmentPlan: securityRisks.treatmentPlan,
        treatmentDueDate: securityRisks.treatmentDueDate,
        affectedAssets: securityRisks.affectedAssets,
        lastReviewedAt: securityRisks.lastReviewedAt,
        nextReviewAt: securityRisks.nextReviewAt,
        metadata: securityRisks.metadata,
        createdAt: securityRisks.createdAt,
        updatedAt: securityRisks.updatedAt,
      })
      .from(securityRisks)
      .leftJoin(persons, eq(securityRisks.ownerId, persons.id))
      .where(
        and(
          eq(securityRisks.id, id),
          eq(securityRisks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 })
    }

    // Fetch mitigating controls
    const mitigatingControls = await db
      .select({
        id: securityRiskControls.id,
        controlId: securityControls.id,
        controlIdCode: securityControls.controlId,
        controlTitle: securityControls.title,
        implementationStatus: securityControls.implementationStatus,
        effectiveness: securityRiskControls.effectiveness,
        notes: securityRiskControls.notes,
      })
      .from(securityRiskControls)
      .innerJoin(securityControls, eq(securityRiskControls.controlId, securityControls.id))
      .where(eq(securityRiskControls.riskId, id))

    return NextResponse.json({
      data: {
        ...risk,
        mitigatingControls,
      },
    })
  } catch (error) {
    console.error("Error fetching risk:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Update Risk
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateRiskSchema.parse(body)

    // Check risk exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityRisks)
      .where(
        and(
          eq(securityRisks.id, id),
          eq(securityRisks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 })
    }

    // If changing risk ID, check for duplicates
    if (data.riskId && data.riskId !== existing.riskId) {
      const [duplicate] = await db
        .select({ id: securityRisks.id })
        .from(securityRisks)
        .where(
          and(
            eq(securityRisks.orgId, session.orgId),
            eq(securityRisks.riskId, data.riskId)
          )
        )
        .limit(1)

      if (duplicate) {
        return NextResponse.json(
          { error: "A risk with this ID already exists" },
          { status: 409 }
        )
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.riskId !== undefined) updateData.riskId = data.riskId
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.category !== undefined) updateData.category = data.category
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId
    if (data.status !== undefined) updateData.status = data.status
    if (data.treatment !== undefined) updateData.treatment = data.treatment
    if (data.treatmentPlan !== undefined) updateData.treatmentPlan = data.treatmentPlan
    if (data.treatmentDueDate !== undefined) updateData.treatmentDueDate = data.treatmentDueDate
    if (data.affectedAssets !== undefined) updateData.affectedAssets = data.affectedAssets
    if (data.lastReviewedAt !== undefined) updateData.lastReviewedAt = data.lastReviewedAt
    if (data.nextReviewAt !== undefined) updateData.nextReviewAt = data.nextReviewAt

    // Recalculate inherent level if likelihood or impact changed
    if (data.inherentLikelihood !== undefined || data.inherentImpact !== undefined) {
      const likelihood = data.inherentLikelihood || existing.inherentLikelihood
      const impact = data.inherentImpact || existing.inherentImpact
      updateData.inherentLikelihood = likelihood
      updateData.inherentImpact = impact
      updateData.inherentLevel = calculateRiskLevel(likelihood, impact)
    }

    // Recalculate residual level if likelihood or impact changed
    if (data.residualLikelihood !== undefined || data.residualImpact !== undefined) {
      const likelihood = data.residualLikelihood || existing.residualLikelihood
      const impact = data.residualImpact || existing.residualImpact
      
      if (likelihood && impact) {
        updateData.residualLikelihood = likelihood
        updateData.residualImpact = impact
        updateData.residualLevel = calculateRiskLevel(likelihood, impact)
      } else {
        updateData.residualLikelihood = data.residualLikelihood
        updateData.residualImpact = data.residualImpact
        updateData.residualLevel = null
      }
    }

    // Update risk
    const [updated] = await db
      .update(securityRisks)
      .set(updateData)
      .where(eq(securityRisks.id, id))
      .returning()

    // Audit log
    await createSimpleAuditLog({
      action: "update",
      entityType: "security_risk",
      entityId: id,
      userId: session.userId,
      orgId: session.orgId,
      oldValues: existing,
      newValues: updated,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating risk:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Risk
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check risk exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityRisks)
      .where(
        and(
          eq(securityRisks.id, id),
          eq(securityRisks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 })
    }

    // Delete risk (cascades to risk-control links)
    await db.delete(securityRisks).where(eq(securityRisks.id, id))

    // Audit log
    await createSimpleAuditLog({
      action: "delete",
      entityType: "security_risk",
      entityId: id,
      userId: session.userId,
      orgId: session.orgId,
      oldValues: existing,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting risk:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

