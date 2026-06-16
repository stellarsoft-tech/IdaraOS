import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  securityIncidents,
  securityIncidentVersions,
  incidentStatusValues,
  incidentSeverityValues,
  incidentClassificationValues,
  incidentPublicationStatusValues,
} from "@/lib/db/schema/security"
import { users } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"
import { getAuditLogger } from "@/lib/api/context"
import { isAssignableObjectiveOwner } from "@/lib/security/objective-owners"
import { bumpIncidentVersion, buildIncidentSnapshot } from "@/lib/security/incidents"

const updateIncidentSchema = z.object({
  incidentId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  classification: z.enum(incidentClassificationValues).optional(),
  severity: z.enum(incidentSeverityValues).optional(),
  status: z.enum(incidentStatusValues).optional(),
  publicationStatus: z.enum(incidentPublicationStatusValues).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  detectedAt: z.string().optional().nullable(),
  reportedAt: z.string().optional().nullable(),
  containedAt: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
  closedAt: z.string().optional().nullable(),
  impactDescription: z.string().optional().nullable(),
  containmentActions: z.string().optional().nullable(),
  eradicationActions: z.string().optional().nullable(),
  recoveryActions: z.string().optional().nullable(),
  rootCauseAnalysis: z.string().optional().nullable(),
  lessonsLearned: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  changeDescription: z.string().optional(),
})

function toTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value)
}

const VERSIONED_FIELDS = [
  "title", "description", "classification", "severity", "status",
  "ownerId", "linkedEvidenceIds", "impactDescription", "containmentActions",
  "eradicationActions", "recoveryActions", "rootCauseAnalysis", "lessonsLearned", "notes",
] as const

