/**
 * Storage Schema - Drizzle ORM table definitions
 * Implements file storage integrations and dynamic file categories
 */

import { pgTable, uuid, text, timestamp, boolean, index, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Storage provider types
 */
export const storageProviderValues = ["sharepoint", "azure_blob", "local"] as const
export type StorageProvider = (typeof storageProviderValues)[number]

/**
 * Storage integration status values
 */
export const storageIntegrationStatusValues = ["connected", "disconnected", "error", "pending"] as const
export type StorageIntegrationStatus = (typeof storageIntegrationStatusValues)[number]

/**
 * Module scope values for file categories
 */
export const fileCategoryModuleScopeValues = ["people", "assets", "workflows", "security", "docs", "vendors"] as const
export type FileCategoryModuleScope = (typeof fileCategoryModuleScopeValues)[number]

// ============================================================================
// STORAGE INTEGRATIONS
// ============================================================================

/**
 * Storage Integrations table
 * Configured in Settings > Integrations
 * Stores connection details for SharePoint, Azure Blob, etc.
 */
export const storageIntegrations = pgTable(
  "core_storage_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Integration identification
    provider: text("provider", { enum: storageProviderValues }).notNull(),
    name: text("name").notNull(), // User-friendly name e.g. "HR SharePoint", "Documents Blob"
    description: text("description"),
    
    // Status
    status: text("status", { enum: storageIntegrationStatusValues }).notNull().default("disconnected"),
    
    // SharePoint-specific configuration
    siteUrl: text("site_url"), // e.g. "https://contoso.sharepoint.com/sites/hr"
    siteId: text("site_id"), // SharePoint site ID
    driveId: text("drive_id"), // Document library drive ID
    driveName: text("drive_name"), // Document library name for display
    
    // Azure Blob-specific configuration
    accountName: text("account_name"), // Storage account name
    containerName: text("container_name"), // Blob container name
    connectionStringEncrypted: text("connection_string_encrypted"), // Encrypted connection string
    
    // Common configuration
    basePath: text("base_path"), // Root folder path within the storage
    useEntraAuth: boolean("use_entra_auth").notNull().default(true), // Use existing Entra ID connection
    
    // Connection test
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    
    // Additional settings
    settings: jsonb("settings").$type<{
      maxFileSizeMb?: number
      allowedExtensions?: string[]
      [key: string]: unknown
    }>(),
    
    // Audit
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_storage_integrations_org").on(table.orgId),
    index("idx_storage_integrations_provider").on(table.provider),
    index("idx_storage_integrations_status").on(table.status),
  ]
)

// ============================================================================
// FILE CATEGORIES
// ============================================================================

/**
 * File Categories table
 * Dynamic categories created per module in Filing module
 * Each category can be linked to a storage integration
 */
export const fileCategories = pgTable(
  "core_file_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Category identification
    name: text("name").notNull(), // e.g. "CV/Resume", "Employment Contract"
    slug: text("slug").notNull(), // e.g. "cv", "employment_contract"
    description: text("description"),
    icon: text("icon"), // Lucide icon name e.g. "FileText", "FileCheck"
    color: text("color"), // Badge/accent color e.g. "blue", "green"
    
    // Module scope - which module this category belongs to
    moduleScope: text("module_scope", { enum: fileCategoryModuleScopeValues }).notNull(),
    
    // Storage configuration - links to storage integration
    storageIntegrationId: uuid("storage_integration_id").references(() => storageIntegrations.id, { onDelete: "set null" }),
    folderPath: text("folder_path"), // Sub-folder within the storage integration
    
    // File restrictions
    isRequired: boolean("is_required").notNull().default(false), // e.g. CV required for employees
    maxFileSize: integer("max_file_size"), // in bytes, null = use integration default
    allowedMimeTypes: jsonb("allowed_mime_types").$type<string[]>(), // null = all types allowed
    
    // Display
    sortOrder: integer("sort_order").notNull().default(0),
    
    // Status
    isActive: boolean("is_active").notNull().default(true),
    isSystemCategory: boolean("is_system_category").notNull().default(false), // Seeded categories
    
    // Audit
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_file_categories_org").on(table.orgId),
    index("idx_file_categories_module").on(table.moduleScope),
    index("idx_file_categories_storage").on(table.storageIntegrationId),
    uniqueIndex("idx_file_categories_org_module_slug").on(table.orgId, table.moduleScope, table.slug),
  ]
)

