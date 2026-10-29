/**
 * Security Software Schema - Drizzle ORM table definitions
 * Approved software and how it reaches Windows devices without local admin rights:
 * - Approved software catalog: apps users can request (installed by Intune as SYSTEM via an install group)
 * - Installs: one per approved app_install grant, tracked until Intune reports the app installed
 * - Software updates: the IdaraOS Updater (scheduled task, SYSTEM) runs `winget upgrade` for catalog apps
 *   and reports a per-device log of every run, including failures
 *
 * See docs/modules/security/elevation-architecture.md
 */

import { pgTable, uuid, text, timestamp, index, integer, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"
import { assets } from "./assets"
import { elevationGrants } from "./security-elevation"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * How users get a catalog app
 * - approval: requested in My Admin Access, approved, then installed by Intune
 * - self_service: offered in Company Portal, no request needed
 * - managed: installed by IT on every device (listed for information)
 */
export const softwareAccessValues = ["approval", "self_service", "managed"] as const
export type SoftwareAccess = (typeof softwareAccessValues)[number]

/**
 * How a catalog app stays up to date
 * - winget: the IdaraOS Updater runs `winget upgrade` as SYSTEM
 * - self: the app's own SYSTEM update service (Chrome, Microsoft 365 Apps)
 * - windows_update: Microsoft Update (SQL Server)
 * - manual: IT uploads new versions in Intune (supersedence)
 */
export const softwareUpdateMethodValues = ["winget", "self", "windows_update", "manual"] as const
export type SoftwareUpdateMethod = (typeof softwareUpdateMethodValues)[number]

/**
 * Install status for an approved app_install grant
 * - pending: approved, device not yet added to the install group (or adding failed - see error)
 * - assigned: device is in the install group; waiting for Intune to install
 * - installed: Intune (or the updater) reports the app installed
 * - failed: the install deadline passed without an install
 * - cancelled: revoked before the install happened
 */
export const softwareInstallStatusValues = ["pending", "assigned", "installed", "failed", "cancelled"] as const
export type SoftwareInstallStatus = (typeof softwareInstallStatusValues)[number]

export const softwareUpdateDeviceStatusValues = ["active", "revoked"] as const
export type SoftwareUpdateDeviceStatus = (typeof softwareUpdateDeviceStatusValues)[number]

export const softwareUpdateTriggerValues = ["scheduled", "manual"] as const
export type SoftwareUpdateTrigger = (typeof softwareUpdateTriggerValues)[number]

/**
 * Update run status
 * - running: dispatched to the device, waiting for its report
 * - succeeded: every package is up to date (or not installed)
 * - partial: some packages updated or up to date, some failed
 * - failed: nothing could be updated, or the device never reported back
 */
export const softwareUpdateRunStatusValues = ["running", "succeeded", "partial", "failed"] as const
export type SoftwareUpdateRunStatus = (typeof softwareUpdateRunStatusValues)[number]

/**
 * Per-package outcome reported by the updater
 */
export const softwareUpdateOutcomeValues = ["updated", "up_to_date", "not_installed", "failed"] as const
export type SoftwareUpdateOutcome = (typeof softwareUpdateOutcomeValues)[number]

export interface SoftwareUpdatePackageResult {
  wingetId: string
  name?: string
  outcome: SoftwareUpdateOutcome
  fromVersion?: string | null
  toVersion?: string | null
  exitCode?: number | null
  rebootRequired?: boolean
  message?: string | null
}

// ============================================================================
// CATALOG
// ============================================================================

/**
 * Approved software catalog
 */
export const softwareCatalog = pgTable(
  "security_software_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    publisher: text("publisher"),
    description: text("description"),
    // Shown to IT: packaging tips, known admin pitfalls
    notes: text("notes"),

    access: text("access", { enum: softwareAccessValues }).notNull().default("approval"),
    enabled: boolean("enabled").notNull().default(true),

    // Updates
    wingetId: text("winget_id"),
    updateMethod: text("update_method", { enum: softwareUpdateMethodValues }).notNull().default("winget"),
    // Include in the IdaraOS Updater's package list
    autoUpdate: boolean("auto_update").notNull().default(true),

    // Intune: the app and the device group it is Required-assigned to
    intuneAppId: text("intune_app_id"),
    intuneAppName: text("intune_app_name"),
    installGroupId: text("install_group_id"),
    installGroupName: text("install_group_name"),
    removeFromGroupAfterInstall: boolean("remove_from_group_after_install").notNull().default(false),
    installDeadlineHours: integer("install_deadline_hours").notNull().default(24),

    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_software_catalog_org").on(table.orgId),
    uniqueIndex("idx_security_software_catalog_org_name").on(table.orgId, table.name),
  ]
)

// ============================================================================
// INSTALLS
// ============================================================================

/**
 * Intune install for an approved app_install grant
 */
