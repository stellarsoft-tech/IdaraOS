/**
 * Security Audit Detail API
 * GET / PATCH / DELETE individual audits
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  securityAudits,
  securityAuditFindings,
  securityFrameworks,
  auditTypeValues,
  auditStatusValues,
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { getAuditLogger } from "@/lib/api/context"
import { computeAuditFindingCounts } from "@/lib/security/audit-findings"

const updateAuditSchema = z.object({
  auditId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  type: z.enum(auditTypeValues).optional(),
  status: z.enum(auditStatusValues).optional(),
  frameworkId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  objectives: z.string().optional().nullable(),
  leadAuditor: z.string().optional().nullable(),
  auditTeam: z.array(z.string()).optional().nullable(),
  auditBody: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  conclusion: z.string().optional().nullable(),
})

function toDateString(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toISOString().split("T")[0]
}

async function getAuditForOrg(id: string, orgId: string) {
  const [audit] = await db
    .select({
      id: securityAudits.id,
      orgId: securityAudits.orgId,
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
    .where(and(eq(securityAudits.id, id), eq(securityAudits.orgId, orgId)))
    .limit(1)

  return audit ?? null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const audit = await getAuditForOrg(id, session.orgId)
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }

    const findings = await db
      .select()
      .from(securityAuditFindings)
      .where(eq(securityAuditFindings.auditId, id))
      .orderBy(asc(securityAuditFindings.createdAt))

    const counts = computeAuditFindingCounts(findings)

    return NextResponse.json({
      data: {
        ...audit,
        ...counts,
        findings,
      },
    })
  } catch (error) {
    console.error("Error fetching audit:", error)
    return NextResponse.json({ error: "Failed to fetch audit" }, { status: 500 })
  }
}

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
    const existing = await getAuditForOrg(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updateAuditSchema.parse(body)

    if (data.auditId && data.auditId !== existing.auditId) {
      const [dup] = await db
        .select({ id: securityAudits.id })
        .from(securityAudits)
        .where(and(eq(securityAudits.orgId, session.orgId), eq(securityAudits.auditId, data.auditId)))
        .limit(1)
      if (dup) {
        return NextResponse.json({ error: "An audit with this ID already exists" }, { status: 409 })
      }
    }

    if (data.frameworkId) {
      const [framework] = await db
        .select({ id: securityFrameworks.id })
        .from(securityFrameworks)
        .where(and(eq(securityFrameworks.id, data.frameworkId), eq(securityFrameworks.orgId, session.orgId)))
        .limit(1)
      if (!framework) {
        return NextResponse.json({ error: "Framework not found" }, { status: 404 })
      }
    }

    const [updated] = await db
      .update(securityAudits)
      .set({
        ...(data.auditId !== undefined && { auditId: data.auditId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.frameworkId !== undefined && { frameworkId: data.frameworkId }),
        ...(data.startDate !== undefined && { startDate: toDateString(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: toDateString(data.endDate) }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.objectives !== undefined && { objectives: data.objectives }),
        ...(data.leadAuditor !== undefined && { leadAuditor: data.leadAuditor }),
        ...(data.auditTeam !== undefined && { auditTeam: data.auditTeam }),
        ...(data.auditBody !== undefined && { auditBody: data.auditBody }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.conclusion !== undefined && { conclusion: data.conclusion }),
        updatedAt: new Date(),
      })
      .where(eq(securityAudits.id, id))
      .returning()

    const auditLogger = await getAuditLogger()
    if (auditLogger) {
      await auditLogger.logUpdate("security.audits", "audit", id, updated.title, existing, updated)
    }

    const refreshed = await getAuditForOrg(id, session.orgId)
    return NextResponse.json({ data: refreshed })
  } catch (error) {
    console.error("Error updating audit:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update audit" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const existing = await getAuditForOrg(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }

    await db.delete(securityAudits).where(eq(securityAudits.id, id))

    const auditLogger = await getAuditLogger()
    if (auditLogger) {
      await auditLogger.logDelete("security.audits", "audit", {
        ...existing,
        name: existing.title,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting audit:", error)
    return NextResponse.json({ error: "Failed to delete audit" }, { status: 500 })
  }
}
