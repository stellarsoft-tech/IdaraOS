/**
 * Security Schema - Drizzle ORM table definitions
 * Implements a multi-tier security compliance module with:
 * - Generic foundation layer (risks, controls, evidence, audits)
 * - Framework-specific tracking (ISO 27001, SOC 2, etc.)
 * - Statement of Applicability (SoA) support
 * - Unified control mapping across frameworks
 */

import { pgTable, uuid, text, timestamp, boolean, index, date, integer, jsonb } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { persons } from "./people"
import { users } from "./users"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Framework status values
 */
export const frameworkStatusValues = ["planned", "implementing", "certified", "expired"] as const
export type FrameworkStatus = (typeof frameworkStatusValues)[number]

/**
 * Control status values - operational status
 */
export const controlStatusValues = ["active", "inactive", "under_review"] as const
export type ControlStatus = (typeof controlStatusValues)[number]

/**
 * Control implementation status values
 */
export const controlImplementationStatusValues = ["not_implemented", "partially_implemented", "implemented", "effective"] as const
export type ControlImplementationStatus = (typeof controlImplementationStatusValues)[number]

/**
 * Risk likelihood values
 */
export const riskLikelihoodValues = ["very_low", "low", "medium", "high", "very_high"] as const
export type RiskLikelihood = (typeof riskLikelihoodValues)[number]

/**
 * Risk impact values
 */
export const riskImpactValues = ["negligible", "minor", "moderate", "major", "severe"] as const
export type RiskImpact = (typeof riskImpactValues)[number]

/**
 * Risk level values (calculated from likelihood x impact)
 */
export const riskLevelValues = ["low", "medium", "high", "critical"] as const
export type RiskLevel = (typeof riskLevelValues)[number]

/**
 * Risk status values
 */
export const riskStatusValues = ["identified", "assessing", "treating", "monitoring", "closed"] as const
export type RiskStatus = (typeof riskStatusValues)[number]

/**
 * Risk treatment values
 */
export const riskTreatmentValues = ["avoid", "transfer", "mitigate", "accept"] as const
export type RiskTreatment = (typeof riskTreatmentValues)[number]

/**
 * Risk category values
 */
export const riskCategoryValues = ["operational", "compliance", "strategic", "financial", "reputational", "technical"] as const
export type RiskCategory = (typeof riskCategoryValues)[number]

/**
 * Evidence type values
 */
export const evidenceTypeValues = ["document", "screenshot", "log", "report", "attestation", "configuration", "other"] as const
export type EvidenceType = (typeof evidenceTypeValues)[number]

/**
 * Evidence status values
 */
export const evidenceStatusValues = ["current", "expired", "pending_review"] as const
export type EvidenceStatus = (typeof evidenceStatusValues)[number]

/**
 * SoA applicability values
 */
export const soaApplicabilityValues = ["applicable", "not_applicable", "partially_applicable"] as const
export type SoaApplicability = (typeof soaApplicabilityValues)[number]

/**
 * Audit type values
 */
export const auditTypeValues = ["internal", "external", "surveillance", "certification", "recertification"] as const
export type AuditType = (typeof auditTypeValues)[number]

/**
 * Audit status values
 */
export const auditStatusValues = ["planned", "in_progress", "completed", "cancelled"] as const
export type AuditStatus = (typeof auditStatusValues)[number]

/**
 * Finding severity values
 */
export const findingSeverityValues = ["observation", "minor", "major", "critical"] as const
export type FindingSeverity = (typeof findingSeverityValues)[number]

/**
 * Finding status values
 */
export const findingStatusValues = ["open", "in_progress", "resolved", "verified", "closed"] as const
export type FindingStatus = (typeof findingStatusValues)[number]

/**
 * Objective status values
 */
export const objectiveStatusValues = ["not_started", "in_progress", "completed", "on_hold", "cancelled"] as const
export type ObjectiveStatus = (typeof objectiveStatusValues)[number]

/**
 * Objective priority values
 */
export const objectivePriorityValues = ["low", "medium", "high", "critical"] as const
export type ObjectivePriority = (typeof objectivePriorityValues)[number]

/**
 * Control type values
 * Types of security controls based on their function
 */
export const controlTypeValues = ["preventive", "detective", "corrective", "deterrent", "compensating"] as const
export type ControlType = (typeof controlTypeValues)[number]

