/**
 * Helpers for security audit finding counters (ISO 27001:2022).
 */

import type { FindingSeverity } from "@/lib/db/schema/security"

export function computeAuditFindingCounts(
  findings: { severity: FindingSeverity | string }[]
) {
  let majorFindingsCount = 0
  let minorFindingsCount = 0
  let observationCount = 0
  let nonconformityCount = 0

  for (const finding of findings) {
    switch (finding.severity) {
      case "major":
      case "critical":
        majorFindingsCount += 1
        break
      case "minor":
        minorFindingsCount += 1
        break
      case "observation":
        observationCount += 1
        break
      case "nonconformity":
        nonconformityCount += 1
        break
      default:
        break
    }
  }

  return {
    findingsCount: findings.length,
    majorFindingsCount,
    minorFindingsCount,
    observationCount,
    nonconformityCount,
  }
}
