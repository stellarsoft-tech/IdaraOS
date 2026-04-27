/**
 * Security Risk-Control Links API
 *
 * Manages the many-to-many relationship between a risk and its mitigating
 * controls (the `security_risk_controls` junction table).
 *
 * Routes:
 *   POST   /api/security/risks/:id/controls           - Link a control to the risk
 *   DELETE /api/security/risks/:id/controls?controlId - Unlink a control from the risk
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  securityRisks,
  securityRiskControls,
  securityControls,
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { and, eq } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION
// ============================================================================

const linkSchema = z.object({
  controlId: z.string().uuid(),
  effectiveness: z.enum(["high", "medium", "low"]).optional(),
  notes: z.string().optional(),
})

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the risk and assert it belongs to the session org. Returns the row
 * or null if it cannot be found / accessed.
 */
async function getOrgScopedRisk(riskId: string, orgId: string) {
  const [risk] = await db
    .select()
    .from(securityRisks)
    .where(and(eq(securityRisks.id, riskId), eq(securityRisks.orgId, orgId)))
    .limit(1)
  return risk ?? null
}

/**
 * Same idea for the control to be linked.
 */
async function getOrgScopedControl(controlId: string, orgId: string) {
  const [control] = await db
    .select()
    .from(securityControls)
    .where(and(eq(securityControls.id, controlId), eq(securityControls.orgId, orgId)))
    .limit(1)
  return control ?? null
}

// ============================================================================
// POST - Link a control to the risk
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: riskId } = await params
    const body = await request.json()
    const data = linkSchema.parse(body)

    const risk = await getOrgScopedRisk(riskId, session.orgId)
    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 })
    }

    const control = await getOrgScopedControl(data.controlId, session.orgId)
    if (!control) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 })
    }

    // Prevent duplicate links (the junction table has no unique constraint)
    const [existing] = await db
      .select({ id: securityRiskControls.id })
      .from(securityRiskControls)
      .where(
        and(
          eq(securityRiskControls.riskId, riskId),
          eq(securityRiskControls.controlId, data.controlId)
        )
      )
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: "Control is already linked to this risk" },
        { status: 409 }
      )
    }

    const [link] = await db
      .insert(securityRiskControls)
      .values({
        riskId,
        controlId: data.controlId,
        effectiveness: data.effectiveness,
        notes: data.notes,
      })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.risks", "risk_control_link", {
        ...link,
        name: `${risk.riskId} → ${control.controlId}`,
      })
    }

    return NextResponse.json({ data: link }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error linking control to risk:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Unlink a control from the risk
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

    const { id: riskId } = await params
    const controlId = request.nextUrl.searchParams.get("controlId")

    if (!controlId) {
      return NextResponse.json(
        { error: "controlId query parameter is required" },
        { status: 400 }
      )
    }

    const risk = await getOrgScopedRisk(riskId, session.orgId)
    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 })
    }

    const [link] = await db
      .select()
      .from(securityRiskControls)
      .where(
        and(
          eq(securityRiskControls.riskId, riskId),
          eq(securityRiskControls.controlId, controlId)
        )
      )
      .limit(1)

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    await db
      .delete(securityRiskControls)
      .where(eq(securityRiskControls.id, link.id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.risks", "risk_control_link", {
        ...link,
        name: `${risk.riskId} → ${controlId}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unlinking control from risk:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
