/**
 * Integrations Schema
 * Stores integration configurations securely
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"
import { organizations } from "./organizations"

// Integration provider types
export const integrationProviderValues = ["entra", "google", "okta", "slack"] as const
export type IntegrationProvider = (typeof integrationProviderValues)[number]

// Integration status types
export const integrationStatusValues = ["connected", "disconnected", "pending", "error"] as const
export type IntegrationStatus = (typeof integrationStatusValues)[number]

/**
 * Integrations table - stores all integration configurations
 */
export const integrations = pgTable("core_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  // Integration type
  provider: text("provider").notNull().$type<IntegrationProvider>(),
  
  // Status
  status: text("status").notNull().default("disconnected").$type<IntegrationStatus>(),
  
  // Provider-specific configuration (encrypted in production)
  tenantId: text("tenant_id"),
  clientId: text("client_id"),
  clientSecretEncrypted: text("client_secret_encrypted"), // Store encrypted
  
  // SCIM configuration
  scimEnabled: boolean("scim_enabled").notNull().default(false),
  scimEndpoint: text("scim_endpoint"),
  scimTokenEncrypted: text("scim_token_encrypted"), // Store encrypted
  
  // SCIM Group provisioning settings
  // Groups with this prefix will be mapped to roles (e.g., "IdaraOS-Admin" -> "admin" role)
  scimGroupPrefix: text("scim_group_prefix"),
  // Allow bidirectional sync (app can update Entra groups)
  scimBidirectionalSync: boolean("scim_bidirectional_sync").notNull().default(false),
  
  // People Directory sync settings
  // When enabled, creates Person records in the People Directory when syncing users
  syncPeopleEnabled: boolean("sync_people_enabled").notNull().default(false),
  // When enabled, deletes Person records when their linked User is deleted
  deletePeopleOnUserDelete: boolean("delete_people_on_user_delete").notNull().default(true),
  
  // Device/Asset sync settings (Microsoft Intune)
  // When enabled, syncs devices from Microsoft Intune to the Assets module
  syncDevicesEnabled: boolean("sync_devices_enabled").notNull().default(false),
  // When enabled, deletes Asset records when devices are removed from Intune
  deleteAssetsOnDeviceDelete: boolean("delete_assets_on_device_delete").notNull().default(false),
  // Last device sync timestamp
  lastDeviceSyncAt: timestamp("last_device_sync_at", { withTimezone: true }),
  // Count of synced devices
  syncedDeviceCount: text("synced_device_count").default("0"),
  
  // SSO configuration
  ssoEnabled: boolean("sso_enabled").notNull().default(false),
  passwordAuthDisabled: boolean("password_auth_disabled").notNull().default(false),
  
  // Sync stats
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncedUserCount: text("synced_user_count").default("0"),
  syncedGroupCount: text("synced_group_count").default("0"),
  
  // Additional provider-specific settings
  settings: jsonb("settings").default({}),
  
  // Error tracking
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

// Type exports for use in API
export type Integration = typeof integrations.$inferSelect
export type NewIntegration = typeof integrations.$inferInsert

