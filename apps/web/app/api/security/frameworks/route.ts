/**
 * Security Frameworks API
 * CRUD operations for compliance frameworks
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
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createFrameworkSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  version: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(frameworkStatusValues).default("planned"),
  scope: z.string().optional(),
  certificationBody: z.string().optional(),
  certificateNumber: z.string().optional(),
  certifiedAt: z.string().optional(),
  expiresAt: z.string().optional(),
})

const updateFrameworkSchema = createFrameworkSchema.partial()

// ============================================================================
// GET - List Frameworks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch frameworks
    const frameworks = await db
      .select()
      .from(securityFrameworks)
      .where(eq(securityFrameworks.orgId, session.orgId))
      .orderBy(securityFrameworks.name)

    // Get SoA stats for each framework
    const frameworksWithStats = await Promise.all(
      frameworks.map(async (framework) => {
        // Get total standard controls for this framework
        const [{ totalControls }] = await db
          .select({ totalControls: count() })
          .from(securityStandardControls)
          .where(eq(securityStandardControls.frameworkCode, framework.code))

        // Get SoA stats
        const [soaStats] = await db
          .select({
            totalItems: count(),
            applicableCount: sql<number>`count(*) filter (where ${securitySoaItems.applicability} = 'applicable')`,
            implementedCount: sql<number>`count(*) filter (where ${securitySoaItems.implementationStatus} in ('implemented', 'effective'))`,
          })
          .from(securitySoaItems)
          .where(eq(securitySoaItems.frameworkId, framework.id))

        return {
          ...framework,
          controlsCount: totalControls,
          soaItemsCount: soaStats?.totalItems || 0,
          applicableCount: soaStats?.applicableCount || 0,
          implementedCount: soaStats?.implementedCount || 0,
          compliancePercent: soaStats?.applicableCount 
            ? Math.round((soaStats.implementedCount / soaStats.applicableCount) * 100) 
            : 0,
        }
      })
    )

    return NextResponse.json({ data: frameworksWithStats })
  } catch (error) {
    console.error("Error fetching frameworks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Framework
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createFrameworkSchema.parse(body)

    // Check if framework with this code already exists
    const [existing] = await db
      .select({ id: securityFrameworks.id })
      .from(securityFrameworks)
      .where(
        and(
          eq(securityFrameworks.orgId, session.orgId),
          eq(securityFrameworks.code, data.code)
        )
      )
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: "A framework with this code already exists" },
        { status: 409 }
      )
    }

    // Verify framework code is valid (has standard controls)
    const [{ standardControlsCount }] = await db
      .select({ standardControlsCount: count() })
      .from(securityStandardControls)
      .where(eq(securityStandardControls.frameworkCode, data.code))

    if (standardControlsCount === 0) {
      return NextResponse.json(
        { error: "Unknown framework code. No standard controls found for this framework." },
        { status: 400 }
      )
    }

    // Create framework
    const [framework] = await db
      .insert(securityFrameworks)
      .values({
        orgId: session.orgId,
        code: data.code,
        name: data.name,
        version: data.version,
        description: data.description,
        status: data.status,
        scope: data.scope,
        certificationBody: data.certificationBody,
        certificateNumber: data.certificateNumber,
        certifiedAt: data.certifiedAt ? new Date(data.certifiedAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      })
      .returning()

    // Auto-initialize SoA items
    const standardControls = await db
      .select({ id: securityStandardControls.id })
      .from(securityStandardControls)
      .where(eq(securityStandardControls.frameworkCode, data.code))

    if (standardControls.length > 0) {
      const soaItems = standardControls.map(sc => ({
        frameworkId: framework.id,
        standardControlId: sc.id,
        applicability: "applicable" as const,
        implementationStatus: "not_implemented" as const,
      }))

      await db.insert(securitySoaItems).values(soaItems)
    }

    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.frameworks", "framework", {
        ...framework,
      })
    }

    return NextResponse.json({ 
      data: {
        ...framework,
        controlsCount: standardControlsCount,
        soaItemsCount: standardControlsCount,
      }
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating framework:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