/**
 * Control category values
 * Categories for organizing security controls
 */
export const controlCategoryValues = ["organizational", "people", "physical", "technological", "administrative"] as const
export type ControlCategory = (typeof controlCategoryValues)[number]

// ============================================================================
// FRAMEWORKS
// ============================================================================

/**
 * Security Frameworks table
 * Tracks which compliance frameworks the organization is pursuing
 */
export const securityFrameworks = pgTable(
  "security_frameworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Framework identification
    code: text("code").notNull(), // e.g., "iso-27001", "soc-2"
    name: text("name").notNull(), // e.g., "ISO/IEC 27001:2022"
    version: text("version"), // e.g., "2022"
    description: text("description"),
    
    // Status tracking
    status: text("status", { enum: frameworkStatusValues }).notNull().default("planned"),
    
    // Certification details
    certifiedAt: timestamp("certified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    certificationBody: text("certification_body"),
    certificateNumber: text("certificate_number"),
    
    // Scope
    scope: text("scope"),
    
    // Settings
    settings: jsonb("settings").$type<{
      autoGapAnalysis?: boolean
      requireEvidenceForSoa?: boolean
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_frameworks_org").on(table.orgId),
    index("idx_security_frameworks_code").on(table.code),
    index("idx_security_frameworks_status").on(table.status),
  ]
)

// ============================================================================
// STANDARD CONTROLS (Reference Library)
// ============================================================================

/**
 * Standard Controls table
 * Pre-loaded reference controls from each framework (e.g., ISO 27001 Annex A)
 * These are the "official" controls that orgs map their implementations to
 */
export const securityStandardControls = pgTable(
  "security_standard_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Framework reference (null for shared/global controls)
    frameworkCode: text("framework_code").notNull(), // e.g., "iso-27001", "soc-2"
    
    // Control identification
    controlId: text("control_id").notNull(), // e.g., "A.5.1", "CC1.1"
    
    // Hierarchy
    category: text("category").notNull(), // e.g., "Organizational", "People"
    subcategory: text("subcategory"), // e.g., "Policies for information security"
    
    // Control details
    title: text("title").notNull(),
    description: text("description"),
    guidance: text("guidance"), // Implementation guidance
    
    // Attributes
    isRequired: boolean("is_required").notNull().default(true),
    
    // Control attributes (for filtering/grouping)
    controlType: text("control_type"), // e.g., "preventive", "detective", "corrective"
    securityProperties: jsonb("security_properties").$type<string[]>(), // CIA triad
    
    // Ordering
    sortOrder: integer("sort_order").notNull().default(0),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_standard_controls_framework").on(table.frameworkCode),
    index("idx_security_standard_controls_category").on(table.category),
    index("idx_security_standard_controls_control_id").on(table.controlId),
  ]
)

// ============================================================================
// ORGANIZATION CONTROLS
// ============================================================================

/**
 * Security Controls table
 * Organization's implemented controls (unified, framework-agnostic)
 */
export const securityControls = pgTable(
  "security_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Control identification
    controlId: text("control_id").notNull(), // Org's internal ID, e.g., "CTL-001"
    title: text("title").notNull(),
    description: text("description"),
    
    // Ownership
    ownerId: uuid("owner_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Status
    status: text("status", { enum: controlStatusValues }).notNull().default("active"),
    implementationStatus: text("implementation_status", { enum: controlImplementationStatusValues }).notNull().default("not_implemented"),
    
    // Implementation details
    implementationNotes: text("implementation_notes"),
    implementedAt: timestamp("implemented_at", { withTimezone: true }),
    
    // Review schedule
    lastTestedAt: date("last_tested_at"),
    nextReviewAt: date("next_review_at"),
    reviewFrequencyDays: integer("review_frequency_days"),
    
    // Control attributes
    controlType: text("control_type"), // e.g., "preventive", "detective", "corrective"
    category: text("category"), // Internal categorization
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      testingProcedure?: string
      automationLevel?: "manual" | "semi-automated" | "automated"
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_controls_org").on(table.orgId),
    index("idx_security_controls_control_id").on(table.controlId),
    index("idx_security_controls_status").on(table.status),
    index("idx_security_controls_owner").on(table.ownerId),
    index("idx_security_controls_implementation_status").on(table.implementationStatus),
  ]
)

