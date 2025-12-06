/**
 * Assets Settings Schema - Module-level configuration for the Assets module
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"
import { organizations } from "./organizations"

/**
 * Device filter options for Intune sync
 */
export interface DeviceFilterConfig {
  osFilter?: string[] // e.g., ["Windows", "macOS", "iOS", "Android"]
  complianceFilter?: string[] // e.g., ["compliant", "noncompliant", "unknown"]
  managementFilter?: string[] // e.g., ["enrolled", "pending"]
}

/**
 * Category mapping configuration for Intune devices
 */
export interface CategoryMappingConfig {
  // Map device OS or type to category ID
  mappings: Array<{
    deviceType: string // e.g., "Windows", "macOS", "iOS", "Android"
    categoryId: string // UUID of the target category
  }>
  defaultCategoryId?: string // Fallback category for unmapped devices
}

/**
 * Sync behavior configuration
 */
export interface SyncBehaviorConfig {
  autoDeleteOnRemoval: boolean // Delete assets when removed from Intune
  autoCreatePeople: boolean // Create Person records for unknown device owners
  updateExistingOnly: boolean // Only update existing assets, don't create new ones
}

/**
 * Full asset sync settings structure stored in JSONB
 */
export interface AssetSyncSettings {
  deviceFilters?: DeviceFilterConfig
  categoryMapping?: CategoryMappingConfig
  syncBehavior?: SyncBehaviorConfig
  fieldMapping?: Record<string, string> // Map Intune properties to asset fields
}

/**
 * Assets Settings table - per-organization configuration
 */
export const assetsSettings = pgTable("assets_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  // General settings
  // Auto-generate asset tags on creation
  autoGenerateTags: boolean("auto_generate_tags").notNull().default(true),
  // Tag prefix for auto-generated tags (e.g., "AST" -> "AST-001")
  tagPrefix: text("tag_prefix").default("AST"),
  // Tag sequence counter
  tagSequence: text("tag_sequence").default("0"),
  // Default status for new assets
  defaultStatus: text("default_status").default("available"),
  
  // Intune sync configuration (stored as JSONB)
  syncSettings: jsonb("sync_settings").$type<AssetSyncSettings>().default({}),
  
  // Sync status tracking
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncedAssetCount: text("synced_asset_count").default("0"),
  lastSyncError: text("last_sync_error"),
  lastSyncErrorAt: timestamp("last_sync_error_at", { withTimezone: true }),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

// Type exports
export type AssetsSettings = typeof assetsSettings.$inferSelect
export type NewAssetsSettings = typeof assetsSettings.$inferInsert

