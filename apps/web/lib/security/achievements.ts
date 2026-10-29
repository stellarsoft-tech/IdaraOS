/**
 * Helpers for security achievement reporting periods.
 * Reuses the same FY year pattern as objectives.
 */

export {
  getCurrentObjectiveYear as getCurrentAchievementYear,
  getObjectiveYearOptions as getAchievementYearOptions,
  periodFromYear,
  extractYearFromPeriodLabel,
  getAvailableObjectiveYears as getAvailableAchievementYears,
} from "@/lib/security/objectives"
