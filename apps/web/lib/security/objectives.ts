/**
 * Helpers for security objective reporting periods (ISO 27001 Clause 6.2).
 */

/** Returns the current calendar year for default objective periods. */
export function getCurrentObjectiveYear(): number {
  return new Date().getFullYear()
}

/** Build a list of selectable years centered on the current year. */
export function getObjectiveYearOptions(range = 5): number[] {
  const current = getCurrentObjectiveYear()
  return Array.from({ length: range * 2 + 1 }, (_, i) => current - range + i)
}

/** Derive period label and date boundaries from a selected year. */
export function periodFromYear(year: number | string) {
  const y = Number(year)
  return {
    periodLabel: `FY ${y}`,
    periodStart: `${y}-01-01`,
    periodEnd: `${y}-12-31`,
  }
}

/** Extract year from a period label like "FY 2026", or null if not parseable. */
export function extractYearFromPeriodLabel(label?: string | null): number | null {
  if (!label) return null
  const match = label.match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

/** Merge years from existing objectives with the default selectable range. */
export function getAvailableObjectiveYears(
  objectives: { periodLabel?: string | null }[],
  range = 5
): number[] {
  const years = new Set(getObjectiveYearOptions(range))
  for (const objective of objectives) {
    const year = extractYearFromPeriodLabel(objective.periodLabel)
    if (year) years.add(year)
  }
  return Array.from(years).sort((a, b) => b - a)
}
