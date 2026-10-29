/**
 * Approved Software API
 * GET  /api/security/software - The approved software catalog (recommended apps are added on first use)
 * POST /api/security/software - Add an app to the catalog
 */

import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareCatalog } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { ensureDefaultCatalog } from "@/lib/security/software-server"
import { catalogAppFieldsSchema, checkCatalogApp, checkInstallGroupWarning } from "@/lib/security/software-validation"

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505"
}

export async function GET() {
  try {
    const session = await requirePermission(...P.security.software.view())
    await ensureDefaultCatalog(session.orgId, session.userId)

    const apps = await db
      .select()
      .from(softwareCatalog)
      .where(eq(softwareCatalog.orgId, session.orgId))
      .orderBy(asc(softwareCatalog.name))

    return NextResponse.json({ data: apps })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching approved software:", error)
    return NextResponse.json({ error: "Failed to fetch approved software" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.software.create())

    const parsed = catalogAppFieldsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const rule = checkCatalogApp(parsed.data)
    if (rule) {
      return NextResponse.json({ error: rule }, { status: 400 })
    }

    const [created] = await db
      .insert(softwareCatalog)
      .values({ ...parsed.data, orgId: session.orgId, createdById: session.userId })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.software", "software_catalog_app", created)
    }

    const warning = await checkInstallGroupWarning(created.intuneAppId, created.installGroupId)
    return NextResponse.json({ data: created, warning }, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "An app with this name is already in the catalog" }, { status: 409 })
    }
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error adding approved software:", error)
    return NextResponse.json({ error: "Failed to add the app" }, { status: 500 })
  }
}
