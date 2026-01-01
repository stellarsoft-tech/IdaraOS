/**
 * Documentation Schema - Drizzle ORM table definitions
 * Implements a comprehensive documentation module with:
 * - Document metadata and categorization
 * - Version history tracking
 * - Rollout management (teams, roles, users, org-wide)
 * - Acknowledgment/sign-off tracking
 * - Integration with MDX files stored in the codebase
 */

import { pgTable, uuid, text, timestamp, boolean, index, integer, jsonb, date } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { persons } from "./people"
import { users } from "./users"
import { teams } from "./teams"
import { roles } from "./rbac"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Document status values
 */
export const documentStatusValues = ["draft", "in_review", "published", "archived"] as const
export type DocumentStatus = (typeof documentStatusValues)[number]

/**
 * Document category values
 */
export const documentCategoryValues = ["policy", "procedure", "guideline", "manual", "template", "training", "general"] as const
export type DocumentCategory = (typeof documentCategoryValues)[number]

/**
 * Rollout target type values
 */
export const rolloutTargetTypeValues = ["organization", "team", "role", "user"] as const
export type RolloutTargetType = (typeof rolloutTargetTypeValues)[number]

/**
 * Rollout requirement type values
 */
export const rolloutRequirementValues = ["optional", "required", "required_with_signature"] as const
export type RolloutRequirement = (typeof rolloutRequirementValues)[number]

/**
 * Acknowledgment status values
 */
export const acknowledgmentStatusValues = ["pending", "viewed", "acknowledged", "signed"] as const
export type AcknowledgmentStatus = (typeof acknowledgmentStatusValues)[number]

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * Documents table - core document metadata
 * MDX content is stored in files at content/docs/{slug}.mdx
 */
export const documents = pgTable(
  "docs_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Document identification
    slug: text("slug").notNull(), // Used for file path: content/docs/{slug}.mdx
    title: text("title").notNull(),
    description: text("description"),
    
    // Categorization
    category: text("category", { enum: documentCategoryValues }).notNull().default("general"),
    tags: jsonb("tags").$type<string[]>(),
    
    // Status and workflow
    status: text("status", { enum: documentStatusValues }).notNull().default("draft"),
    
    // Current version info (denormalized for quick access)
    currentVersion: text("current_version").notNull().default("1.0"),
    
    // Ownership
    ownerId: uuid("owner_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Review schedule
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: date("next_review_at"),
    reviewFrequencyDays: integer("review_frequency_days"),
    
    // Display options
    showHeader: boolean("show_header").notNull().default(true),
    showFooter: boolean("show_footer").notNull().default(true),
    showVersionHistory: boolean("show_version_history").notNull().default(true),
    
    // Security/compliance links
    linkedControlIds: jsonb("linked_control_ids").$type<string[]>(),
    linkedFrameworkCodes: jsonb("linked_framework_codes").$type<string[]>(),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      referenceId?: string // Document reference code (e.g., "SS-ORG-01")
      effectiveDate?: string
      expiryDate?: string
      department?: string
      confidentiality?: "public" | "internal" | "confidential" | "restricted"
      ownerRole?: string // Owner's role/title
      approvedBy?: { name?: string; role?: string } // Approval info
      [key: string]: unknown
    }>(),
    
    // Audit fields
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_docs_documents_org").on(table.orgId),
    index("idx_docs_documents_slug").on(table.slug),
    index("idx_docs_documents_status").on(table.status),
    index("idx_docs_documents_category").on(table.category),
    index("idx_docs_documents_owner").on(table.ownerId),
    index("idx_docs_documents_next_review").on(table.nextReviewAt),
  ]
)

// ============================================================================
// DOCUMENT VERSIONS
// ============================================================================

/**
 * Document versions - tracks version history
 */
export const documentVersions = pgTable(
  "docs_document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    
    // Version identification
    version: text("version").notNull(), // e.g., "1.0", "1.1", "2.0"
    
    // Change tracking
    changeDescription: text("change_description"),
    changeSummary: text("change_summary"), // Brief summary of what changed
    
    // Approval workflow
    approvedById: uuid("approved_by_id").references(() => persons.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    
    // File reference (optional - for historical snapshots)
    contentSnapshot: text("content_snapshot"), // MDX content at this version
    
    // Audit fields
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_docs_versions_document").on(table.documentId),
    index("idx_docs_versions_version").on(table.version),
    index("idx_docs_versions_created").on(table.createdAt),
  ]
)

// ============================================================================
// DOCUMENT ROLLOUTS
// ============================================================================

/**
 * Document rollouts - defines who needs to read/acknowledge documents
 */
