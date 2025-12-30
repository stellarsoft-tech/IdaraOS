/**
 * Documentation module types
 */

import { z } from "zod"

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Document status enum
 */
export const documentStatusEnum = z.enum(["draft", "in_review", "published", "archived"])
export type DocumentStatus = z.infer<typeof documentStatusEnum>

/**
 * Document category enum
 */
export const documentCategoryEnum = z.enum(["policy", "procedure", "guideline", "manual", "template", "training", "general"])
export type DocumentCategory = z.infer<typeof documentCategoryEnum>

/**
 * Rollout target type enum
 */
export const rolloutTargetTypeEnum = z.enum(["organization", "team", "role", "user"])
export type RolloutTargetType = z.infer<typeof rolloutTargetTypeEnum>

/**
 * Rollout requirement enum
 */
export const rolloutRequirementEnum = z.enum(["optional", "required", "required_with_signature"])
export type RolloutRequirement = z.infer<typeof rolloutRequirementEnum>

/**
 * Acknowledgment status enum
 */
export const acknowledgmentStatusEnum = z.enum(["pending", "viewed", "acknowledged", "signed"])
export type AcknowledgmentStatus = z.infer<typeof acknowledgmentStatusEnum>

/**
 * Create document schema
 */
export const CreateDocumentSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: documentCategoryEnum.default("general"),
  tags: z.array(z.string()).optional(),
  status: documentStatusEnum.default("draft"),
  currentVersion: z.string().default("1.0"),
  ownerId: z.string().uuid().optional().nullable(),
  nextReviewAt: z.string().optional().nullable(),
  reviewFrequencyDays: z.coerce.number().int().positive().optional().nullable(),
  showHeader: z.boolean().default(true),
  showFooter: z.boolean().default(true),
  showVersionHistory: z.boolean().default(true),
  linkedControlIds: z.array(z.string().uuid()).optional(),
  linkedFrameworkCodes: z.array(z.string()).optional(),
  metadata: z.object({
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
    department: z.string().optional(),
    confidentiality: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
  }).passthrough().optional(),
  content: z.string().optional(), // MDX content to write to file
})
export type CreateDocument = z.infer<typeof CreateDocumentSchema>

/**
 * Update document schema
 */
export const UpdateDocumentSchema = CreateDocumentSchema.partial().extend({
  publishedAt: z.string().optional().nullable(),
  // Allow any additional fields from the form
  changeDescription: z.string().optional(),
  changeSummary: z.string().optional(),
})
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>

/**
 * Create rollout schema
 */
export const CreateRolloutSchema = z.object({
  documentId: z.string().uuid(),
  targetType: rolloutTargetTypeEnum,
  targetId: z.string().uuid().optional().nullable(),
  requirement: rolloutRequirementEnum.default("optional"),
  dueDate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sendNotification: z.boolean().default(true),
  reminderFrequencyDays: z.number().int().positive().optional().nullable(),
})
export type CreateRollout = z.infer<typeof CreateRolloutSchema>

/**
 * Update rollout schema
 */
export const UpdateRolloutSchema = CreateRolloutSchema.partial()
export type UpdateRollout = z.infer<typeof UpdateRolloutSchema>

/**
 * Create acknowledgment schema
 */
export const CreateAcknowledgmentSchema = z.object({
  documentId: z.string().uuid(),
  status: acknowledgmentStatusEnum.default("pending"),
  versionAcknowledged: z.string().optional(),
  notes: z.string().max(1000).optional(),
  signatureData: z.object({
    method: z.enum(["checkbox", "typed", "drawn"]),
    value: z.string().optional(),
  }).optional(),
})
export type CreateAcknowledgment = z.infer<typeof CreateAcknowledgmentSchema>

/**
 * Update acknowledgment schema
 */
export const UpdateAcknowledgmentSchema = z.object({
  status: acknowledgmentStatusEnum,
  versionAcknowledged: z.string().optional(),
  notes: z.string().max(1000).optional(),
  signatureData: z.object({
    method: z.enum(["checkbox", "typed", "drawn"]),
    value: z.string().optional(),
  }).optional(),
})
export type UpdateAcknowledgment = z.infer<typeof UpdateAcknowledgmentSchema>

/**
 * Create version schema
 */
export const CreateVersionSchema = z.object({
  documentId: z.string().uuid(),
  version: z.string().min(1),
  changeDescription: z.string().optional(),
  changeSummary: z.string().max(200).optional(),
  contentSnapshot: z.string().optional(),
})
export type CreateVersion = z.infer<typeof CreateVersionSchema>

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Document with related data
 */
export interface DocumentWithRelations {
  id: string
  orgId: string
  slug: string
  title: string
  description: string | null
  category: DocumentCategory
  tags: string[] | null
  status: DocumentStatus
  currentVersion: string
  ownerId: string | null
  owner?: {
    id: string
    name: string
    email: string
  } | null
  lastReviewedAt: string | null
  nextReviewAt: string | null
  reviewFrequencyDays: number | null
  showHeader: boolean
  showFooter: boolean
  showVersionHistory: boolean
  linkedControlIds: string[] | null
  linkedFrameworkCodes: string[] | null
  metadata: Record<string, unknown> | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  // Additional computed fields
  content?: string | null
  rolloutCount?: number
  versions?: DocumentVersionWithRelations[]
  acknowledgmentStats?: {
    total: number
    pending: number
    viewed: number
    acknowledged: number
    signed: number
  }
}

/**
 * Document version with relations
 */
export interface DocumentVersionWithRelations {
  id: string
  documentId: string
  version: string
  changeDescription: string | null
  changeSummary: string | null
  approvedById: string | null
  approvedBy?: {
    id: string
    name: string
  } | null
  approvedAt: string | null
  createdById: string | null
  createdBy?: {
    id: string
    name: string
  } | null
  createdAt: string
}

/**
 * Rollout with target info
 */
export interface RolloutWithTarget {
  id: string
  documentId: string
  targetType: RolloutTargetType
  targetId: string | null
  targetName?: string | null
  requirement: RolloutRequirement
  dueDate: string | null
  isActive: boolean
  sendNotification: boolean
  reminderFrequencyDays: number | null
  createdAt: string
  updatedAt: string
  // Stats
  targetCount?: number
  acknowledgedCount?: number
}

/**
 * Acknowledgment with user info
 */
export interface AcknowledgmentWithUser {
  id: string
  documentId: string
  documentTitle?: string
  documentSlug?: string
  documentCategory?: string
  rolloutId: string | null
  userId: string
  userName: string
  userEmail: string
  personId: string | null
  status: AcknowledgmentStatus
  versionAcknowledged: string | null
  viewedAt: string | null
  acknowledgedAt: string | null
  signedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * User's pending document
 */
export interface PendingDocument {
  documentId: string
  documentSlug: string
  documentTitle: string
  documentCategory: DocumentCategory
  documentVersion: string
  rolloutId: string
  requirement: RolloutRequirement
  dueDate: string | null
  acknowledgmentId: string | null
  acknowledgmentStatus: AcknowledgmentStatus
  isOverdue: boolean
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface DocumentFilters {
  search?: string
  status?: DocumentStatus | DocumentStatus[]
  category?: DocumentCategory | DocumentCategory[]
  ownerId?: string
  tag?: string
}

export interface RolloutFilters {
  documentId?: string
  targetType?: RolloutTargetType
  isActive?: boolean
}

export interface AcknowledgmentFilters {
  documentId?: string
  userId?: string
  status?: AcknowledgmentStatus | AcknowledgmentStatus[]
}

