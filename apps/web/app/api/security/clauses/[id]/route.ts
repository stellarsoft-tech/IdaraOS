/**
 * Individual Clause Compliance API
 * Get, update, or delete a specific clause compliance record
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityClauseCompliance, 
  securityStandardClauses,
  clauseComplianceStatusValues 
} from "@/lib/db/schema/security"
import { persons } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"
import { eq, and } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateClauseComplianceSchema = z.object({
  complianceStatus: z.enum(clauseComplianceStatusValues).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  implementationNotes: z.string().optional().nullable(),
  evidenceDescription: z.string().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  linkedDocumentIds: z.array(z.string()).optional(),
  lastReviewedAt: z.string().optional().nullable(),
})

// ============================================================================
// GET - Get Single Clause Compliance Record
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

    const [result] = await db
      .select({
        compliance: securityClauseCompliance,
        standardClause: securityStandardClauses,
        ownerName: persons.name,
        ownerEmail: persons.email,
      })
      .from(securityClauseCompliance)
      .innerJoin(securityStandardClauses, eq(securityClauseCompliance.standardClauseId, securityStandardClauses.id))
      .leftJoin(persons, eq(securityClauseCompliance.ownerId, persons.id))
      .where(and(
        eq(securityClauseCompliance.id, id),
        eq(securityClauseCompliance.orgId, session.orgId)
      ))
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: "Clause compliance not found" }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...result.compliance,
        standardClause: result.standardClause,
        ownerName: result.ownerName,
        ownerEmail: result.ownerEmail,
      },
    })
  } catch (error) {
    console.error("Error fetching clause compliance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Update Clause Compliance Record
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
    const data = updateClauseComplianceSchema.parse(body)

    // Get existing record
    const [existing] = await db
      .select()
      .from(securityClauseCompliance)
      .where(and(
        eq(securityClauseCompliance.id, id),
        eq(securityClauseCompliance.orgId, session.orgId)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Clause compliance not found" }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.complianceStatus !== undefined) {
      updateData.complianceStatus = data.complianceStatus
    }
    if (data.ownerId !== undefined) {
      updateData.ownerId = data.ownerId
    }
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate
    }
    if (data.implementationNotes !== undefined) {
      updateData.implementationNotes = data.implementationNotes
    }
    if (data.evidenceDescription !== undefined) {
      updateData.evidenceDescription = data.evidenceDescription
    }
    if (data.linkedEvidenceIds !== undefined) {
      updateData.linkedEvidenceIds = data.linkedEvidenceIds
    }
    if (data.linkedDocumentIds !== undefined) {
      updateData.linkedDocumentIds = data.linkedDocumentIds
    }
    if (data.lastReviewedAt !== undefined) {
      updateData.lastReviewedAt = data.lastReviewedAt ? new Date(data.lastReviewedAt) : null
      updateData.lastReviewedById = session.userId
    }

    const [result] = await db
      .update(securityClauseCompliance)
      .set(updateData)
      .where(eq(securityClauseCompliance.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.clauses",
        "clause_compliance",
        result.id,
        result.standardClauseId,
        existing,
        result
      )
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error("Error updating clause compliance:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Clause Compliance Record
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

    // Get existing record
    const [existing] = await db
      .select()
      .from(securityClauseCompliance)
      .where(and(
        eq(securityClauseCompliance.id, id),
        eq(securityClauseCompliance.orgId, session.orgId)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Clause compliance not found" }, { status: 404 })
    }

    await db
      .delete(securityClauseCompliance)
      .where(eq(securityClauseCompliance.id, id))

    const auditDel = await getAuditLogger()
    if (auditDel) {
      await auditDel.logDelete("security.clauses", "clause_compliance", {
        ...existing,
        name: existing.standardClauseId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting clause compliance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