export const softwareInstalls = pgTable(
  "security_software_installs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    grantId: uuid("grant_id").notNull().references(() => elevationGrants.id, { onDelete: "cascade" }),
    catalogAppId: uuid("catalog_app_id").references(() => softwareCatalog.id, { onDelete: "set null" }),

    // Snapshot from the catalog at approval time
    appName: text("app_name").notNull(),
    wingetId: text("winget_id"),
    intuneAppId: text("intune_app_id"),
    groupId: text("group_id").notNull(),
    removeFromGroupAfterInstall: boolean("remove_from_group_after_install").notNull().default(false),

    // Device
    entraDeviceId: text("entra_device_id").notNull(),
    intuneDeviceId: text("intune_device_id"),
    // Entra directory object ID (what group membership needs)
    deviceObjectId: text("device_object_id"),

    status: text("status", { enum: softwareInstallStatusValues }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    groupAddedAt: timestamp("group_added_at", { withTimezone: true }),
    syncRequestedAt: timestamp("sync_requested_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastIntuneState: text("last_intune_state"),
    installedAt: timestamp("installed_at", { withTimezone: true }),
    groupRemovedAt: timestamp("group_removed_at", { withTimezone: true }),
    error: text("error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_software_installs_org").on(table.orgId),
    index("idx_security_software_installs_status").on(table.status),
    uniqueIndex("idx_security_software_installs_grant").on(table.grantId),
  ]
)

// ============================================================================
// SOFTWARE UPDATES
// ============================================================================

/**
 * Per-organization updater settings: schedule and the device enrollment token
 */
export const softwareUpdateSettings = pgTable(
  "security_software_update_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),

    scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
    // 0 = Sunday ... 6 = Saturday
    scheduleDays: jsonb("schedule_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
    // "HH:mm" in scheduleTimezone
    scheduleTime: text("schedule_time").notNull().default("12:00"),
    scheduleTimezone: text("schedule_timezone").notNull().default("UTC"),
    // How often devices check in for run requests
    checkInMinutes: integer("check_in_minutes").notNull().default(15),

    // Enrollment token (only the hash is kept; the token is shown once)
    enrollmentTokenHash: text("enrollment_token_hash"),
    enrollmentTokenHint: text("enrollment_token_hint"),
    enrollmentTokenCreatedAt: timestamp("enrollment_token_created_at", { withTimezone: true }),

    // The recommended apps are added once per organization
    catalogSeededAt: timestamp("catalog_seeded_at", { withTimezone: true }),

    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_software_update_settings_org").on(table.orgId),
    uniqueIndex("idx_security_software_update_settings_token").on(table.enrollmentTokenHash),
  ]
)

/**
 * Devices running the IdaraOS Updater
 */
export const softwareUpdateDevices = pgTable(
  "security_software_update_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),

    entraDeviceId: text("entra_device_id").notNull(),
    intuneDeviceId: text("intune_device_id"),
    hostname: text("hostname").notNull(),
    serialNumber: text("serial_number"),
    osVersion: text("os_version"),
    updaterVersion: text("updater_version"),
    wingetVersion: text("winget_version"),

    // Per-device secret (only the hash is kept)
    secretHash: text("secret_hash").notNull(),
    status: text("status", { enum: softwareUpdateDeviceStatusValues }).notNull().default("active"),

    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: text("last_run_status", { enum: softwareUpdateRunStatusValues }),
    // Error the device hit outside a run (e.g. winget missing, upload failed)
    lastError: text("last_error"),

    // "Run now" request, picked up at the next check-in
    runRequestedAt: timestamp("run_requested_at", { withTimezone: true }),
    runRequestedById: uuid("run_requested_by_id").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_software_update_devices_org").on(table.orgId),
    uniqueIndex("idx_security_software_update_devices_entra").on(table.orgId, table.entraDeviceId),
  ]
)

/**
 * Update runs - the per-device log, kept for failures too
 */
export const softwareUpdateRuns = pgTable(
  "security_software_update_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => softwareUpdateDevices.id, { onDelete: "cascade" }),

    trigger: text("trigger", { enum: softwareUpdateTriggerValues }).notNull(),
    requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: softwareUpdateRunStatusValues }).notNull().default("running"),

    // Package IDs sent to the device for this run
    packages: jsonb("packages").$type<string[]>().notNull().default([]),
    results: jsonb("results").$type<SoftwareUpdatePackageResult[]>().notNull().default([]),
    updatedCount: integer("updated_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    rebootRequired: boolean("reboot_required").notNull().default(false),
    error: text("error"),
    // Tail of the device's winget output for this run
    log: text("log"),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_software_update_runs_org").on(table.orgId),
    index("idx_security_software_update_runs_device").on(table.deviceId, table.startedAt),
    index("idx_security_software_update_runs_status").on(table.status),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const softwareCatalogRelations = relations(softwareCatalog, ({ one }) => ({
  organization: one(organizations, {
    fields: [softwareCatalog.orgId],
    references: [organizations.id],
  }),
}))

export const softwareInstallsRelations = relations(softwareInstalls, ({ one }) => ({
  grant: one(elevationGrants, {
    fields: [softwareInstalls.grantId],
    references: [elevationGrants.id],
  }),
  catalogApp: one(softwareCatalog, {
    fields: [softwareInstalls.catalogAppId],
    references: [softwareCatalog.id],
  }),
}))

export const softwareUpdateDevicesRelations = relations(softwareUpdateDevices, ({ one, many }) => ({
  asset: one(assets, {
    fields: [softwareUpdateDevices.assetId],
    references: [assets.id],
  }),
  runs: many(softwareUpdateRuns),
}))

export const softwareUpdateRunsRelations = relations(softwareUpdateRuns, ({ one }) => ({
  device: one(softwareUpdateDevices, {
    fields: [softwareUpdateRuns.deviceId],
    references: [softwareUpdateDevices.id],
  }),
}))

// ============================================================================
// TYPES
// ============================================================================

export type SoftwareCatalogApp = typeof softwareCatalog.$inferSelect
export type NewSoftwareCatalogApp = typeof softwareCatalog.$inferInsert

export type SoftwareInstall = typeof softwareInstalls.$inferSelect
export type NewSoftwareInstall = typeof softwareInstalls.$inferInsert

export type SoftwareUpdateSettings = typeof softwareUpdateSettings.$inferSelect
export type SoftwareUpdateDevice = typeof softwareUpdateDevices.$inferSelect
export type SoftwareUpdateRun = typeof softwareUpdateRuns.$inferSelect