// ============================================================================
// CONTROL MAPPINGS
// ============================================================================

/**
 * Control Mappings table
 * Links org controls to standard framework controls (many-to-many)
 */
export const securityControlMappings = pgTable(
  "security_control_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // References
    controlId: uuid("control_id").notNull().references(() => securityControls.id, { onDelete: "cascade" }),
    standardControlId: uuid("standard_control_id").notNull().references(() => securityStandardControls.id, { onDelete: "cascade" }),
    
    // Mapping details
    coverageLevel: text("coverage_level"), // "full", "partial"
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_control_mappings_org").on(table.orgId),
    index("idx_security_control_mappings_control").on(table.controlId),
    index("idx_security_control_mappings_standard").on(table.standardControlId),
  ]
)

// ============================================================================
// RISKS
// ============================================================================

/**
 * Security Risks table
 * Risk register with likelihood/impact scoring
 */
export const securityRisks = pgTable(
  "security_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Risk identification
    riskId: text("risk_id").notNull(), // e.g., "RSK-001"
    title: text("title").notNull(),
    description: text("description"),
    
    // Categorization
    category: text("category", { enum: riskCategoryValues }).notNull().default("operational"),
    
    // Ownership
    ownerId: uuid("owner_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Inherent risk assessment (before controls)
    inherentLikelihood: text("inherent_likelihood", { enum: riskLikelihoodValues }).notNull().default("medium"),
    inherentImpact: text("inherent_impact", { enum: riskImpactValues }).notNull().default("moderate"),
    inherentLevel: text("inherent_level", { enum: riskLevelValues }).notNull().default("medium"),
    
    // Residual risk assessment (after controls)
    residualLikelihood: text("residual_likelihood", { enum: riskLikelihoodValues }),
    residualImpact: text("residual_impact", { enum: riskImpactValues }),
    residualLevel: text("residual_level", { enum: riskLevelValues }),
    
    // Status and treatment
    status: text("status", { enum: riskStatusValues }).notNull().default("identified"),
    treatment: text("treatment", { enum: riskTreatmentValues }),
    treatmentPlan: text("treatment_plan"),
    treatmentDueDate: date("treatment_due_date"),
    
    // Asset/context affected
    affectedAssets: text("affected_assets"),
    
    // Review
    lastReviewedAt: date("last_reviewed_at"),
    nextReviewAt: date("next_review_at"),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      threats?: string[]
      vulnerabilities?: string[]
      consequences?: string[]
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_risks_org").on(table.orgId),
    index("idx_security_risks_risk_id").on(table.riskId),
    index("idx_security_risks_category").on(table.category),
    index("idx_security_risks_status").on(table.status),
    index("idx_security_risks_owner").on(table.ownerId),
    index("idx_security_risks_inherent_level").on(table.inherentLevel),
    index("idx_security_risks_residual_level").on(table.residualLevel),
  ]
)

// ============================================================================
// RISK-CONTROL MAPPINGS
// ============================================================================

/**
 * Risk Controls junction table
 * Links risks to their mitigating controls
 */
export const securityRiskControls = pgTable(
  "security_risk_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id").notNull().references(() => securityRisks.id, { onDelete: "cascade" }),
    controlId: uuid("control_id").notNull().references(() => securityControls.id, { onDelete: "cascade" }),
    
    // How effective is this control for this risk
    effectiveness: text("effectiveness"), // "high", "medium", "low"
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_risk_controls_risk").on(table.riskId),
    index("idx_security_risk_controls_control").on(table.controlId),
  ]
)

// ============================================================================
// EVIDENCE
// ============================================================================

/**
 * Security Evidence table
 * Central repository for compliance artifacts
 */
export const securityEvidence = pgTable(
  "security_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Evidence identification
    title: text("title").notNull(),
    description: text("description"),
    
    // Type and status
    type: text("type", { enum: evidenceTypeValues }).notNull().default("document"),
    status: text("status", { enum: evidenceStatusValues }).notNull().default("current"),
    
    // File/location
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    
    // External reference (if evidence is a link to external system)
    externalUrl: text("external_url"),
    externalSystem: text("external_system"), // e.g., "Jira", "Confluence"
    
    // Validity
    collectedAt: date("collected_at").notNull(),
    validUntil: date("valid_until"),
    
    // Audit trail
    collectedById: uuid("collected_by_id").references(() => users.id, { onDelete: "set null" }),
    
    // Tags for organization
    tags: jsonb("tags").$type<string[]>(),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      version?: string
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_evidence_org").on(table.orgId),
    index("idx_security_evidence_type").on(table.type),
    index("idx_security_evidence_status").on(table.status),
    index("idx_security_evidence_collected_at").on(table.collectedAt),
    index("idx_security_evidence_valid_until").on(table.validUntil),
  ]
)

