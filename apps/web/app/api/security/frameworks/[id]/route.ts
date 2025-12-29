/**
 * Security Framework Detail API
 * Get, update, delete individual frameworks
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityFrameworks,
  securitySoaItems,
  securityStandardControls,
  frameworkStatusValues
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and, count, sql } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateFrameworkSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  version: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(frameworkStatusValues).optional(),
  scope: z.string().optional().nullable(),
  certificationBody: z.string().optional().nullable(),
  certificateNumber: z.string().optional().nullable(),
  certifiedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
})

// ============================================================================
// GET - Get Framework Detail
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

    // Fetch framework
    const [framework] = await db
      .select()
      .from(securityFrameworks)
      .where(
        and(
          eq(securityFrameworks.id, id),
          eq(securityFrameworks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    // Get stats
    const [{ totalControls }] = await db
      .select({ totalControls: count() })
      .from(securityStandardControls)
      .where(eq(securityStandardControls.frameworkCode, framework.code))

    const [soaStats] = await db
      .select({
        totalItems: count(),
        applicableCount: sql<number>`count(*) filter (where ${securitySoaItems.applicability} = 'applicable')`,
        notApplicableCount: sql<number>`count(*) filter (where ${securitySoaItems.applicability} = 'not_applicable')`,
        implementedCount: sql<number>`count(*) filter (where ${securitySoaItems.implementationStatus} in ('implemented', 'effective'))`,
        partialCount: sql<number>`count(*) filter (where ${securitySoaItems.implementationStatus} = 'partially_implemented')`,
        notImplementedCount: sql<number>`count(*) filter (where ${securitySoaItems.implementationStatus} = 'not_implemented' and ${securitySoaItems.applicability} = 'applicable')`,
      })
      .from(securitySoaItems)
      .where(eq(securitySoaItems.frameworkId, framework.id))

    return NextResponse.json({
      data: {
        ...framework,
        stats: {
          totalControls,
          soaItemsCount: soaStats?.totalItems || 0,
          applicableCount: soaStats?.applicableCount || 0,
          notApplicableCount: soaStats?.notApplicableCount || 0,
          implementedCount: soaStats?.implementedCount || 0,
          partialCount: soaStats?.partialCount || 0,
          notImplementedCount: soaStats?.notImplementedCount || 0,
          compliancePercent: soaStats?.applicableCount 
            ? Math.round((soaStats.implementedCount / soaStats.applicableCount) * 100) 
            : 0,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching framework:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Update Framework
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
    const data = updateFrameworkSchema.parse(body)

    // Check framework exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityFrameworks)
      .where(
        and(
          eq(securityFrameworks.id, id),
          eq(securityFrameworks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.version !== undefined) updateData.version = data.version
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    if (data.scope !== undefined) updateData.scope = data.scope
    if (data.certificationBody !== undefined) updateData.certificationBody = data.certificationBody
    if (data.certificateNumber !== undefined) updateData.certificateNumber = data.certificateNumber
    if (data.certifiedAt !== undefined) updateData.certifiedAt = data.certifiedAt ? new Date(data.certifiedAt) : null
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
    if (data.settings !== undefined) updateData.settings = data.settings

    // Update framework
    const [updated] = await db
      .update(securityFrameworks)
      .set(updateData)
      .where(eq(securityFrameworks.id, id))
      .returning()

    // Audit log
    await createSimpleAuditLog({
      action: "update",
      entityType: "security_framework",
      entityId: id,
      userId: session.userId,
      orgId: session.orgId,
      oldValues: existing,
      newValues: updated,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating framework:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Framework
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

    // Check framework exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityFrameworks)
      .where(
        and(
          eq(securityFrameworks.id, id),
          eq(securityFrameworks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    // Delete framework (cascades to SoA items)
    await db.delete(securityFrameworks).where(eq(securityFrameworks.id, id))

    // Audit log
    await createSimpleAuditLog({
      action: "delete",
      entityType: "security_framework",
      entityId: id,
      userId: session.userId,
      orgId: session.orgId,
      oldValues: existing,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting framework:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

