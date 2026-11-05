/**
 * Security Endpoint Elevation Schema - Drizzle ORM table definitions
 * Just-in-time local admin access for Windows devices:
 * - Employees request admin access for one of their devices
 * - Approvers grant it for a limited time
 * - Credentials mode: the device's local admin password is revealed to the requester, then rotated
 *   when the grant ends
 * - App install mode: an approved catalog app is installed (see security-software.ts)
 *
 * Each organization picks a device provider:
 * - intune: Windows LAPS in Entra and Intune installs; admin passwords live in Entra, never stored here
 * - agent: the IdaraOS Agent installs approved apps with winget (see security-agent.ts); no Intune needed.
 *   For the agent provider, the managed local admin password IS stored here (deviceAdminCredentials),
 *   encrypted at rest (lib/encryption.ts), because there is no Entra LAPS to hold it.
 * See docs/modules/security/elevation-architecture.md
 */

import { pgTable, uuid, text, timestamp, index, integer, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"
import { assets } from "./assets"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Request status values
 * - pending: waiting for an approver
 * - approved: a grant was created (see security_elevation_grants)
 * - denied: rejected by an approver
 * - cancelled: withdrawn by the requester before a decision
 */
export const elevationRequestStatusValues = ["pending", "approved", "denied", "cancelled"] as const
export type ElevationRequestStatus = (typeof elevationRequestStatusValues)[number]

/**
 * Grant mode values
 * - credentials: the LAPS password is revealed to the requester
 * - app_install: Intune installs an approved catalog app (see security_software_installs)
 */
export const elevationGrantModeValues = ["credentials", "app_install"] as const
export type ElevationGrantMode = (typeof elevationGrantModeValues)[number]

/**
 * Grant status values
 * - active: credentials usable / install in progress
 * - expired: the window passed (credentials) or the install deadline passed without an install
 * - revoked: ended early by an approver
 * - completed: app_install only - Intune reported the app installed
 */
export const elevationGrantStatusValues = ["active", "expired", "revoked", "completed"] as const
export type ElevationGrantStatus = (typeof elevationGrantStatusValues)[number]

/**
 * LAPS password rotation status for a credentials grant
 * - not_required: the password was never revealed, so nothing to rotate
 * - pending: the grant ended after a reveal; rotation not requested yet
 * - requested: Intune rotateLocalAdminPassword was called; waiting for a newer LAPS backup
 * - verified: Entra shows a LAPS backup newer than the last reveal
 * - failed: rotation could not be requested (see rotationError); retried by the sweep
 */
export const elevationRotationStatusValues = ["not_required", "pending", "requested", "verified", "failed"] as const
export type ElevationRotationStatus = (typeof elevationRotationStatusValues)[number]

/**
 * Where approved installs come from
 * - intune: Intune Win32 apps via install groups (credentials grants use Windows LAPS in Entra)
 * - agent: the IdaraOS Agent runs winget as SYSTEM (no Intune or Entra join needed)
 */
export const elevationDeviceProviderValues = ["intune", "agent"] as const
export type ElevationDeviceProvider = (typeof elevationDeviceProviderValues)[number]

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Per-organization elevation settings
 */
export const elevationSettings = pgTable(
  "security_elevation_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),

    // Durations (minutes) a requester can choose from
    durationOptions: jsonb("duration_options").$type<number[]>().notNull().default([15, 30, 60, 120, 240]),
    // Hard cap for any grant
    maxMinutes: integer("max_minutes").notNull().default(240),

    requireReason: boolean("require_reason").notNull().default(true),
    credentialModeEnabled: boolean("credential_mode_enabled").notNull().default(true),

    // Reveal requires a fresh Microsoft sign-in within this many minutes
    requireRecentAuth: boolean("require_recent_auth").notNull().default(true),
    recentAuthMinutes: integer("recent_auth_minutes").notNull().default(15),
    maxRevealsPerGrant: integer("max_reveals_per_grant").notNull().default(5),

    // Teams Workflows webhook for new-request notifications (encrypted)
    teamsWebhookUrlEncrypted: text("teams_webhook_url_encrypted"),

    // Device provider - see elevationDeviceProviderValues
    deviceProvider: text("device_provider", { enum: elevationDeviceProviderValues }).notNull().default("intune"),

    // Agent provider: let the IdaraOS Agent manage the device's local admin password (rotate it to a
    // unique value, escrow it, and allow credentials requests for agent devices). Off by default.
    manageAgentAdmin: boolean("manage_agent_admin").notNull().default(false),
    // The pre-existing local admin account the agent rotates. The agent never creates this account.
    agentAdminAccount: text("agent_admin_account").notNull().default("StellarAdmin"),

    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_elevation_settings_org").on(table.orgId),
  ]
)

// ============================================================================
// REQUESTS
// ============================================================================

/**
 * Elevation requests - one per ask from an employee
 * Device identifiers are copied from the asset at request time so the grant keeps working
 * even if the asset is later re-synced or deleted.
 */
export const elevationRequests = pgTable(
  "security_elevation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    // Device
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    deviceName: text("device_name").notNull(),
    // Intune provider
    entraDeviceId: text("entra_device_id"),
    intuneDeviceId: text("intune_device_id"),
    // Agent provider (FK to security_software_update_devices in SQL; not declared here to avoid a
    // circular schema import)
    agentDeviceId: uuid("agent_device_id"),

    // Approved software catalog entry for install requests (FK to security_software_catalog in SQL;
    // not declared here to avoid a circular schema import)
    catalogAppId: uuid("catalog_app_id"),
    // What the requester needs admin for (free text for credentials requests, snapshot for installs)
    app: jsonb("app").$type<{
      name: string
      publisher?: string
      version?: string
    }>(),

    // Credentials requests only - installs have no duration
    requestedMinutes: integer("requested_minutes"),
    reason: text("reason"),

    status: text("status", { enum: elevationRequestStatusValues }).notNull().default("pending"),
    decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_elevation_requests_org").on(table.orgId),
    index("idx_security_elevation_requests_requester").on(table.requesterId),
    index("idx_security_elevation_requests_status").on(table.status),
    index("idx_security_elevation_requests_catalog_app").on(table.catalogAppId),
    index("idx_security_elevation_requests_agent_device").on(table.agentDeviceId),
  ]
)

