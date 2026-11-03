/**
 * Security Agent Schema - Drizzle ORM table definitions
 * The IdaraOS Agent provider (an alternative to Intune for approved installs):
 * - Pairings: the member signs in to the agent with their IdaraOS account using a short code
 *   (device-code style), which enrolls the device and links it to them
 * - Jobs: work for one device, picked up at check-in (install an approved catalog app)
 *
 * Devices are security_software_update_devices (see security-software.ts).
 * See docs/modules/security/elevation-architecture.md
 */

import { pgTable, uuid, text, timestamp, index, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"
import { softwareInstalls, softwareUpdateDevices } from "./security-software"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Pairing status
 * - pending: the agent is showing the code, waiting for the member to enter it
 * - approved: a signed-in member entered the code; the agent collects its device secret next poll
 * - completed: the agent collected its secret (the device is enrolled)
 * - expired: not approved in time
 */
export const agentPairingStatusValues = ["pending", "approved", "completed", "expired"] as const
export type AgentPairingStatus = (typeof agentPairingStatusValues)[number]

// "install": run an approved winget install. "action": run one allowlisted device action
// (see lib/security/device-actions.ts). The `type` column is plain text, so adding a value
// here needs no migration.
export const agentJobTypeValues = ["install", "action"] as const
export type AgentJobType = (typeof agentJobTypeValues)[number]

/**
 * Job status
 * - pending: waiting for the device's next check-in
 * - sent: handed to the device, waiting for its result (re-sent if it never reports)
 * - succeeded / failed: the device reported a result, or it ran out of attempts
 * - cancelled: no longer needed (grant revoked)
 */
export const agentJobStatusValues = ["pending", "sent", "succeeded", "failed", "cancelled"] as const
export type AgentJobStatus = (typeof agentJobStatusValues)[number]

// ============================================================================
// PAIRINGS
// ============================================================================

export const agentPairings = pgTable(
  "security_agent_pairings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short code the member types in IdaraOS (e.g. "KFJD-7QWX")
    userCode: text("user_code").notNull(),
    // Secret the agent polls with (only the hash is kept)
    deviceCodeHash: text("device_code_hash").notNull(),

    // What the agent reported when it asked for a code
    hostname: text("hostname").notNull(),
    machineId: text("machine_id").notNull(),
    serialNumber: text("serial_number"),

    status: text("status", { enum: agentPairingStatusValues }).notNull().default("pending"),
    // Set when a member approves the code
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => softwareUpdateDevices.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_agent_pairings_device_code").on(table.deviceCodeHash),
    index("idx_security_agent_pairings_user_code").on(table.userCode, table.status),
  ]
)

// ============================================================================
// JOBS
// ============================================================================

export interface AgentJobResult {
  exitCode?: number | null
  rebootRequired?: boolean
  message?: string | null
}

export const agentJobs = pgTable(
  "security_agent_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => softwareUpdateDevices.id, { onDelete: "cascade" }),

    type: text("type", { enum: agentJobTypeValues }).notNull(),
    status: text("status", { enum: agentJobStatusValues }).notNull().default("pending"),
    installId: uuid("install_id").references(() => softwareInstalls.id, { onDelete: "cascade" }),
    // Parameters sent to the device (e.g. { wingetId, name })
    payload: jsonb("payload").$type<Record<string, string>>().notNull().default({}),

    attempts: integer("attempts").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    result: jsonb("result").$type<AgentJobResult>(),
    error: text("error"),
    // Tail of the agent's output
    log: text("log"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_agent_jobs_device").on(table.deviceId, table.status),
    index("idx_security_agent_jobs_org").on(table.orgId),
    index("idx_security_agent_jobs_install").on(table.installId),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const agentPairingsRelations = relations(agentPairings, ({ one }) => ({
  user: one(users, {
    fields: [agentPairings.userId],
    references: [users.id],
  }),
  device: one(softwareUpdateDevices, {
    fields: [agentPairings.deviceId],
    references: [softwareUpdateDevices.id],
  }),
}))

export const agentJobsRelations = relations(agentJobs, ({ one }) => ({
  device: one(softwareUpdateDevices, {
    fields: [agentJobs.deviceId],
    references: [softwareUpdateDevices.id],
  }),
  install: one(softwareInstalls, {
    fields: [agentJobs.installId],
    references: [softwareInstalls.id],
  }),
}))

// ============================================================================
// TYPES
// ============================================================================

export type AgentPairing = typeof agentPairings.$inferSelect
export type AgentJob = typeof agentJobs.$inferSelect
