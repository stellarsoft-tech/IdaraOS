/**
 * Security Endpoint Elevation Schema - Drizzle ORM table definitions
 * Just-in-time local admin access for Windows devices:
 * - Employees request admin access for one of their devices
 * - Approvers grant it for a limited time
 * - Credentials mode: the Windows LAPS password is fetched from Entra and revealed to the requester,
 *   then rotated when the grant ends
 * - App install mode: Intune installs an approved catalog app (see security-software.ts)
 *
 * LAPS passwords are never stored in any table.
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
    entraDeviceId: text("entra_device_id").notNull(),
    intuneDeviceId: text("intune_device_id"),

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

// ============================================================================
// TYPES
// ============================================================================

export type ElevationSettings = typeof elevationSettings.$inferSelect
export type NewElevationSettings = typeof elevationSettings.$inferInsert

export type ElevationRequest = typeof elevationRequests.$inferSelect
export type NewElevationRequest = typeof elevationRequests.$inferInsert

export type ElevationGrant = typeof elevationGrants.$inferSelect
export type NewElevationGrant = typeof elevationGrants.$inferInsert
