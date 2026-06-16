import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { documents, securityIncidents, users } from "@/lib/db/schema"
import type {
  IncidentClassification,
  IncidentSeverity,
  IncidentStatus,
} from "@/lib/db/schema/security"

type IncidentDocument = typeof documents.$inferSelect

const incidentClassifications = new Set<IncidentClassification>(["event", "incident"])
const incidentSeverities = new Set<IncidentSeverity>(["p1", "p2", "p3", "p4"])
const incidentStatuses = new Set<IncidentStatus>([
  "draft",
  "reported",
  "triaging",
  "responding",
  "resolved",
  "closed",
])

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  return values.length > 0 ? values : undefined
}

function incidentIdFromDocument(doc: IncidentDocument, metadata: Record<string, unknown> | null): string {
  return (
    stringValue(metadata?.incidentId) ||
    stringValue(metadata?.referenceId) ||
    doc.slug
  )
}

async function resolveOwnerUserId(
  doc: IncidentDocument,
  metadata: Record<string, unknown> | null
): Promise<string | null> {
  const ownerUserId = stringValue(metadata?.ownerUserId)
  if (ownerUserId) {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, doc.orgId), eq(users.id, ownerUserId)))
      .limit(1)

    if (owner) return owner.id
  }

  if (!doc.ownerId) return null

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, doc.orgId), eq(users.personId, doc.ownerId)))
    .limit(1)

  return owner?.id ?? null
}

/**
 * Mirror incident-category documents into the Incident Register.
 *
 * Documentation remains the controlled record and source of version history;
 * the register stores operational metadata for ISO 27001 incident tracking.
 */
export async function syncIncidentRegisterFromDocument(doc: IncidentDocument): Promise<void> {
  if (doc.category !== "incident") return

  const metadata = doc.metadata as Record<string, unknown> | null
  const incidentId = incidentIdFromDocument(doc, metadata)
  const classification = stringValue(metadata?.classification)
  const severity = stringValue(metadata?.severity)
  const status = stringValue(metadata?.status)
  const ownerUserId = await resolveOwnerUserId(doc, metadata)

  const values = {
    incidentId,
    title: doc.title,
    description: doc.description ?? null,
    classification: incidentClassifications.has(classification as IncidentClassification)
      ? classification as IncidentClassification
      : "incident",
    severity: incidentSeverities.has(severity as IncidentSeverity)
      ? severity as IncidentSeverity
      : "p3",
    status: incidentStatuses.has(status as IncidentStatus)
      ? status as IncidentStatus
      : doc.status === "published" ? "reported" as IncidentStatus : "draft" as IncidentStatus,
    publicationStatus: doc.status === "published" ? "published" as const : "draft" as const,
    currentVersion: doc.currentVersion,
    ownerId: ownerUserId,
    documentId: doc.id,
    linkedEvidenceIds: stringArrayValue(metadata?.linkedEvidenceIds) ?? null,
    impactDescription: stringValue(metadata?.impactDescription) ?? null,
    notes: stringValue(metadata?.notes) ?? null,
    publishedAt: doc.publishedAt,
    updatedAt: new Date(),
  }

  const [existingByDocument] = await db
    .select({ id: securityIncidents.id })
    .from(securityIncidents)
    .where(and(
      eq(securityIncidents.orgId, doc.orgId),
      eq(securityIncidents.documentId, doc.id)
    ))
    .limit(1)

  if (existingByDocument) {
    await db
      .update(securityIncidents)
      .set(values)
      .where(eq(securityIncidents.id, existingByDocument.id))
    return
  }

  const [existingByIncidentId] = await db
    .select({ id: securityIncidents.id })
    .from(securityIncidents)
    .where(and(
      eq(securityIncidents.orgId, doc.orgId),
      eq(securityIncidents.incidentId, incidentId)
    ))
    .limit(1)

  if (existingByIncidentId) {
    await db
      .update(securityIncidents)
      .set(values)
      .where(eq(securityIncidents.id, existingByIncidentId.id))
    return
  }

  await db.insert(securityIncidents).values({
    orgId: doc.orgId,
    reportedById: doc.createdById,
    ...values,
  })
}