export const documentRollouts = pgTable(
  "docs_document_rollouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    
    // Rollout name (defaults to "Rollout - dd/mm/yy" if not provided)
    name: text("name"),
    
    // Version snapshot - captures document state at rollout time
    versionAtRollout: text("version_at_rollout"), // e.g., "1.0", "2.0"
    contentSnapshot: text("content_snapshot"), // MDX content at rollout time
    
    // Target definition
    targetType: text("target_type", { enum: rolloutTargetTypeValues }).notNull(),
    targetId: uuid("target_id"), // team_id, role_id, or user_id (null for org-wide)
    
    // Requirement level
    requirement: text("requirement", { enum: rolloutRequirementValues }).notNull().default("optional"),
    
    // Deadline
    dueDate: date("due_date"),
    
    // Rollout status
    isActive: boolean("is_active").notNull().default(true),
    
    // Notification settings
    sendNotification: boolean("send_notification").notNull().default(true),
    reminderFrequencyDays: integer("reminder_frequency_days"),
    
    // Audit fields
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_docs_rollouts_document").on(table.documentId),
    index("idx_docs_rollouts_target_type").on(table.targetType),
    index("idx_docs_rollouts_target_id").on(table.targetId),
    index("idx_docs_rollouts_active").on(table.isActive),
    index("idx_docs_rollouts_due_date").on(table.dueDate),
  ]
)

// ============================================================================
// DOCUMENT ACKNOWLEDGMENTS
// ============================================================================

/**
 * Document acknowledgments - tracks user reading/signing
 */
export const documentAcknowledgments = pgTable(
  "docs_document_acknowledgments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    rolloutId: uuid("rollout_id").references(() => documentRollouts.id, { onDelete: "set null" }),
    
    // User who acknowledged
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Acknowledgment tracking
    status: text("status", { enum: acknowledgmentStatusValues }).notNull().default("pending"),
    
    // Version acknowledged
    versionAcknowledged: text("version_acknowledged"),
    
    // Timestamps
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    
    // Signature data (if required)
    signatureData: jsonb("signature_data").$type<{
      method: "checkbox" | "typed" | "drawn"
      value?: string
      ipAddress?: string
      userAgent?: string
    }>(),
    
    // Notes
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_docs_acks_document").on(table.documentId),
    index("idx_docs_acks_rollout").on(table.rolloutId),
    index("idx_docs_acks_user").on(table.userId),
    index("idx_docs_acks_person").on(table.personId),
    index("idx_docs_acks_status").on(table.status),
  ]
)

// ============================================================================
// DOCUMENT SETTINGS (per organization)
// ============================================================================

/**
 * Document module settings
 */
export const documentSettings = pgTable(
  "docs_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }).unique(),
    
    // Default settings for new documents
    defaultReviewFrequencyDays: integer("default_review_frequency_days").default(365),
    defaultRequirement: text("default_requirement", { enum: rolloutRequirementValues }).default("optional"),
    
    // Notification settings
    enableEmailNotifications: boolean("enable_email_notifications").notNull().default(true),
    reminderDaysBefore: integer("reminder_days_before").default(7),
    
    // Branding
    headerLogoUrl: text("header_logo_url"),
    footerText: text("footer_text"),
    
    // Additional settings
    settings: jsonb("settings").$type<{
      requireApprovalForPublish?: boolean
      enableVersionSnapshots?: boolean
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_docs_settings_org").on(table.orgId),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const documentsRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [documents.orgId],
    references: [organizations.id],
  }),
  owner: one(persons, {
    fields: [documents.ownerId],
    references: [persons.id],
  }),
  createdBy: one(users, {
    fields: [documents.createdById],
    references: [users.id],
  }),
  versions: many(documentVersions),
  rollouts: many(documentRollouts),
  acknowledgments: many(documentAcknowledgments),
}))

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  approvedBy: one(persons, {
    fields: [documentVersions.approvedById],
    references: [persons.id],
  }),
  createdBy: one(users, {
    fields: [documentVersions.createdById],
    references: [users.id],
  }),
}))

export const documentRolloutsRelations = relations(documentRollouts, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentRollouts.documentId],
    references: [documents.id],
  }),
  // Note: targetId can reference teams, roles, or users depending on targetType
  // We'll handle this in queries rather than with direct relations
  createdBy: one(users, {
    fields: [documentRollouts.createdById],
    references: [users.id],
  }),
  acknowledgments: many(documentAcknowledgments),
}))

export const documentAcknowledgmentsRelations = relations(documentAcknowledgments, ({ one }) => ({
  document: one(documents, {
    fields: [documentAcknowledgments.documentId],
    references: [documents.id],
  }),
  rollout: one(documentRollouts, {
    fields: [documentAcknowledgments.rolloutId],
    references: [documentRollouts.id],
  }),
  user: one(users, {
    fields: [documentAcknowledgments.userId],
    references: [users.id],
  }),
  person: one(persons, {
    fields: [documentAcknowledgments.personId],
    references: [persons.id],
  }),
}))

export const documentSettingsRelations = relations(documentSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [documentSettings.orgId],
    references: [organizations.id],
  }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

export type DocumentVersion = typeof documentVersions.$inferSelect
export type NewDocumentVersion = typeof documentVersions.$inferInsert

export type DocumentRollout = typeof documentRollouts.$inferSelect
export type NewDocumentRollout = typeof documentRollouts.$inferInsert

export type DocumentAcknowledgment = typeof documentAcknowledgments.$inferSelect
export type NewDocumentAcknowledgment = typeof documentAcknowledgments.$inferInsert

export type DocumentSettings = typeof documentSettings.$inferSelect
export type NewDocumentSettings = typeof documentSettings.$inferInsert

