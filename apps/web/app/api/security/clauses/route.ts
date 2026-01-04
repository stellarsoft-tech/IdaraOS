/**
 * Clause Compliance API
 * List and create clause compliance records
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityClauseCompliance, 
  securityStandardClauses,
  securityFrameworks,
  clauseComplianceStatusValues 
} from "@/lib/db/schema/security"
import { persons } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"
import { eq, and, asc, sql } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createClauseComplianceSchema = z.object({
  frameworkId: z.string().uuid(),
  standardClauseId: z.string().uuid(),
  complianceStatus: z.enum(clauseComplianceStatusValues).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  implementationNotes: z.string().optional().nullable(),
  evidenceDescription: z.string().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  linkedDocumentIds: z.array(z.string()).optional(),
})

// ============================================================================
// GET - List Clause Compliance Records
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const frameworkId = searchParams.get("frameworkId")

    if (!frameworkId) {
      return NextResponse.json({ error: "frameworkId is required" }, { status: 400 })
    }

    // Get all standard clauses for this framework
    const framework = await db
      .select()
      .from(securityFrameworks)
      .where(and(
        eq(securityFrameworks.id, frameworkId),
        eq(securityFrameworks.orgId, session.orgId)
      ))
      .limit(1)

    if (framework.length === 0) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    const frameworkCode = framework[0].code

    // Get all standard clauses for this framework code
    const standardClauses = await db
      .select()
      .from(securityStandardClauses)
      .where(eq(securityStandardClauses.frameworkCode, frameworkCode))
      .orderBy(asc(securityStandardClauses.sortOrder))

    // Get existing compliance records for this org and framework
    const existingCompliance = await db
      .select({
        compliance: securityClauseCompliance,
        ownerName: persons.name,
        ownerEmail: persons.email,
      })
      .from(securityClauseCompliance)
      .leftJoin(persons, eq(securityClauseCompliance.ownerId, persons.id))
      .where(and(
        eq(securityClauseCompliance.orgId, session.orgId),
        eq(securityClauseCompliance.frameworkId, frameworkId)
      ))

    // Create a map for quick lookup
    const complianceMap = new Map(
      existingCompliance.map(c => [c.compliance.standardClauseId, c])
    )

    // Merge standard clauses with compliance data
    const mergedData = standardClauses.map(clause => {
      const existing = complianceMap.get(clause.id)
      return {
        standardClause: clause,
        compliance: existing?.compliance || null,
        ownerName: existing?.ownerName || null,
        ownerEmail: existing?.ownerEmail || null,
      }
    })

    // Calculate summary statistics
    const total = standardClauses.length
    const notAddressed = mergedData.filter(d => !d.compliance || d.compliance.complianceStatus === "not_addressed").length
    const partiallyAddressed = mergedData.filter(d => d.compliance?.complianceStatus === "partially_addressed").length
    const fullyAddressed = mergedData.filter(d => d.compliance?.complianceStatus === "fully_addressed").length
    const verified = mergedData.filter(d => d.compliance?.complianceStatus === "verified").length

    return NextResponse.json({
      data: mergedData,
      summary: {
        total,
        notAddressed,
        partiallyAddressed,
        fullyAddressed,
        verified,
        compliancePercent: total > 0 ? Math.round(((fullyAddressed + verified) / total) * 100) : 0,
      },
    })
  } catch (error) {
    console.error("Error fetching clause compliance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create or Update Clause Compliance Record
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createClauseComplianceSchema.parse(body)

    // Verify framework belongs to org
    const [framework] = await db
      .select()
      .from(securityFrameworks)
      .where(and(
        eq(securityFrameworks.id, data.frameworkId),
        eq(securityFrameworks.orgId, session.orgId)
      ))
      .limit(1)

    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    // Verify standard clause exists
    const [clause] = await db
      .select()
      .from(securityStandardClauses)
      .where(eq(securityStandardClauses.id, data.standardClauseId))
      .limit(1)

    if (!clause) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 })
    }

    // Check if compliance record already exists
    const [existing] = await db
      .select()
      .from(securityClauseCompliance)
      .where(and(
        eq(securityClauseCompliance.orgId, session.orgId),
        eq(securityClauseCompliance.frameworkId, data.frameworkId),
        eq(securityClauseCompliance.standardClauseId, data.standardClauseId)
      ))
      .limit(1)

    let result
    if (existing) {
      // Update existing record
      [result] = await db
        .update(securityClauseCompliance)
        .set({
          complianceStatus: data.complianceStatus || existing.complianceStatus,
          ownerId: data.ownerId,
          targetDate: data.targetDate || null,
          implementationNotes: data.implementationNotes,
          evidenceDescription: data.evidenceDescription,
          linkedEvidenceIds: data.linkedEvidenceIds || existing.linkedEvidenceIds,
          linkedDocumentIds: data.linkedDocumentIds || existing.linkedDocumentIds,
          updatedAt: new Date(),
        })
        .where(eq(securityClauseCompliance.id, existing.id))
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
    } else {
      // Create new record
      [result] = await db
        .insert(securityClauseCompliance)
        .values({
          orgId: session.orgId,
          frameworkId: data.frameworkId,
          standardClauseId: data.standardClauseId,
          complianceStatus: data.complianceStatus || "not_addressed",
          ownerId: data.ownerId,
          targetDate: data.targetDate || null,
          implementationNotes: data.implementationNotes,
          evidenceDescription: data.evidenceDescription,
          linkedEvidenceIds: data.linkedEvidenceIds,
          linkedDocumentIds: data.linkedDocumentIds,
        })
        .returning()

      const auditNew = await getAuditLogger()
      if (auditNew) {
        await auditNew.logCreate("security.clauses", "clause_compliance", {
          ...result,
          name: result.standardClauseId,
        })
      }
    }

    return NextResponse.json({ data: result }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error("Error saving clause compliance:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