// ============================================================================
// FILES
// ============================================================================

/**
 * Files table
 * Tracks all uploaded files across the system
 */
export const files = pgTable(
  "core_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Category link (determines storage location)
    categoryId: uuid("category_id").references(() => fileCategories.id, { onDelete: "set null" }),
    
    // File metadata
    name: text("name").notNull(), // Display name (may be renamed)
    originalName: text("original_name").notNull(), // Original uploaded filename
    mimeType: text("mime_type"),
    size: integer("size"), // File size in bytes
    
    // Storage location
    storageIntegrationId: uuid("storage_integration_id").references(() => storageIntegrations.id, { onDelete: "set null" }),
    storagePath: text("storage_path").notNull(), // Full path in storage
    externalId: text("external_id"), // SharePoint item ID, Blob name, etc.
    
    // Entity context - what this file is attached to
    entityType: text("entity_type"), // person, asset, workflow_task, etc.
    entityId: uuid("entity_id"),
    
    // Additional context
    moduleScope: text("module_scope", { enum: fileCategoryModuleScopeValues }), // Denormalized for queries
    
    // File status
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: uuid("deleted_by_id").references(() => users.id, { onDelete: "set null" }),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      description?: string
      tags?: string[]
      version?: string
      checksum?: string
      thumbnailUrl?: string
      [key: string]: unknown
    }>(),
    
    // Audit
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_files_org").on(table.orgId),
    index("idx_files_category").on(table.categoryId),
    index("idx_files_storage").on(table.storageIntegrationId),
    index("idx_files_entity").on(table.entityType, table.entityId),
    index("idx_files_module").on(table.moduleScope),
    index("idx_files_uploaded_by").on(table.uploadedById),
    index("idx_files_created_at").on(table.createdAt),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const storageIntegrationsRelations = relations(storageIntegrations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [storageIntegrations.orgId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [storageIntegrations.createdById],
    references: [users.id],
  }),
  categories: many(fileCategories),
  files: many(files),
}))

export const fileCategoriesRelations = relations(fileCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [fileCategories.orgId],
    references: [organizations.id],
  }),
  storageIntegration: one(storageIntegrations, {
    fields: [fileCategories.storageIntegrationId],
    references: [storageIntegrations.id],
  }),
  createdBy: one(users, {
    fields: [fileCategories.createdById],
    references: [users.id],
  }),
  files: many(files),
}))

export const filesRelations = relations(files, ({ one }) => ({
  organization: one(organizations, {
    fields: [files.orgId],
    references: [organizations.id],
  }),
  category: one(fileCategories, {
    fields: [files.categoryId],
    references: [fileCategories.id],
  }),
  storageIntegration: one(storageIntegrations, {
    fields: [files.storageIntegrationId],
    references: [storageIntegrations.id],
  }),
  uploadedBy: one(users, {
    fields: [files.uploadedById],
    references: [users.id],
    relationName: "uploadedBy",
  }),
  deletedBy: one(users, {
    fields: [files.deletedById],
    references: [users.id],
    relationName: "deletedBy",
  }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type StorageIntegration = typeof storageIntegrations.$inferSelect
export type NewStorageIntegration = typeof storageIntegrations.$inferInsert

export type FileCategory = typeof fileCategories.$inferSelect
export type NewFileCategory = typeof fileCategories.$inferInsert

export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert
