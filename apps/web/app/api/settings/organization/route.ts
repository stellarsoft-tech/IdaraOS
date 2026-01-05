/**
 * Organization API Routes
 * GET /api/settings/organization - Get current organization
 * PUT /api/settings/organization - Update organization settings
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizations } from "@/lib/db/schema"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"

// Update schema
const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().max(255).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  appName: z.string().min(3, "Application name must be at least 3 characters").max(50).optional(),
  tagline: z.string().max(100).optional().nullable(),
  // Social & professional links
  linkedIn: z.string().url().max(255).optional().nullable(),
  twitter: z.string().url().max(255).optional().nullable(),
  youtube: z.string().url().max(255).optional().nullable(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  currency: z.string().length(3).optional(),
  settings: z.record(z.unknown()).optional(),
})

/**
 * GET /api/settings/organization
 */
export async function GET(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission("settings.organization", "view")
    const orgId = session.orgId
    
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(org)
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching organization:", error)
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/organization
 */
export async function PUT(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission("settings.organization", "edit")
    const orgId = session.orgId
    
    const body = await request.json()

    // Validate
    const parseResult = UpdateOrganizationSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // Get existing organization for audit log
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Update organization
    const [updated] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning()

    if (!updated) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Audit log the update
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "settings.organization",
        "organization",
        updated.id,
        updated.name,
        {
          name: existing.name,
          domain: existing.domain,
          logo: existing.logo,
          appName: existing.appName,
          tagline: existing.tagline,
          timezone: existing.timezone,
          dateFormat: existing.dateFormat,
          currency: existing.currency,
          linkedIn: existing.linkedIn,
          twitter: existing.twitter,
          youtube: existing.youtube,
        },
        {
          name: updated.name,
          domain: updated.domain,
          logo: updated.logo,
          appName: updated.appName,
          tagline: updated.tagline,
          timezone: updated.timezone,
          dateFormat: updated.dateFormat,
          currency: updated.currency,
          linkedIn: updated.linkedIn,
          twitter: updated.twitter,
          youtube: updated.youtube,
        }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error updating organization:", error)
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    )
  }
}

