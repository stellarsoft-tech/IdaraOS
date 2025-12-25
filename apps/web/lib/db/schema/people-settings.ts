/**
 * People Module Settings Schema
 * Stores People & HR module configuration including Entra sync settings
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"

/**
 * People sync mode - how People records are synced from Entra
 */
export const peopleSyncModeValues = ["linked", "independent"] as const
export type PeopleSyncMode = (typeof peopleSyncModeValues)[number]

/**
 * Property mapping for Entra -> People fields
 * Maps Entra user properties to People record fields
 */
export interface PeoplePropertyMapping {
  // Entra property -> People field
  displayName: string // default: "name"
  mail: string // default: "email"
  jobTitle: string // default: "role"
  department: string // default: "team"
  officeLocation: string // default: "location"
  mobilePhone: string // default: "phone"
  employeeHireDate: string // default: "startDate" (can also be "hireDate")
  employeeLeaveDateTime: string // default: "endDate"
  // Additional Entra properties (stored in DB)
  createdDateTime?: string // default: "entraCreatedAt"
  manager?: string // default: "managerId" (resolved via email/UPN lookup)
  // Note: signInActivity and passwordProfile are fetched real-time from Entra, not stored
}

export const DEFAULT_PROPERTY_MAPPING: PeoplePropertyMapping = {
  displayName: "name",
  mail: "email",
  jobTitle: "role",
  department: "team",
  officeLocation: "location",
  mobilePhone: "phone",
  employeeHireDate: "hireDate",
  employeeLeaveDateTime: "endDate",
  // Additional Entra properties (stored in DB)
  createdDateTime: "entraCreatedAt",
  manager: "managerId",
}

/**
 * People Settings table - stores People module configuration per organization
 */
export const peopleSettings = pgTable("people_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  // ===================
  // Entra Sync Settings
  // ===================
  
  /**
   * Sync mode:
   * - "linked": People are created/updated when users are synced (via core module)
   * - "independent": People are synced separately using peopleGroupPattern
   */
  syncMode: text("sync_mode", { enum: peopleSyncModeValues }).notNull().default("linked"),
  
  /**
   * Group pattern for independent sync mode
   * Can be exact name (e.g., "All-Employees") or prefix pattern (e.g., "Employees-*")
   * Used when syncMode = "independent"
   */
  peopleGroupPattern: text("people_group_pattern"),
  
  /**
   * Property mapping from Entra fields to People fields
   * Stored as JSON, uses DEFAULT_PROPERTY_MAPPING if null
   */
  propertyMapping: jsonb("property_mapping").$type<PeoplePropertyMapping>(),
  
  /**
   * Auto-delete people when removed from Entra groups (independent mode)
   * Only applies when syncMode = "independent"
   */
  autoDeleteOnRemoval: boolean("auto_delete_on_removal").notNull().default(false),
  
  /**
   * Default status for newly synced people
   */
  defaultStatus: text("default_status").notNull().default("active"),
  
  // ===================
  // SCIM Settings (for People module)
  // ===================
  
  /**
   * Enable SCIM provisioning for People module
   * When enabled, SCIM requests will also update People records based on syncMode
   */
  scimEnabled: boolean("scim_enabled").notNull().default(false),
  
  // ===================
  // Sync Stats
  // ===================
  
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncedPeopleCount: text("synced_people_count").default("0"),
  lastSyncError: text("last_sync_error"),
  lastSyncErrorAt: timestamp("last_sync_error_at", { withTimezone: true }),
  
  // ===================
  // Workflow Settings
  // ===================
  
  /**
   * Enable automatic onboarding workflow creation
   * When a person is created or status changes to "onboarding"
   */
  autoOnboardingWorkflow: boolean("auto_onboarding_workflow").notNull().default(false),
  
  /**
   * Default workflow template for onboarding
   */
  defaultOnboardingWorkflowTemplateId: uuid("default_onboarding_workflow_template_id"),
  
  /**
   * Enable automatic offboarding workflow creation
   * When a person's status changes to "offboarding"
   */
  autoOffboardingWorkflow: boolean("auto_offboarding_workflow").notNull().default(false),
  
  /**
   * Default workflow template for offboarding
   */
  defaultOffboardingWorkflowTemplateId: uuid("default_offboarding_workflow_template_id"),
  
  // ===================
  // General Settings
  // ===================
  
  /**
   * Additional settings stored as JSON
   */
  settings: jsonb("settings").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const peopleSettingsRelations = relations(peopleSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [peopleSettings.orgId],
    references: [organizations.id],
  }),
}))

// Type exports
export type PeopleSettings = typeof peopleSettings.$inferSelect
export type NewPeopleSettings = typeof peopleSettings.$inferInsert

