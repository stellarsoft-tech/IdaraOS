/**
 * Security Audit Findings API
 * GET / POST findings for an audit
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"

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

const createFindingSchema = z.object({
  findingId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  severity: z.enum(findingSeverityValues),
  status: z.enum(findingStatusValues).optional().default("open"),
  evidence: z.string().optional(),
  linkedEvidenceIds: z.array(z.string().uuid()).optional().default([]),
  recommendation: z.string().optional(),
  dueDate: z.string().optional(),
  controlId: z.string().uuid().optional().nullable(),
})

function toDateString(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toISOString().split("T")[0]
}

async function assertAuditAccess(auditId: string, orgId: string) {
  const [audit] = await db
    .select({ id: securityAudits.id, auditId: securityAudits.auditId, title: securityAudits.title })
    .from(securityAudits)
    .where(and(eq(securityAudits.id, auditId), eq(securityAudits.orgId, orgId)))
    .limit(1)
  return audit ?? null
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

  return counts
}

function nextFindingId(existingIds: string[], severity: string): string {
  const prefix =
    severity === "observation"
      ? "OBS"
      : severity === "nonconformity"
        ? "NC"
        : severity === "minor"
          ? "MIN"
          : severity === "major"
            ? "MAJ"
            : "FND"
  let n = 1
  const used = new Set(existingIds)
  while (used.has(`${prefix}-${String(n).padStart(3, "0")}`)) n += 1
  return `${prefix}-${String(n).padStart(3, "0")}`
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

    const { id: auditId } = await params
    const audit = await assertAuditAccess(auditId, session.orgId)
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }

    const findings = await db
      .select()
      .from(securityAuditFindings)
      .where(eq(securityAuditFindings.auditId, auditId))
      .orderBy(asc(securityAuditFindings.createdAt))

    return NextResponse.json({ data: findings })
  } catch (error) {
    console.error("Error fetching audit findings:", error)
    return NextResponse.json({ error: "Failed to fetch findings" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: auditId } = await params
    const audit = await assertAuditAccess(auditId, session.orgId)
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = createFindingSchema.parse(body)

    const existing = await db
      .select({ findingId: securityAuditFindings.findingId })
      .from(securityAuditFindings)
      .where(eq(securityAuditFindings.auditId, auditId))

    const findingId = data.findingId?.trim() || nextFindingId(
      existing.map((f) => f.findingId),
      data.severity
    )

    if (existing.some((f) => f.findingId === findingId)) {
      return NextResponse.json({ error: "A finding with this ID already exists on this audit" }, { status: 409 })
    }

    const [finding] = await db
      .insert(securityAuditFindings)
      .values({
        auditId,
        findingId,
        title: data.title,
        description: data.description,
        severity: data.severity,
        status: data.status ?? "open",
        evidence: data.evidence,
        linkedEvidenceIds: data.linkedEvidenceIds ?? [],
        recommendation: data.recommendation,
        dueDate: data.dueDate ? toDateString(data.dueDate) : null,
        controlId: data.controlId ?? null,
      })
      .returning()

    await refreshAuditCounts(auditId)

    const auditLogger = await getAuditLogger()
    if (auditLogger) {
      await auditLogger.logCreate("security.audits", "audit_finding", {
        ...finding,
        name: finding.title,
        auditTitle: audit.title,
      })
    }

    return NextResponse.json({ data: finding }, { status: 201 })
  } catch (error) {
    console.error("Error creating audit finding:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create finding" }, { status: 500 })
  }
}