// ============================================================================
// GRANTS
// ============================================================================

/**
 * Elevation grants - the time-boxed access created when a request is approved
 */
export const elevationGrants = pgTable(
  "security_elevation_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull().references(() => elevationRequests.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "set null" }),

    mode: text("mode", { enum: elevationGrantModeValues }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    // Credentials: end of the access window. App installs: install deadline
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    status: text("status", { enum: elevationGrantStatusValues }).notNull().default("active"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason"),
    revokedById: uuid("revoked_by_id").references(() => users.id, { onDelete: "set null" }),

    // Credentials mode - reveal tracking (the password itself is never stored)
    firstRevealedAt: timestamp("first_revealed_at", { withTimezone: true }),
    lastRevealedAt: timestamp("last_revealed_at", { withTimezone: true }),
    revealCount: integer("reveal_count").notNull().default(0),

    // Credentials mode - LAPS rotation after the grant ends
    rotationStatus: text("rotation_status", { enum: elevationRotationStatusValues }).notNull().default("not_required"),
    rotationAttempts: integer("rotation_attempts").notNull().default(0),
    rotationRequestedAt: timestamp("rotation_requested_at", { withTimezone: true }),
    rotationVerifiedAt: timestamp("rotation_verified_at", { withTimezone: true }),
    rotationError: text("rotation_error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_elevation_grants_org").on(table.orgId),
    index("idx_security_elevation_grants_user").on(table.userId),
    index("idx_security_elevation_grants_status").on(table.status),
    index("idx_security_elevation_grants_rotation").on(table.rotationStatus),
    uniqueIndex("idx_security_elevation_grants_request").on(table.requestId),
  ]
)

// ============================================================================
// AGENT-MANAGED ADMIN CREDENTIALS (escrow)
// ============================================================================

/**
 * The local admin password the IdaraOS Agent manages for one device (agent provider).
 *
 * The agent generates a unique password on the device, sets it on the pre-existing local admin
 * account (default "StellarAdmin" - never created by the agent), and escrows it here. The password
 * is encrypted at rest (lib/encryption.ts) and only ever handed back through an active credentials
 * grant reveal (audited) or a break-glass admin reveal. One row per device.
 *
 * device_id is an FK to security_software_update_devices in SQL; it is a plain uuid here to avoid a
 * circular schema import (same approach as elevationRequests.agentDeviceId above).
 */
export const deviceAdminCredentials = pgTable(
  "security_device_admin_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull(),

    // The managed local admin account (pre-existing on the device)
    accountName: text("account_name").notNull().default("StellarAdmin"),
    // Current password, encrypted at rest. Null until the agent first reports one.
    passwordEncrypted: text("password_encrypted"),

    // Last report from the agent: "ok" | "missing" (account absent) | "error"
    lastStatus: text("last_status"),
    lastError: text("last_error"),

    // When the agent last set (rotated) the password, when a rotation was asked for, and last report
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    rotateRequestedAt: timestamp("rotate_requested_at", { withTimezone: true }),
    reportedAt: timestamp("reported_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_device_admin_credentials_device").on(table.deviceId),
    index("idx_security_device_admin_credentials_org").on(table.orgId),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const elevationSettingsRelations = relations(elevationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [elevationSettings.orgId],
    references: [organizations.id],
  }),
}))

export const elevationRequestsRelations = relations(elevationRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [elevationRequests.orgId],
    references: [organizations.id],
  }),
  requester: one(users, {
    fields: [elevationRequests.requesterId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [elevationRequests.assetId],
    references: [assets.id],
  }),
  grant: one(elevationGrants, {
    fields: [elevationRequests.id],
    references: [elevationGrants.requestId],
  }),
}))

export const elevationGrantsRelations = relations(elevationGrants, ({ one }) => ({
  organization: one(organizations, {
    fields: [elevationGrants.orgId],
    references: [organizations.id],
  }),
  request: one(elevationRequests, {
    fields: [elevationGrants.requestId],
    references: [elevationRequests.id],
  }),
  user: one(users, {
    fields: [elevationGrants.userId],
    references: [users.id],
  }),
}))

export const deviceAdminCredentialsRelations = relations(deviceAdminCredentials, ({ one }) => ({
  organization: one(organizations, {
    fields: [deviceAdminCredentials.orgId],
    references: [organizations.id],
  }),
}))

// ============================================================================
// TYPES
// ============================================================================

export type ElevationSettings = typeof elevationSettings.$inferSelect
export type NewElevationSettings = typeof elevationSettings.$inferInsert

export type ElevationRequest = typeof elevationRequests.$inferSelect
export type NewElevationRequest = typeof elevationRequests.$inferInsert

export type ElevationGrant = typeof elevationGrants.$inferSelect
export type NewElevationGrant = typeof elevationGrants.$inferInsert

export type DeviceAdminCredential = typeof deviceAdminCredentials.$inferSelect
export type NewDeviceAdminCredential = typeof deviceAdminCredentials.$inferInsert