// ============================================================================
// EVIDENCE-CONTROL LINKS
// ============================================================================

/**
 * Evidence Links junction table
 * Links evidence to controls they support
 */
export const securityEvidenceLinks = pgTable(
  "security_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evidenceId: uuid("evidence_id").notNull().references(() => securityEvidence.id, { onDelete: "cascade" }),
    controlId: uuid("control_id").notNull().references(() => securityControls.id, { onDelete: "cascade" }),
    
    // Link details
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_evidence_links_evidence").on(table.evidenceId),
    index("idx_security_evidence_links_control").on(table.controlId),
  ]
)

// ============================================================================
// STATEMENT OF APPLICABILITY (SoA)
// ============================================================================

/**
 * SoA Items table
 * Statement of Applicability line items per framework
 */
export const securitySoaItems = pgTable(
  "security_soa_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkId: uuid("framework_id").notNull().references(() => securityFrameworks.id, { onDelete: "cascade" }),
    standardControlId: uuid("standard_control_id").notNull().references(() => securityStandardControls.id, { onDelete: "cascade" }),
    
    // Link to org's implementing control (optional)
    controlId: uuid("control_id").references(() => securityControls.id, { onDelete: "set null" }),
    
    // Applicability
    applicability: text("applicability", { enum: soaApplicabilityValues }).notNull().default("applicable"),
    justification: text("justification"), // Required if not applicable
    
    // Implementation status (for this framework specifically)
    implementationStatus: text("implementation_status", { enum: controlImplementationStatusValues }).notNull().default("not_implemented"),
    
    // Notes
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_soa_items_framework").on(table.frameworkId),
    index("idx_security_soa_items_standard_control").on(table.standardControlId),
    index("idx_security_soa_items_control").on(table.controlId),
    index("idx_security_soa_items_applicability").on(table.applicability),
    index("idx_security_soa_items_implementation_status").on(table.implementationStatus),
  ]
)

// ============================================================================
// AUDITS
// ============================================================================

/**
 * Security Audits table
 * Internal and external audit records
 */
export const securityAudits = pgTable(
  "security_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Optional framework link
    frameworkId: uuid("framework_id").references(() => securityFrameworks.id, { onDelete: "set null" }),
    
    // Audit identification
    auditId: text("audit_id").notNull(), // e.g., "AUD-001"
    title: text("title").notNull(),
    
    // Type and status
    type: text("type", { enum: auditTypeValues }).notNull().default("internal"),
    status: text("status", { enum: auditStatusValues }).notNull().default("planned"),
    
    // Scheduling
    startDate: date("start_date"),
    endDate: date("end_date"),
    
    // Scope and details
    scope: text("scope"),
    objectives: text("objectives"),
    
    // Auditor information
    leadAuditor: text("lead_auditor"),
    auditTeam: jsonb("audit_team").$type<string[]>(),
    auditBody: text("audit_body"), // For external audits
    
    // Results
    summary: text("summary"),
    conclusion: text("conclusion"),
    
    // Metrics (populated after audit)
    findingsCount: integer("findings_count").default(0),
    majorFindingsCount: integer("major_findings_count").default(0),
    minorFindingsCount: integer("minor_findings_count").default(0),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      reportUrl?: string
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_audits_org").on(table.orgId),
    index("idx_security_audits_audit_id").on(table.auditId),
    index("idx_security_audits_framework").on(table.frameworkId),
    index("idx_security_audits_type").on(table.type),
    index("idx_security_audits_status").on(table.status),
    index("idx_security_audits_start_date").on(table.startDate),
  ]
)

// ============================================================================
// AUDIT FINDINGS
// ============================================================================

/**
 * Audit Findings table
 * Findings and NCRs from audits
 */
