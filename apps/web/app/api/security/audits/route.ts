/**
 * Security Audits API
 * CRUD operations for audit management
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityAudits,
  securityFrameworks,
  auditTypeValues,
  auditStatusValues
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and, desc, ilike, or, count } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createAuditSchema = z.object({
  auditId: z.string().min(1, "Audit ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  type: z.enum(auditTypeValues).default("internal"),
  status: z.enum(auditStatusValues).default("planned"),
  frameworkId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  leadAuditor: z.string().optional(),
  auditTeam: z.array(z.string()).optional(),
  auditBody: z.string().optional(),
})

const querySchema = z.object({
  search: z.string().optional(),
  type: z.enum(auditTypeValues).optional(),
  status: z.enum(auditStatusValues).optional(),
  frameworkId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

// ============================================================================
// GET - List Audits
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
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      frameworkId: searchParams.get("frameworkId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    })

    const offset = (query.page - 1) * query.limit

    // Build where conditions
    const conditions = [eq(securityAudits.orgId, session.orgId)]
    
    if (query.search) {
      conditions.push(
        or(
          ilike(securityAudits.title, `%${query.search}%`),
          ilike(securityAudits.auditId, `%${query.search}%`)
        )!
      )
    }
    
    if (query.type) {
      conditions.push(eq(securityAudits.type, query.type))
    }
    
    if (query.status) {
      conditions.push(eq(securityAudits.status, query.status))
    }
    
    if (query.frameworkId) {
      conditions.push(eq(securityAudits.frameworkId, query.frameworkId))
    }

    // Fetch audits with framework info
    const audits = await db
      .select({
        id: securityAudits.id,
        auditId: securityAudits.auditId,
        title: securityAudits.title,
        type: securityAudits.type,
        status: securityAudits.status,
        frameworkId: securityAudits.frameworkId,
        frameworkName: securityFrameworks.name,
        startDate: securityAudits.startDate,
        endDate: securityAudits.endDate,
        scope: securityAudits.scope,
        objectives: securityAudits.objectives,
        leadAuditor: securityAudits.leadAuditor,
        auditTeam: securityAudits.auditTeam,
        auditBody: securityAudits.auditBody,
        summary: securityAudits.summary,
        conclusion: securityAudits.conclusion,
        findingsCount: securityAudits.findingsCount,
        majorFindingsCount: securityAudits.majorFindingsCount,
        minorFindingsCount: securityAudits.minorFindingsCount,
        createdAt: securityAudits.createdAt,
        updatedAt: securityAudits.updatedAt,
      })
      .from(securityAudits)
      .leftJoin(securityFrameworks, eq(securityAudits.frameworkId, securityFrameworks.id))
      .where(and(...conditions))
      .orderBy(desc(securityAudits.startDate), desc(securityAudits.createdAt))
      .limit(query.limit)
      .offset(offset)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(securityAudits)
      .where(and(...conditions))

    return NextResponse.json({
      data: audits,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    console.error("Error fetching audits:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Audit
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createAuditSchema.parse(body)

    // Check for duplicate audit ID
    const existing = await db
      .select({ id: securityAudits.id })
      .from(securityAudits)
      .where(
        and(
          eq(securityAudits.orgId, session.orgId),
          eq(securityAudits.auditId, data.auditId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An audit with this ID already exists" },
        { status: 409 }
      )
    }

    // Verify framework exists if specified
    if (data.frameworkId) {
      const [framework] = await db
        .select({ id: securityFrameworks.id })
        .from(securityFrameworks)
        .where(
          and(
            eq(securityFrameworks.id, data.frameworkId),
            eq(securityFrameworks.orgId, session.orgId)
          )
        )
        .limit(1)

      if (!framework) {
        return NextResponse.json({ error: "Framework not found" }, { status: 404 })
      }
    }

    // Create audit
    const [audit] = await db
      .insert(securityAudits)
      .values({
        orgId: session.orgId,
        auditId: data.auditId,
        title: data.title,
        type: data.type,
        status: data.status,
        frameworkId: data.frameworkId,
        startDate: data.startDate,
        endDate: data.endDate,
        scope: data.scope,
        objectives: data.objectives,
        leadAuditor: data.leadAuditor,
        auditTeam: data.auditTeam,
        auditBody: data.auditBody,
      })
      .returning()

    // Audit log
    await createSimpleAuditLog({
      action: "create",
      entityType: "security_audit",
      entityId: audit.id,
      userId: session.userId,
      orgId: session.orgId,
      newValues: audit,
    })

    return NextResponse.json({ data: audit }, { status: 201 })
  } catch (error) {
    console.error("Error creating audit:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

