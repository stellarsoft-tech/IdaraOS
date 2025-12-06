/**
 * Assets Schema - Drizzle ORM table definitions
 */

import { pgTable, uuid, text, timestamp, boolean, index, date, decimal, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { persons } from "./people"
import { users } from "./users"

/**
 * Asset status enum values
 */
export const assetStatusValues = ["available", "assigned", "maintenance", "retired", "disposed"] as const
export type AssetStatus = (typeof assetStatusValues)[number]

/**
 * Asset source enum values - how the asset record was created
 */
export const assetSourceValues = ["manual", "intune_sync"] as const
export type AssetSource = (typeof assetSourceValues)[number]

/**
 * Maintenance type enum values
 */
export const maintenanceTypeValues = ["scheduled", "repair", "upgrade"] as const
export type MaintenanceType = (typeof maintenanceTypeValues)[number]

/**
 * Maintenance status enum values
 */
export const maintenanceStatusValues = ["scheduled", "in_progress", "completed", "cancelled"] as const
export type MaintenanceStatus = (typeof maintenanceStatusValues)[number]

/**
 * Lifecycle event type enum values
 */
export const lifecycleEventTypeValues = ["acquired", "assigned", "returned", "maintenance", "transferred", "retired", "disposed"] as const
export type LifecycleEventType = (typeof lifecycleEventTypeValues)[number]

/**
 * Asset Categories table - hierarchical categories for assets
 */
export const assetCategories = pgTable(
  "assets_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    parentId: uuid("parent_id").references((): AnyPgColumn => assetCategories.id, { onDelete: "set null" }),
    icon: text("icon").default("Box"), // Lucide icon name
    color: text("color").default("gray"), // Badge color
    defaultDepreciationYears: decimal("default_depreciation_years", { precision: 4, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_categories_org").on(table.orgId),
    index("idx_assets_categories_parent").on(table.parentId),
    index("idx_assets_categories_slug").on(table.slug),
  ]
)

/**
 * Asset Categories relations
 */
export const assetCategoriesRelations = relations(assetCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assetCategories.orgId],
    references: [organizations.id],
  }),
  parent: one(assetCategories, {
    fields: [assetCategories.parentId],
    references: [assetCategories.id],
    relationName: "parentCategory",
  }),
  children: many(assetCategories, { relationName: "parentCategory" }),
  assets: many(assets),
}))

/**
 * Asset Tags table - flexible tagging for assets
 */
export const assetTags = pgTable(
  "assets_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("gray"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_tags_org").on(table.orgId),
  ]
)

/**
 * Asset Tags relations
 */
export const assetTagsRelations = relations(assetTags, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assetTags.orgId],
    references: [organizations.id],
  }),
  assetTags: many(assetAssetTags),
}))

/**
 * Assets table - main asset registry
 */
export const assets = pgTable(
  "assets_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // Basic info
    assetTag: text("asset_tag").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => assetCategories.id, { onDelete: "set null" }),
    status: text("status", { enum: assetStatusValues }).notNull().default("available"),
    
    // Specifications
    serialNumber: text("serial_number"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    
    // Purchase/Financial
    purchaseDate: date("purchase_date"),
    purchaseCost: decimal("purchase_cost", { precision: 12, scale: 2 }),
    warrantyEnd: date("warranty_end"),
    
    // Location
    location: text("location"),
    
    // Assignment
    assignedToId: uuid("assigned_to_id").references(() => persons.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    
    // Sync tracking
    source: text("source", { enum: assetSourceValues }).notNull().default("manual"),
    intuneDeviceId: text("intune_device_id"),
    intuneComplianceState: text("intune_compliance_state"),
    intuneEnrollmentType: text("intune_enrollment_type"),
    intuneLastSyncAt: timestamp("intune_last_sync_at", { withTimezone: true }),
    syncEnabled: boolean("sync_enabled").notNull().default(false),
    
    // Additional data
    notes: text("notes"),
    customFields: jsonb("custom_fields").default({}),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_assets_org").on(table.orgId),
    index("idx_assets_assets_category").on(table.categoryId),
    index("idx_assets_assets_status").on(table.status),
    index("idx_assets_assets_tag").on(table.assetTag),
    index("idx_assets_assets_assigned_to").on(table.assignedToId),
    index("idx_assets_assets_source").on(table.source),
    index("idx_assets_assets_intune_id").on(table.intuneDeviceId),
  ]
)

/**
 * Assets relations
 */
export const assetsRelations = relations(assets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assets.orgId],
    references: [organizations.id],
  }),
  category: one(assetCategories, {
    fields: [assets.categoryId],
    references: [assetCategories.id],
  }),
  assignedTo: one(persons, {
    fields: [assets.assignedToId],
    references: [persons.id],
  }),
  tags: many(assetAssetTags),
  assignments: many(assetAssignments),
  maintenanceRecords: many(assetMaintenanceRecords),
  lifecycleEvents: many(assetLifecycleEvents),
}))

