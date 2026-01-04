/**
 * Security Risks API
 * CRUD operations for risk register with treatment and control links
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
import { eq, and, desc, ilike, or, count, sql } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createRiskSchema = z.object({
  riskId: z.string().min(1, "Risk ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.enum(riskCategoryValues).default("operational"),
  ownerId: z.string().uuid().optional().nullable(),
  inherentLikelihood: z.enum(riskLikelihoodValues).default("medium"),
  inherentImpact: z.enum(riskImpactValues).default("moderate"),
  status: z.enum(riskStatusValues).default("identified"),
  treatment: z.enum(riskTreatmentValues).optional().nullable(),
  treatmentPlan: z.string().optional(),
  treatmentDueDate: z.string().optional(),
  affectedAssets: z.string().optional(),
  controlIds: z.array(z.string().uuid()).optional(),
})

const updateRiskSchema = createRiskSchema.partial().extend({
  residualLikelihood: z.enum(riskLikelihoodValues).optional().nullable(),
  residualImpact: z.enum(riskImpactValues).optional().nullable(),
  lastReviewedAt: z.string().optional(),
  nextReviewAt: z.string().optional(),
})

const querySchema = z.object({
  search: z.string().optional(),
  category: z.enum(riskCategoryValues).optional(),
  status: z.enum(riskStatusValues).optional(),
  inherentLevel: z.enum(riskLevelValues).optional(),
  residualLevel: z.enum(riskLevelValues).optional(),
  ownerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate risk level from likelihood and impact
 */
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
// GET - List Risks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      inherentLevel: searchParams.get("inherentLevel") || undefined,
      residualLevel: searchParams.get("residualLevel") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    })

    const offset = (query.page - 1) * query.limit

    // Build where conditions
    const conditions = [eq(securityRisks.orgId, session.orgId)]
    
    if (query.search) {
      conditions.push(
        or(
          ilike(securityRisks.title, `%${query.search}%`),
          ilike(securityRisks.riskId, `%${query.search}%`),
          ilike(securityRisks.description, `%${query.search}%`)
        )!
      )
    }
    
    if (query.category) {
      conditions.push(eq(securityRisks.category, query.category))
    }
    
    if (query.status) {
      conditions.push(eq(securityRisks.status, query.status))
    }
    
    if (query.inherentLevel) {
      conditions.push(eq(securityRisks.inherentLevel, query.inherentLevel))
    }
    
    if (query.residualLevel) {
      conditions.push(eq(securityRisks.residualLevel, query.residualLevel))
    }
    
    if (query.ownerId) {
      conditions.push(eq(securityRisks.ownerId, query.ownerId))
    }

    // Fetch risks with owner
    const risks = await db
      .select({
        id: securityRisks.id,
        riskId: securityRisks.riskId,
        title: securityRisks.title,
        description: securityRisks.description,
        category: securityRisks.category,
        ownerId: securityRisks.ownerId,
        ownerName: persons.name,
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
        createdAt: securityRisks.createdAt,
        updatedAt: securityRisks.updatedAt,
      })
      .from(securityRisks)
      .leftJoin(persons, eq(securityRisks.ownerId, persons.id))
      .where(and(...conditions))
      .orderBy(desc(securityRisks.createdAt))
      .limit(query.limit)
      .offset(offset)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(securityRisks)
      .where(and(...conditions))

    // Get mitigating controls count for each risk
    const risksWithCounts = await Promise.all(
      risks.map(async (risk) => {
        const [{ controlsCount }] = await db
          .select({ controlsCount: count() })
          .from(securityRiskControls)
          .where(eq(securityRiskControls.riskId, risk.id))
        
        return {
          ...risk,
          controlsCount,
        }
      })
    )

    return NextResponse.json({
      data: risksWithCounts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    console.error("Error fetching risks:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Risk
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createRiskSchema.parse(body)

    // Check for duplicate risk ID
    const existing = await db
      .select({ id: securityRisks.id })
      .from(securityRisks)
      .where(
        and(
          eq(securityRisks.orgId, session.orgId),
          eq(securityRisks.riskId, data.riskId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A risk with this ID already exists" },
        { status: 409 }
      )
    }

    // Calculate inherent risk level
    const inherentLevel = calculateRiskLevel(data.inherentLikelihood, data.inherentImpact)

    // Create risk
    const [risk] = await db
      .insert(securityRisks)
      .values({
        orgId: session.orgId,
        riskId: data.riskId,
        title: data.title,
        description: data.description,
        category: data.category,
        ownerId: data.ownerId,
        inherentLikelihood: data.inherentLikelihood,
        inherentImpact: data.inherentImpact,
        inherentLevel: inherentLevel as typeof riskLevelValues[number],
        status: data.status,
        treatment: data.treatment,
        treatmentPlan: data.treatmentPlan,
        treatmentDueDate: data.treatmentDueDate,
        affectedAssets: data.affectedAssets,
      })
      .returning()

    // Link to controls if specified
    if (data.controlIds && data.controlIds.length > 0) {
      const controls = await db
        .select({ id: securityControls.id })
        .from(securityControls)
        .where(eq(securityControls.orgId, session.orgId))

      const validControlIds = new Set(controls.map(c => c.id))
      const linksToCreate = data.controlIds
        .filter(id => validControlIds.has(id))
        .map(controlId => ({
          riskId: risk.id,
          controlId,
        }))

      if (linksToCreate.length > 0) {
        await db.insert(securityRiskControls).values(linksToCreate)
      }
    }

    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.risks", "risk", {
        ...risk,
        name: risk.title,
      })
    }

    return NextResponse.json({ data: risk }, { status: 201 })
  } catch (error) {
    console.error("Error creating risk:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

