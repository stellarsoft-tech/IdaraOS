/**
 * Approved Software Item API
 * PATCH  /api/security/software/[id] - Update a catalog app
 * DELETE /api/security/software/[id] - Remove a catalog app (past requests and installs keep their snapshot)
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareCatalog } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { catalogAppFieldsSchema, checkCatalogApp, checkInstallGroupWarning } from "@/lib/security/software-validation"

interface RouteContext {
  params: Promise<{ id: string }>
}

const updateSchema = catalogAppFieldsSchema.partial()

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505"
}

async function getApp(id: string, orgId: string) {
  const [app] = await db
    .select()
    .from(softwareCatalog)
    .where(and(eq(softwareCatalog.id, id), eq(softwareCatalog.orgId, orgId)))
    .limit(1)
  return app
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.software.edit())
    const { id } = await context.params

    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }

    const existing = await getApp(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }
    const rule = checkCatalogApp({ ...existing, ...parsed.data })
    if (rule) {
      return NextResponse.json({ error: rule }, { status: 400 })
    }

    const [updated] = await db
      .update(softwareCatalog)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(softwareCatalog.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.software",
        "software_catalog_app",
        id,
        updated.name,
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>
      )
    }

    const warning = await checkInstallGroupWarning(updated.intuneAppId, updated.installGroupId)
    return NextResponse.json({ data: updated, warning })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "An app with this name is already in the catalog" }, { status: 409 })
    }
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating approved software:", error)
    return NextResponse.json({ error: "Failed to update the app" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.software.delete())
    const { id } = await context.params

    const existing = await getApp(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    await db.delete(softwareCatalog).where(eq(softwareCatalog.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.software", "software_catalog_app", existing)
    }

    return NextResponse.json({ data: { id } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting approved software:", error)
    return NextResponse.json({ error: "Failed to delete the app" }, { status: 500 })
  }
}