function hasVersionedChanges(
  existing: typeof securityIncidents.$inferSelect,
  updates: z.infer<typeof updateIncidentSchema>
): boolean {
  return VERSIONED_FIELDS.some((field) => {
    if (updates[field] === undefined) return false
    const next = updates[field]
    const prev = existing[field as keyof typeof existing]
    return JSON.stringify(next) !== JSON.stringify(prev)
  })
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

    const { id } = await params
    const owner = users

    const [incident] = await db
      .select({
        id: securityIncidents.id,
        orgId: securityIncidents.orgId,
        incidentId: securityIncidents.incidentId,
        title: securityIncidents.title,
        description: securityIncidents.description,
        classification: securityIncidents.classification,
        severity: securityIncidents.severity,
        status: securityIncidents.status,
        publicationStatus: securityIncidents.publicationStatus,
        currentVersion: securityIncidents.currentVersion,
        ownerId: securityIncidents.ownerId,
        ownerName: owner.name,
        ownerEmail: owner.email,
        reportedById: securityIncidents.reportedById,
        approvedById: securityIncidents.approvedById,
        linkedEvidenceIds: securityIncidents.linkedEvidenceIds,
        detectedAt: securityIncidents.detectedAt,
        reportedAt: securityIncidents.reportedAt,
        containedAt: securityIncidents.containedAt,
        resolvedAt: securityIncidents.resolvedAt,
        closedAt: securityIncidents.closedAt,
        publishedAt: securityIncidents.publishedAt,
        impactDescription: securityIncidents.impactDescription,
        containmentActions: securityIncidents.containmentActions,
        eradicationActions: securityIncidents.eradicationActions,
        recoveryActions: securityIncidents.recoveryActions,
        rootCauseAnalysis: securityIncidents.rootCauseAnalysis,
        lessonsLearned: securityIncidents.lessonsLearned,
        notes: securityIncidents.notes,
        createdAt: securityIncidents.createdAt,
        updatedAt: securityIncidents.updatedAt,
      })
      .from(securityIncidents)
      .leftJoin(owner, eq(securityIncidents.ownerId, owner.id))
      .where(and(eq(securityIncidents.id, id), eq(securityIncidents.orgId, session.orgId)))
      .limit(1)

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    const versions = await db
      .select()
      .from(securityIncidentVersions)
      .where(eq(securityIncidentVersions.incidentId, id))
      .orderBy(desc(securityIncidentVersions.createdAt))

    return NextResponse.json({ data: { ...incident, versions } })
  } catch (error) {
    console.error("Error fetching incident:", error)
    return NextResponse.json({ error: "Failed to fetch incident" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validated = updateIncidentSchema.parse(body)

    const [existing] = await db
      .select()
      .from(securityIncidents)
      .where(and(eq(securityIncidents.id, id), eq(securityIncidents.orgId, session.orgId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    if (validated.ownerId !== undefined && !(await isAssignableObjectiveOwner(session.orgId, validated.ownerId))) {
      return NextResponse.json({ error: "Owner must be an active platform user" }, { status: 400 })
    }

    const publishing = validated.publicationStatus === "published" && existing.publicationStatus !== "published"
    const versionedChange =
      existing.publicationStatus === "published" && hasVersionedChanges(existing, validated)

    const nextVersion = versionedChange ? bumpIncidentVersion(existing.currentVersion) : existing.currentVersion

    if (versionedChange) {
      await db.insert(securityIncidentVersions).values({
        incidentId: existing.id,
        version: existing.currentVersion,
        changeDescription: validated.changeDescription || `Snapshot before v${nextVersion}`,
        snapshot: buildIncidentSnapshot(existing),
        createdById: session.userId,
      })
    }

    const [updated] = await db
      .update(securityIncidents)
      .set({
        ...validated.incidentId !== undefined && { incidentId: validated.incidentId },
        ...validated.title !== undefined && { title: validated.title },
        ...validated.description !== undefined && { description: validated.description },
        ...validated.classification !== undefined && { classification: validated.classification },
        ...validated.severity !== undefined && { severity: validated.severity },
        ...validated.status !== undefined && { status: validated.status },
        ...validated.publicationStatus !== undefined && { publicationStatus: validated.publicationStatus },
        ...validated.ownerId !== undefined && { ownerId: validated.ownerId },
        ...validated.linkedEvidenceIds !== undefined && { linkedEvidenceIds: validated.linkedEvidenceIds },
        ...validated.detectedAt !== undefined && { detectedAt: toTimestamp(validated.detectedAt) },
        ...validated.reportedAt !== undefined && { reportedAt: toTimestamp(validated.reportedAt) },
        ...validated.containedAt !== undefined && { containedAt: toTimestamp(validated.containedAt) },
        ...validated.resolvedAt !== undefined && { resolvedAt: toTimestamp(validated.resolvedAt) },
        ...validated.closedAt !== undefined && { closedAt: toTimestamp(validated.closedAt) },
        ...validated.impactDescription !== undefined && { impactDescription: validated.impactDescription },
        ...validated.containmentActions !== undefined && { containmentActions: validated.containmentActions },
        ...validated.eradicationActions !== undefined && { eradicationActions: validated.eradicationActions },
        ...validated.recoveryActions !== undefined && { recoveryActions: validated.recoveryActions },
        ...validated.rootCauseAnalysis !== undefined && { rootCauseAnalysis: validated.rootCauseAnalysis },
        ...validated.lessonsLearned !== undefined && { lessonsLearned: validated.lessonsLearned },
        ...validated.notes !== undefined && { notes: validated.notes },
        ...(versionedChange && { currentVersion: nextVersion }),
        ...(publishing && {
          publishedAt: new Date(),
          approvedById: session.userId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(securityIncidents.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("security.incidents", "incident", id, updated.title, existing, updated)
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating incident:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const [existing] = await db
      .select()
      .from(securityIncidents)
      .where(and(eq(securityIncidents.id, id), eq(securityIncidents.orgId, session.orgId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    await db.delete(securityIncidents).where(eq(securityIncidents.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.incidents", "incident", { id, name: existing.title })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting incident:", error)
    return NextResponse.json({ error: "Failed to delete incident" }, { status: 500 })
  }
}
