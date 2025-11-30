/**
 * Generated types and Zod schemas for Security ISMS Risk entity
 */

import { z } from "zod"

/**
 * Risk likelihood values
 */
export const riskLikelihoodValues = ["low", "medium", "high"] as const
export type RiskLikelihood = (typeof riskLikelihoodValues)[number]

/**
 * Risk impact values
 */
export const riskImpactValues = ["low", "medium", "high"] as const
export type RiskImpact = (typeof riskImpactValues)[number]

/**
 * Risk level values
 */
export const riskLevelValues = ["low", "medium", "high", "critical"] as const
export type RiskLevel = (typeof riskLevelValues)[number]

/**
 * Risk status values
 */
export const riskStatusValues = ["open", "mitigating", "accepted", "closed"] as const
export type RiskStatus = (typeof riskStatusValues)[number]

/**
 * Risk status badge variants for UI
 */
export const riskStatusVariants: Record<RiskStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open", variant: "destructive" },
  mitigating: { label: "Mitigating", variant: "secondary" },
  accepted: { label: "Accepted", variant: "outline" },
  closed: { label: "Closed", variant: "default" },
}

/**
 * Risk level badge variants for UI
 */
export const riskLevelVariants: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

/**
 * Base Risk schema (for API responses)
 */
export const RiskSchema = z.object({
  risk_id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  likelihood: z.enum(riskLikelihoodValues),
  impact: z.enum(riskImpactValues),
  level: z.enum(riskLevelValues),
  status: z.enum(riskStatusValues),
  framework: z.string().optional(),
})

export type Risk = z.infer<typeof RiskSchema>

/**
 * Create Risk schema (for POST requests)
 */
export const CreateRiskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  likelihood: z.enum(riskLikelihoodValues),
  impact: z.enum(riskImpactValues),
  framework: z.string().optional(),
})

export type CreateRisk = z.infer<typeof CreateRiskSchema>

/**
 * Update Risk schema (for PUT requests)
 */
export const UpdateRiskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  description: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  likelihood: z.enum(riskLikelihoodValues).optional(),
  impact: z.enum(riskImpactValues).optional(),
  status: z.enum(riskStatusValues).optional(),
  framework: z.string().optional(),
})

export type UpdateRisk = z.infer<typeof UpdateRiskSchema>
