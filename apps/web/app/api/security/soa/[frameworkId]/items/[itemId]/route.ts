/**
 * SoA Item Detail API
 * Update individual SoA items
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityFrameworks,
  securitySoaItems,
  securityControls,
  soaApplicabilityValues,
  controlImplementationStatusValues
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateSoaItemSchema = z.object({
  applicability: z.enum(soaApplicabilityValues).optional(),
  justification: z.string().optional().nullable(),
  implementationStatus: z.enum(controlImplementationStatusValues).optional(),
  controlId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// ============================================================================
// PATCH - Update SoA Item
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ frameworkId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { frameworkId, itemId } = await params
    const body = await request.json()
    const data = updateSoaItemSchema.parse(body)

    // Verify framework belongs to org
    const [framework] = await db
      .select({ id: securityFrameworks.id })
      .from(securityFrameworks)
      .where(
        and(
          eq(securityFrameworks.id, frameworkId),
          eq(securityFrameworks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    // Verify SoA item exists and belongs to framework
    const [existing] = await db
      .select()
      .from(securitySoaItems)
      .where(
        and(
          eq(securitySoaItems.id, itemId),
          eq(securitySoaItems.frameworkId, frameworkId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "SoA item not found" }, { status: 404 })
    }

    // If linking to org control, verify it exists and belongs to org
    if (data.controlId) {
      const [control] = await db
        .select({ id: securityControls.id })
        .from(securityControls)
        .where(
          and(
            eq(securityControls.id, data.controlId),
            eq(securityControls.orgId, session.orgId)
          )
        )
        .limit(1)

      if (!control) {
        return NextResponse.json({ error: "Control not found" }, { status: 404 })
      }
    }

    // Validate: if not_applicable, require justification
    if (data.applicability === "not_applicable" && !data.justification && !existing.justification) {
      return NextResponse.json(
        { error: "Justification is required when marking a control as not applicable" },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.applicability !== undefined) updateData.applicability = data.applicability
    if (data.justification !== undefined) updateData.justification = data.justification
    if (data.implementationStatus !== undefined) updateData.implementationStatus = data.implementationStatus
    if (data.controlId !== undefined) updateData.controlId = data.controlId
    if (data.notes !== undefined) updateData.notes = data.notes

    // Update SoA item
    const [updated] = await db
      .update(securitySoaItems)
      .set(updateData)
      .where(eq(securitySoaItems.id, itemId))
      .returning()

    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.soa",
        "soa_item",
        itemId,
        updated.controlId ?? itemId,
        existing,
        updated
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating SoA item:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