export const securityAuditFindings = pgTable(
  "security_audit_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id").notNull().references(() => securityAudits.id, { onDelete: "cascade" }),
    
    // Optional control reference
    controlId: uuid("control_id").references(() => securityControls.id, { onDelete: "set null" }),
    
    // Finding identification
    findingId: text("finding_id").notNull(), // e.g., "FND-001"
    title: text("title").notNull(),
    description: text("description"),
    
    // Severity and status
    severity: text("severity", { enum: findingSeverityValues }).notNull().default("minor"),
    status: text("status", { enum: findingStatusValues }).notNull().default("open"),
    
    // Evidence
    evidence: text("evidence"),
    
    // Remediation
    recommendation: text("recommendation"),
    responsiblePersonId: uuid("responsible_person_id").references(() => persons.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    
    // Resolution
    resolution: text("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_audit_findings_audit").on(table.auditId),
    index("idx_security_audit_findings_finding_id").on(table.findingId),
    index("idx_security_audit_findings_control").on(table.controlId),
    index("idx_security_audit_findings_severity").on(table.severity),
    index("idx_security_audit_findings_status").on(table.status),
    index("idx_security_audit_findings_due_date").on(table.dueDate),
  ]
)

// ============================================================================
// OBJECTIVES
// ============================================================================

/**
 * Security Objectives table
 * Security objectives and treatment plans
 */
export const securityObjectives = pgTable(
  "security_objectives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Objective identification
    objectiveId: text("objective_id").notNull(), // e.g., "OBJ-001"
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"), // e.g., security, compliance, operational
    
    // Priority and Status
    priority: text("priority", { enum: objectivePriorityValues }).notNull().default("medium"),
    status: text("status", { enum: objectiveStatusValues }).notNull().default("not_started"),
    
    // Ownership
    ownerId: uuid("owner_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Timeline
    targetDate: date("target_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    
    // Progress
    progress: integer("progress").default(0),
    
    // KPIs/Success criteria
    kpis: jsonb("kpis").$type<string[]>(),
    successCriteria: text("success_criteria"),
    
    // Links
    linkedRiskIds: jsonb("linked_risk_ids").$type<string[]>(),
    linkedControlIds: jsonb("linked_control_ids").$type<string[]>(),
    
    // Notes
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_objectives_org").on(table.orgId),
    index("idx_security_objectives_objective_id").on(table.objectiveId),
    index("idx_security_objectives_status").on(table.status),
    index("idx_security_objectives_priority").on(table.priority),
    index("idx_security_objectives_owner").on(table.ownerId),
    index("idx_security_objectives_target_date").on(table.targetDate),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const securityFrameworksRelations = relations(securityFrameworks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [securityFrameworks.orgId],
    references: [organizations.id],
  }),
  soaItems: many(securitySoaItems),
  audits: many(securityAudits),
}))

export const securityStandardControlsRelations = relations(securityStandardControls, ({ many }) => ({
  mappings: many(securityControlMappings),
  soaItems: many(securitySoaItems),
}))

export const securityControlsRelations = relations(securityControls, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [securityControls.orgId],
    references: [organizations.id],
  }),
  owner: one(persons, {
    fields: [securityControls.ownerId],
    references: [persons.id],
  }),
  mappings: many(securityControlMappings),
  riskControls: many(securityRiskControls),
  evidenceLinks: many(securityEvidenceLinks),
  soaItems: many(securitySoaItems),
  auditFindings: many(securityAuditFindings),
}))

export const securityControlMappingsRelations = relations(securityControlMappings, ({ one }) => ({
  organization: one(organizations, {
    fields: [securityControlMappings.orgId],
    references: [organizations.id],
  }),
  control: one(securityControls, {
    fields: [securityControlMappings.controlId],
    references: [securityControls.id],
  }),
  standardControl: one(securityStandardControls, {
    fields: [securityControlMappings.standardControlId],
    references: [securityStandardControls.id],
  }),
}))

export const securityRisksRelations = relations(securityRisks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [securityRisks.orgId],
    references: [organizations.id],
  }),
  owner: one(persons, {
    fields: [securityRisks.ownerId],
    references: [persons.id],
  }),
  riskControls: many(securityRiskControls),
}))

