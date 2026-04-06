/**
 * Document Detail API Routes
 * GET /api/docs/documents/[id] - Get document by ID or slug
 * PUT /api/docs/documents/[id] - Update document
 * DELETE /api/docs/documents/[id] - Delete document
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  documents,
  documentVersions,
  documentRollouts,
  documentAcknowledgments,
  persons,
} from "@/lib/db/schema"
import { UpdateDocumentSchema } from "@/lib/docs/types"
import { requirePermission, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import {
  readContent,
  writeContent,
  deleteContent,
  getOrgDocsSettings,
} from "@/lib/docs/storage"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/docs/documents/[id]
 * Query params:
 * - content: "false" to exclude content
 * - rolloutId: if provided, returns the content snapshot from that rollout
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.documents.view())

    const { id } = await context.params
    const includeContent = request.nextUrl.searchParams.get("content") !== "false"
    const rolloutId = request.nextUrl.searchParams.get("rolloutId")

    const [doc] = await db
      .select({
        id: documents.id,
        orgId: documents.orgId,
        slug: documents.slug,
        title: documents.title,
        description: documents.description,
        content: documents.content,
        storageMode: documents.storageMode,
        fileId: documents.fileId,
        category: documents.category,
        tags: documents.tags,
        status: documents.status,
        currentVersion: documents.currentVersion,
        ownerId: documents.ownerId,
        ownerName: persons.name,
        ownerEmail: persons.email,
        lastReviewedAt: documents.lastReviewedAt,
        nextReviewAt: documents.nextReviewAt,
        reviewFrequencyDays: documents.reviewFrequencyDays,
        showHeader: documents.showHeader,
        showFooter: documents.showFooter,
        showVersionHistory: documents.showVersionHistory,
        linkedControlIds: documents.linkedControlIds,
        linkedFrameworkCodes: documents.linkedFrameworkCodes,
        metadata: documents.metadata,
        createdById: documents.createdById,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        publishedAt: documents.publishedAt,
      })
      .from(documents)
      .leftJoin(persons, eq(documents.ownerId, persons.id))
      .where(
        and(
          eq(documents.orgId, session.orgId),
          isUUID(id) ? eq(documents.id, id) : eq(documents.slug, id)
        )
      )
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const versions = await db
      .select({
        id: documentVersions.id,
        version: documentVersions.version,
        changeDescription: documentVersions.changeDescription,
        changeSummary: documentVersions.changeSummary,
        approvedById: documentVersions.approvedById,
        approvedByName: persons.name,
        approvedAt: documentVersions.approvedAt,
        createdAt: documentVersions.createdAt,
      })
      .from(documentVersions)
      .leftJoin(persons, eq(documentVersions.approvedById, persons.id))
      .where(eq(documentVersions.documentId, doc.id))
      .orderBy(desc(documentVersions.createdAt))

    const ackStats = await db
      .select({ status: documentAcknowledgments.status })
      .from(documentAcknowledgments)
      .innerJoin(
        documentRollouts,
        and(
          eq(documentAcknowledgments.rolloutId, documentRollouts.id),
          eq(documentRollouts.isActive, true)
        )
      )
      .where(eq(documentAcknowledgments.documentId, doc.id))

    const acknowledgmentStats = {
      total: ackStats.length,
      pending: ackStats.filter((a) => a.status === "pending").length,
      viewed: ackStats.filter((a) => a.status === "viewed").length,
      acknowledged: ackStats.filter((a) => a.status === "acknowledged").length,
      signed: ackStats.filter((a) => a.status === "signed").length,
    }

    let content: string | null = null
    let rolloutVersion: string | null = null

    if (includeContent) {
      if (rolloutId) {
        const [rollout] = await db
          .select({
            contentSnapshot: documentRollouts.contentSnapshot,
            versionAtRollout: documentRollouts.versionAtRollout,
          })
          .from(documentRollouts)
          .where(
            and(
              eq(documentRollouts.id, rolloutId),
              eq(documentRollouts.documentId, doc.id)
            )
          )
          .limit(1)

        if (rollout) {
          content = rollout.contentSnapshot
          rolloutVersion = rollout.versionAtRollout
        }
      }

      if (!content) {
        const orgSettings = await getOrgDocsSettings(session.orgId)
        content = await readContent(doc, orgSettings)
      }
    }

    const response = {
      ...doc,
      owner: doc.ownerId
        ? { id: doc.ownerId, name: doc.ownerName, email: doc.ownerEmail }
        : null,
      content,
      currentVersion: rolloutVersion || doc.currentVersion,
      displayVersion: rolloutVersion || doc.currentVersion,
      isRolloutContent: !!rolloutVersion,
      versions: versions.map((v) => ({
        ...v,
        approvedBy: v.approvedById
          ? { id: v.approvedById, name: v.approvedByName }
          : null,
      })),
      acknowledgmentStats,
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error("Error fetching document:", error)
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    )
  }
}

function bumpPatchVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1]}.1`
  } else if (parts.length >= 3) {
    const patch = parseInt(parts[2], 10) || 0
    return `${parts[0]}.${parts[1]}.${patch + 1}`
  }
  return `${version}.1`
}

/**
 * PUT /api/docs/documents/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.documents.view())

    const { id } = await context.params
    const body = await request.json()

    const parseResult = UpdateDocumentSchema.safeParse(body)
    if (!parseResult.success) {
      console.error(
        "Document update validation error:",
        parseResult.error.flatten()
      )
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    const [existing] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.orgId, session.orgId),
          isUUID(id) ? eq(documents.id, id) : eq(documents.slug, id)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    if (data.slug && data.slug !== existing.slug) {
      const [slugExists] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.orgId, session.orgId),
            eq(documents.slug, data.slug)
          )
        )
        .limit(1)

      if (slugExists) {
        return NextResponse.json(
          { error: "A document with this slug already exists" },
          { status: 409 }
        )
      }
    }

    // Read existing content via storage resolver to detect changes
    const orgSettings = await getOrgDocsSettings(session.orgId)
    const existingContent = await readContent(existing, orgSettings)
    const contentChanged =
      data.content !== undefined && data.content !== existingContent

    // Write content via storage resolver if provided
    let fileId = existing.fileId
    if (data.content !== undefined) {
      try {
        const result = await writeContent(
          existing,
          orgSettings,
          data.content || "",
          session.userId
        )
        fileId = result.fileId
      } catch (err) {
        console.error("[Docs] Content write failed:", err)
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to write document content",
          },
          { status: 500 }
        )
      }
    }

    const isPublishing =
      data.status === "published" && existing.status !== "published"

    const updateData: Record<string, unknown> = {
      ...data,
      content: undefined, // content is persisted by writeContent above
      fileId,
      updatedAt: new Date(),
      nextReviewAt: data.nextReviewAt || existing.nextReviewAt,
    }

    if (isPublishing) {
      updateData.publishedAt = new Date()
    } else if (data.publishedAt) {
      updateData.publishedAt = new Date(data.publishedAt)
    } else {
      updateData.publishedAt = existing.publishedAt
    }

    const isManualVersionBump =
      data.currentVersion && data.currentVersion !== existing.currentVersion
    const shouldAutoVersion =
      existing.status === "published" && contentChanged && !isManualVersionBump

    if (shouldAutoVersion) {
      updateData.currentVersion = bumpPatchVersion(existing.currentVersion)
    }

    const [updated] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, existing.id))
      .returning()

    if (isManualVersionBump) {
      await db.insert(documentVersions).values({
        documentId: existing.id,
        version: data.currentVersion!,
        changeDescription:
          body.changeDescription ||
          `Updated to version ${data.currentVersion}`,
        changeSummary: body.changeSummary,
        contentSnapshot: data.content || existingContent || undefined,
        createdById: session.userId,
      })
    } else if (shouldAutoVersion) {
      await db.insert(documentVersions).values({
        documentId: existing.id,
        version: updated.currentVersion,
        changeDescription: body.changeDescription || "Content updated",
        changeSummary:
          body.changeSummary || "Automatic version from content update",
        contentSnapshot: data.content || undefined,
        createdById: session.userId,
      })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "docs.documents",
        "document",
        updated.id,
        updated.title,
        { title: existing.title, status: existing.status },
        { title: updated.title, status: updated.status }
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating document:", error)
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/docs/documents/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.docs.documents.view())

    const { id } = await context.params

    const [existing] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.orgId, session.orgId),
          isUUID(id) ? eq(documents.id, id) : eq(documents.slug, id)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Clean up filing artefacts before cascade-deleting the document
    await deleteContent(existing)

    await db.delete(documents).where(eq(documents.id, existing.id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("docs.documents", "document", {
        id: existing.id,
        slug: existing.slug,
        title: existing.title,
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    )
  }
}
