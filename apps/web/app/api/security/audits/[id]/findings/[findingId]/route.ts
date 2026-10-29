/**
 * Security Audit Finding Detail API
 * GET / PATCH / DELETE individual findings
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  securityAudits,
  securityAuditFindings,
  findingSeverityValues,
  findingStatusValues,
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { getAuditLogger } from "@/lib/api/context"
import { computeAuditFindingCounts } from "@/lib/security/audit-findings"

const updateFindingSchema = z.object({
  findingId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(findingSeverityValues).optional(),
  status: z.enum(findingStatusValues).optional(),
  evidence: z.string().optional().nullable(),
  linkedEvidenceIds: z.array(z.string().uuid()).optional(),
  recommendation: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  controlId: z.string().uuid().optional().nullable(),
})

function toDateString(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toISOString().split("T")[0]
}

async function getFindingForOrg(auditId: string, findingId: string, orgId: string) {
  const [row] = await db
    .select({
      finding: securityAuditFindings,
      auditTitle: securityAudits.title,
    })
    .from(securityAuditFindings)
    .innerJoin(securityAudits, eq(securityAuditFindings.auditId, securityAudits.id))
    .where(
      and(
        eq(securityAuditFindings.id, findingId),
        eq(securityAuditFindings.auditId, auditId),
        eq(securityAudits.orgId, orgId)
      )
    )
    .limit(1)

  return row ?? null
}

async function refreshAuditCounts(auditId: string) {
  const findings = await db
    .select({ severity: securityAuditFindings.severity })
    .from(securityAuditFindings)
    .where(eq(securityAuditFindings.auditId, auditId))

  const counts = computeAuditFindingCounts(findings)
  await db
    .update(securityAudits)
    .set({
      findingsCount: counts.findingsCount,
      majorFindingsCount: counts.majorFindingsCount,
      minorFindingsCount: counts.minorFindingsCount,
      updatedAt: new Date(),
    })
    .where(eq(securityAudits.id, auditId))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: auditId, findingId } = await params
    const row = await getFindingForOrg(auditId, findingId, session.orgId)
    if (!row) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 })
    }

    return NextResponse.json({ data: row.finding })
  } catch (error) {
    console.error("Error fetching finding:", error)
    return NextResponse.json({ error: "Failed to fetch finding" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: auditId, findingId } = await params
    const row = await getFindingForOrg(auditId, findingId, session.orgId)
    if (!row) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updateFindingSchema.parse(body)
    const existing = row.finding

    const nextStatus = data.status ?? existing.status
    const now = new Date()

    const [updated] = await db
      .update(securityAuditFindings)
      .set({
        ...(data.findingId !== undefined && { findingId: data.findingId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.severity !== undefined && { severity: data.severity }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.evidence !== undefined && { evidence: data.evidence }),
        ...(data.linkedEvidenceIds !== undefined && { linkedEvidenceIds: data.linkedEvidenceIds }),
        ...(data.recommendation !== undefined && { recommendation: data.recommendation }),
        ...(data.dueDate !== undefined && { dueDate: toDateString(data.dueDate) }),
        ...(data.resolution !== undefined && { resolution: data.resolution }),
        ...(data.controlId !== undefined && { controlId: data.controlId }),
        ...(nextStatus === "resolved" && !existing.resolvedAt && { resolvedAt: now }),
        ...(nextStatus === "verified" && !existing.verifiedAt && { verifiedAt: now }),
        ...(nextStatus === "closed" && { closedAt: existing.closedAt ?? now }),
        ...(data.status !== undefined &&
          data.status !== "closed" &&
          existing.status === "closed" && { closedAt: null }),
        updatedAt: now,
      })
      .where(eq(securityAuditFindings.id, findingId))
      .returning()

    if (data.severity !== undefined && data.severity !== existing.severity) {
      await refreshAuditCounts(auditId)
    }

    const auditLogger = await getAuditLogger()
    if (auditLogger) {
      await auditLogger.logUpdate(
        "security.audits",
        "audit_finding",
        findingId,
        updated.title,
        existing,
        updated
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating finding:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update finding" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: auditId, findingId } = await params
    const row = await getFindingForOrg(auditId, findingId, session.orgId)
    if (!row) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 })
    }

    await db.delete(securityAuditFindings).where(eq(securityAuditFindings.id, findingId))
    await refreshAuditCounts(auditId)

    const auditLogger = await getAuditLogger()
    if (auditLogger) {
      await auditLogger.logDelete("security.audits", "audit_finding", {
        ...row.finding,
        name: row.finding.title,
        auditTitle: row.auditTitle,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting finding:", error)
    return NextResponse.json({ error: "Failed to delete finding" }, { status: 500 })
  }
}