/**
 * Asset-Tag junction table
 */
export const assetAssetTags = pgTable(
  "assets_asset_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => assetTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_asset_tags_asset").on(table.assetId),
    index("idx_assets_asset_tags_tag").on(table.tagId),
  ]
)

/**
 * Asset-Tag relations
 */
export const assetAssetTagsRelations = relations(assetAssetTags, ({ one }) => ({
  asset: one(assets, {
    fields: [assetAssetTags.assetId],
    references: [assets.id],
  }),
  tag: one(assetTags, {
    fields: [assetAssetTags.tagId],
    references: [assetTags.id],
  }),
}))

/**
 * Asset Assignments table - assignment history
 */
export const assetAssignments = pgTable(
  "assets_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    assignedById: uuid("assigned_by_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_assignments_asset").on(table.assetId),
    index("idx_assets_assignments_person").on(table.personId),
    index("idx_assets_assignments_returned").on(table.returnedAt),
  ]
)

/**
 * Asset Assignments relations
 */
export const assetAssignmentsRelations = relations(assetAssignments, ({ one }) => ({
  asset: one(assets, {
    fields: [assetAssignments.assetId],
    references: [assets.id],
  }),
  person: one(persons, {
    fields: [assetAssignments.personId],
    references: [persons.id],
  }),
  assignedBy: one(users, {
    fields: [assetAssignments.assignedById],
    references: [users.id],
  }),
}))

/**
 * Asset Maintenance Records table
 */
export const assetMaintenanceRecords = pgTable(
  "assets_maintenance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    type: text("type", { enum: maintenanceTypeValues }).notNull(),
    status: text("status", { enum: maintenanceStatusValues }).notNull().default("scheduled"),
    description: text("description"),
    scheduledDate: date("scheduled_date"),
    completedDate: date("completed_date"),
    cost: decimal("cost", { precision: 12, scale: 2 }),
    vendor: text("vendor"),
    performedById: uuid("performed_by_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_maintenance_org").on(table.orgId),
    index("idx_assets_maintenance_asset").on(table.assetId),
    index("idx_assets_maintenance_status").on(table.status),
    index("idx_assets_maintenance_type").on(table.type),
  ]
)

/**
 * Asset Maintenance Records relations
 */
export const assetMaintenanceRecordsRelations = relations(assetMaintenanceRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [assetMaintenanceRecords.orgId],
    references: [organizations.id],
  }),
  asset: one(assets, {
    fields: [assetMaintenanceRecords.assetId],
    references: [assets.id],
  }),
  performedBy: one(users, {
    fields: [assetMaintenanceRecords.performedById],
    references: [users.id],
  }),
}))

/**
 * Asset Lifecycle Events table - audit trail of asset changes
 */
export const assetLifecycleEvents = pgTable(
  "assets_lifecycle_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: lifecycleEventTypeValues }).notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull().defaultNow(),
    details: jsonb("details").default({}),
    performedById: uuid("performed_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assets_lifecycle_org").on(table.orgId),
    index("idx_assets_lifecycle_asset").on(table.assetId),
    index("idx_assets_lifecycle_type").on(table.eventType),
    index("idx_assets_lifecycle_date").on(table.eventDate),
  ]
)

/**
 * Asset Lifecycle Events relations
 */
export const assetLifecycleEventsRelations = relations(assetLifecycleEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [assetLifecycleEvents.orgId],
    references: [organizations.id],
  }),
  asset: one(assets, {
    fields: [assetLifecycleEvents.assetId],
    references: [assets.id],
  }),
  performedBy: one(users, {
    fields: [assetLifecycleEvents.performedById],
    references: [users.id],
  }),
}))

/**
 * Type inference for Assets
 */
export type AssetCategory = typeof assetCategories.$inferSelect
export type NewAssetCategory = typeof assetCategories.$inferInsert

export type AssetTag = typeof assetTags.$inferSelect
export type NewAssetTag = typeof assetTags.$inferInsert

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert

export type AssetAssetTag = typeof assetAssetTags.$inferSelect
export type NewAssetAssetTag = typeof assetAssetTags.$inferInsert

export type AssetAssignment = typeof assetAssignments.$inferSelect
export type NewAssetAssignment = typeof assetAssignments.$inferInsert

export type AssetMaintenanceRecord = typeof assetMaintenanceRecords.$inferSelect
export type NewAssetMaintenanceRecord = typeof assetMaintenanceRecords.$inferInsert

export type AssetLifecycleEvent = typeof assetLifecycleEvents.$inferSelect
export type NewAssetLifecycleEvent = typeof assetLifecycleEvents.$inferInsert