export const securityRiskControlsRelations = relations(securityRiskControls, ({ one }) => ({
  risk: one(securityRisks, {
    fields: [securityRiskControls.riskId],
    references: [securityRisks.id],
  }),
  control: one(securityControls, {
    fields: [securityRiskControls.controlId],
    references: [securityControls.id],
  }),
}))

export const securityEvidenceRelations = relations(securityEvidence, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [securityEvidence.orgId],
    references: [organizations.id],
  }),
  collectedBy: one(users, {
    fields: [securityEvidence.collectedById],
    references: [users.id],
  }),
  evidenceLinks: many(securityEvidenceLinks),
}))

export const securityEvidenceLinksRelations = relations(securityEvidenceLinks, ({ one }) => ({
  evidence: one(securityEvidence, {
    fields: [securityEvidenceLinks.evidenceId],
    references: [securityEvidence.id],
  }),
  control: one(securityControls, {
    fields: [securityEvidenceLinks.controlId],
    references: [securityControls.id],
  }),
}))

export const securitySoaItemsRelations = relations(securitySoaItems, ({ one }) => ({
  framework: one(securityFrameworks, {
    fields: [securitySoaItems.frameworkId],
    references: [securityFrameworks.id],
  }),
  standardControl: one(securityStandardControls, {
    fields: [securitySoaItems.standardControlId],
    references: [securityStandardControls.id],
  }),
  control: one(securityControls, {
    fields: [securitySoaItems.controlId],
    references: [securityControls.id],
  }),
}))

export const securityAuditsRelations = relations(securityAudits, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [securityAudits.orgId],
    references: [organizations.id],
  }),
  framework: one(securityFrameworks, {
    fields: [securityAudits.frameworkId],
    references: [securityFrameworks.id],
  }),
  findings: many(securityAuditFindings),
}))

export const securityAuditFindingsRelations = relations(securityAuditFindings, ({ one }) => ({
  audit: one(securityAudits, {
    fields: [securityAuditFindings.auditId],
    references: [securityAudits.id],
  }),
  control: one(securityControls, {
    fields: [securityAuditFindings.controlId],
    references: [securityControls.id],
  }),
  responsiblePerson: one(persons, {
    fields: [securityAuditFindings.responsiblePersonId],
    references: [persons.id],
  }),
}))

