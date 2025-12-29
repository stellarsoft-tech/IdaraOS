/**
 * Create Controls from Standard Controls API
 * Batch create org controls from framework standard controls
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityControls, 
  securityControlMappings,
  securityStandardControls,
  securitySoaItems,
  securityFrameworks,
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and, inArray, sql, desc } from "drizzle-orm"
import { createAuditLogger, extractActor } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createFromStandardSchema = z.object({
  standardControlIds: z.array(z.string().uuid()).min(1, "At least one standard control is required"),
  frameworkId: z.string().uuid().optional(), // If provided, also link to SoA
  defaultStatus: z.enum(["active", "inactive", "under_review"]).optional().default("active"),
  defaultImplementationStatus: z.enum([
    "not_implemented", 
    "partially_implemented", 
    "implemented", 
    "effective"
  ]).optional().default("not_implemented"),
})

// ============================================================================
// POST - Create Controls from Standard Controls
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actor = await extractActor(session.userId, session.email, session.name)
    const audit = createAuditLogger(session.orgId, actor)

    const body = await request.json()
    const data = createFromStandardSchema.parse(body)

    // Fetch the standard controls
    const standardControls = await db
      .select({
        id: securityStandardControls.id,
        controlId: securityStandardControls.controlId,
        title: securityStandardControls.title,
        description: securityStandardControls.description,
        frameworkCode: securityStandardControls.frameworkCode,
        category: securityStandardControls.category,
        controlType: securityStandardControls.controlType,
      })
      .from(securityStandardControls)
      .where(inArray(securityStandardControls.id, data.standardControlIds))

    if (standardControls.length === 0) {
      return NextResponse.json(
        { error: "No valid standard controls found" },
        { status: 400 }
      )
    }

    // Check which standard controls already have org controls mapped
    const existingMappings = await db
      .select({
        standardControlId: securityControlMappings.standardControlId,
        controlId: securityControlMappings.controlId,
      })
      .from(securityControlMappings)
      .where(
        and(
          eq(securityControlMappings.orgId, session.orgId),
          inArray(securityControlMappings.standardControlId, data.standardControlIds)
        )
      )

    const existingMappedIds = new Set(existingMappings.map(m => m.standardControlId))

    // Filter out already-mapped standard controls
    const controlsToCreate = standardControls.filter(sc => !existingMappedIds.has(sc.id))

    if (controlsToCreate.length === 0) {
      return NextResponse.json({
        message: "All selected standard controls already have org controls mapped",
        created: [],
        skipped: standardControls.map(sc => ({
          standardControlId: sc.controlId,
          reason: "already_mapped",
        })),
      })
    }

    // Get the next control ID number
    const [lastControl] = await db
      .select({ controlId: securityControls.controlId })
      .from(securityControls)
      .where(eq(securityControls.orgId, session.orgId))
      .orderBy(desc(securityControls.createdAt))
      .limit(1)

    // Extract number from last control ID (e.g., "CTL-042" -> 42)
    let nextNumber = 1
    if (lastControl?.controlId) {
      const match = lastControl.controlId.match(/CTL-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    // Create org controls and mappings
    const createdControls: Array<{
      id: string
      controlId: string
      title: string
      standardControlId: string
      standardControlCode: string
    }> = []

    // Also get framework ID if needed for SoA linking
    let frameworkId: string | null = data.frameworkId || null
    if (!frameworkId && controlsToCreate.length > 0) {
      // Try to find framework by code from the first standard control
      const frameworkCode = controlsToCreate[0].frameworkCode
      const [framework] = await db
        .select({ id: securityFrameworks.id })
        .from(securityFrameworks)
        .where(
          and(
            eq(securityFrameworks.orgId, session.orgId),
            eq(securityFrameworks.code, frameworkCode)
          )
        )
        .limit(1)
      
      if (framework) {
        frameworkId = framework.id
      }
    }

    for (const sc of controlsToCreate) {
      // Generate control ID
      const controlIdStr = `CTL-${String(nextNumber).padStart(3, "0")}`
      nextNumber++

      // Create the org control
      const [newControl] = await db
        .insert(securityControls)
        .values({
          orgId: session.orgId,
          controlId: controlIdStr,
          title: sc.title,
          description: sc.description,
          status: data.defaultStatus,
          implementationStatus: data.defaultImplementationStatus,
          controlType: sc.controlType,
          category: sc.category,
        })
        .returning()

      // Create mapping to standard control
      await db
        .insert(securityControlMappings)
        .values({
          orgId: session.orgId,
          controlId: newControl.id,
          standardControlId: sc.id,
          coverageLevel: "full",
        })

      // If framework ID exists, link to SoA item if it exists
      if (frameworkId) {
        const [soaItem] = await db
          .select({ id: securitySoaItems.id })
          .from(securitySoaItems)
          .where(
            and(
              eq(securitySoaItems.frameworkId, frameworkId),
              eq(securitySoaItems.standardControlId, sc.id)
            )
          )
          .limit(1)

        if (soaItem) {
          await db
            .update(securitySoaItems)
            .set({ 
              controlId: newControl.id,
              updatedAt: new Date(),
            })
            .where(eq(securitySoaItems.id, soaItem.id))
        }
      }

      createdControls.push({
        id: newControl.id,
        controlId: controlIdStr,
        title: sc.title,
        standardControlId: sc.id,
        standardControlCode: sc.controlId,
      })

      // Audit log
      await audit.logCreate("security.controls", "control", newControl)
    }

    // Return summary
    const skipped = standardControls
      .filter(sc => existingMappedIds.has(sc.id))
      .map(sc => ({
        standardControlId: sc.controlId,
        reason: "already_mapped",
      }))

    return NextResponse.json({
      message: `Created ${createdControls.length} control(s)`,
      created: createdControls,
      skipped,
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating controls from standard:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

