import type { SecurityIncident } from "@/lib/db/schema/security"

/** Bump patch segment of a semantic version string (e.g. 1.0 → 1.0.1). */
export function bumpIncidentVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.1`
  if (parts.length >= 3) {
    const patch = parseInt(parts[2], 10) || 0
    return `${parts[0]}.${parts[1]}.${patch + 1}`
  }
  return `${version}.1`
}

/** Fields stored in an incident version snapshot. */
export function buildIncidentSnapshot(incident: SecurityIncident): Record<string, unknown> {
  return {
    title: incident.title,
    description: incident.description,
    classification: incident.classification,
    severity: incident.severity,
    status: incident.status,
    ownerId: incident.ownerId,
    linkedEvidenceIds: incident.linkedEvidenceIds,
    impactDescription: incident.impactDescription,
    containmentActions: incident.containmentActions,
    eradicationActions: incident.eradicationActions,
    recoveryActions: incident.recoveryActions,
    rootCauseAnalysis: incident.rootCauseAnalysis,
    lessonsLearned: incident.lessonsLearned,
    notes: incident.notes,
  }
}