export const securityObjectivesRelations = relations(securityObjectives, ({ one }) => ({
  organization: one(organizations, {
    fields: [securityObjectives.orgId],
    references: [organizations.id],
  }),
  owner: one(persons, {
    fields: [securityObjectives.ownerId],
    references: [persons.id],
  }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SecurityFramework = typeof securityFrameworks.$inferSelect
export type NewSecurityFramework = typeof securityFrameworks.$inferInsert

export type SecurityStandardControl = typeof securityStandardControls.$inferSelect
export type NewSecurityStandardControl = typeof securityStandardControls.$inferInsert

export type SecurityControl = typeof securityControls.$inferSelect
export type NewSecurityControl = typeof securityControls.$inferInsert

export type SecurityControlMapping = typeof securityControlMappings.$inferSelect
export type NewSecurityControlMapping = typeof securityControlMappings.$inferInsert

export type SecurityRisk = typeof securityRisks.$inferSelect
export type NewSecurityRisk = typeof securityRisks.$inferInsert

export type SecurityRiskControl = typeof securityRiskControls.$inferSelect
export type NewSecurityRiskControl = typeof securityRiskControls.$inferInsert

export type SecurityEvidence = typeof securityEvidence.$inferSelect
export type NewSecurityEvidence = typeof securityEvidence.$inferInsert

export type SecurityEvidenceLink = typeof securityEvidenceLinks.$inferSelect
export type NewSecurityEvidenceLink = typeof securityEvidenceLinks.$inferInsert

export type SecuritySoaItem = typeof securitySoaItems.$inferSelect
export type NewSecuritySoaItem = typeof securitySoaItems.$inferInsert

export type SecurityAudit = typeof securityAudits.$inferSelect
export type NewSecurityAudit = typeof securityAudits.$inferInsert

export type SecurityAuditFinding = typeof securityAuditFindings.$inferSelect
export type NewSecurityAuditFinding = typeof securityAuditFindings.$inferInsert

export type SecurityObjective = typeof securityObjectives.$inferSelect
export type NewSecurityObjective = typeof securityObjectives.$inferInsert

// ============================================================================
// ISMS CLAUSE TRACKING (ISO 27001 Clauses 4-10)
// ============================================================================

/**
 * Clause compliance status values
 */
export const clauseComplianceStatusValues = ["not_addressed", "partially_addressed", "fully_addressed", "verified"] as const
export type ClauseComplianceStatus = (typeof clauseComplianceStatusValues)[number]

/**
 * Standard Clauses - Reference data for ISMS requirements
 * These are the mandatory management system requirements (Clauses 4-10)
 * Stored separately from Annex A controls as they have different characteristics
 */
export const securityStandardClauses = pgTable(
  "security_standard_clauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Framework identification
    frameworkCode: text("framework_code").notNull(), // "iso-27001"
    
    // Clause identification
    clauseId: text("clause_id").notNull(), // "4.1", "5.2", "6.1.2", etc.
    parentClauseId: text("parent_clause_id"), // For hierarchy (6.1.1 -> 6.1 -> 6)
    
    // Content
    title: text("title").notNull(),
    description: text("description"),
    guidance: text("guidance"), // Implementation guidance
    evidenceExamples: text("evidence_examples"), // What evidence auditors expect
    
    // Categorization
    category: text("category"), // "Context", "Leadership", "Planning", etc.
    
    // Display
    sortOrder: integer("sort_order").default(0),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_standard_clauses_framework").on(table.frameworkCode),
    index("idx_standard_clauses_clause_id").on(table.clauseId),
    index("idx_standard_clauses_parent").on(table.parentClauseId),
  ]
)

/**
 * Clause Compliance - Organization's compliance status per clause
 * Tracks implementation progress for each ISMS requirement
 */
export const securityClauseCompliance = pgTable(
  "security_clause_compliance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    frameworkId: uuid("framework_id").notNull().references(() => securityFrameworks.id, { onDelete: "cascade" }),
    standardClauseId: uuid("standard_clause_id").notNull().references(() => securityStandardClauses.id, { onDelete: "cascade" }),
    
    // Compliance tracking
    complianceStatus: text("compliance_status", { enum: clauseComplianceStatusValues }).notNull().default("not_addressed"),
    
    // Ownership
    ownerId: uuid("owner_id").references(() => persons.id, { onDelete: "set null" }),
    targetDate: date("target_date"),
    
    // Implementation details
    implementationNotes: text("implementation_notes"),
    evidenceDescription: text("evidence_description"),
    linkedEvidenceIds: jsonb("linked_evidence_ids").$type<string[]>(),
    linkedDocumentIds: jsonb("linked_document_ids").$type<string[]>(),
    
    // Review tracking
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    lastReviewedById: uuid("last_reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_clause_compliance_org").on(table.orgId),
    index("idx_clause_compliance_framework").on(table.frameworkId),
    index("idx_clause_compliance_clause").on(table.standardClauseId),
    index("idx_clause_compliance_status").on(table.complianceStatus),
    index("idx_clause_compliance_owner").on(table.ownerId),
  ]
)

// Relations for clause tables
export const securityStandardClausesRelations = relations(securityStandardClauses, ({ many }) => ({
  complianceRecords: many(securityClauseCompliance),
}))

export const securityClauseComplianceRelations = relations(securityClauseCompliance, ({ one }) => ({
  organization: one(organizations, {
    fields: [securityClauseCompliance.orgId],
    references: [organizations.id],
  }),
  framework: one(securityFrameworks, {
    fields: [securityClauseCompliance.frameworkId],
    references: [securityFrameworks.id],
  }),
  standardClause: one(securityStandardClauses, {
    fields: [securityClauseCompliance.standardClauseId],
    references: [securityStandardClauses.id],
  }),
  owner: one(persons, {
    fields: [securityClauseCompliance.ownerId],
    references: [persons.id],
  }),
  lastReviewedBy: one(users, {
    fields: [securityClauseCompliance.lastReviewedById],
    references: [users.id],
  }),
}))

// Type exports for clause tables
export type SecurityStandardClause = typeof securityStandardClauses.$inferSelect
export type NewSecurityStandardClause = typeof securityStandardClauses.$inferInsert

export type SecurityClauseCompliance = typeof securityClauseCompliance.$inferSelect
export type NewSecurityClauseCompliance = typeof securityClauseCompliance.$inferInsert

