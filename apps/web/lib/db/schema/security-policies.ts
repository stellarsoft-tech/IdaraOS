/**
 * Security Policies Schema - Drizzle ORM table definitions
 *
 * Device groups and the policies applied to them, enforced by the IdaraOS Agent (SYSTEM).
 * - A group holds agent devices and/or members (users). A device is subject to a group's
 *   policies if it is a direct member, or if its signed-in member is a member of the group.
 * - A policy is one reviewed, bounded setting (e.g. block USB storage). The server sends the
 *   agent only a policy TYPE key + bounded settings from an allowlist (lib/security/device-policies.ts),
 *   never a command - the same safety model as device actions.
 * - The agent applies the effective desired state at each check-in and reports what it applied,
 *   recorded per device in security_device_policy_state.
 *
 * The policy `type` columns are plain text, so adding a new policy type needs no migration.
 * See docs/modules/security/elevation-architecture.md
 */

import { pgTable, uuid, text, timestamp, index, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"
import { softwareUpdateDevices } from "./security-software"

// ============================================================================
// GROUPS
// ============================================================================

export const policyGroups = pgTable(
  "security_policy_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_policy_groups_org_name").on(table.orgId, table.name),
  ]
)

// ============================================================================
// GROUP MEMBERS (a row references exactly one of device / user)
// ============================================================================

export const policyGroupMembers = pgTable(
  "security_policy_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull().references(() => policyGroups.id, { onDelete: "cascade" }),
    // Exactly one of these is set (enforced in code). A device membership targets that device;
    // a user membership targets every agent device linked to that user.
    deviceId: uuid("device_id").references(() => softwareUpdateDevices.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_policy_group_members_group").on(table.groupId),
    index("idx_security_policy_group_members_device").on(table.deviceId),
    index("idx_security_policy_group_members_user").on(table.userId),
    // NULLs are distinct in Postgres, so each kind is unique per group without a partial index
    uniqueIndex("idx_security_policy_group_members_group_device").on(table.groupId, table.deviceId),
    uniqueIndex("idx_security_policy_group_members_group_user").on(table.groupId, table.userId),
  ]
)

// ============================================================================
// POLICIES (one per type, per group)
// ============================================================================

export const policies = pgTable(
  "security_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull().references(() => policyGroups.id, { onDelete: "cascade" }),
    // Allowlisted type key, e.g. "usb-storage-block" (lib/security/device-policies.ts). Plain text.
    type: text("type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    // Bounded, policy-specific settings validated against the allowlist
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_policies_group").on(table.groupId),
    uniqueIndex("idx_security_policies_group_type").on(table.groupId, table.type),
  ]
)

// ============================================================================
// PER-DEVICE APPLIED STATE (what the agent last reported applying)
// ============================================================================

export const devicePolicyState = pgTable(
  "security_device_policy_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => softwareUpdateDevices.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    // Whether the agent applied the desired state successfully at its last report
    ok: boolean("ok").notNull().default(true),
    message: text("message"),
    // What the agent reports it applied, e.g. { blocked: true }
    state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_device_policy_state_device").on(table.deviceId),
    uniqueIndex("idx_security_device_policy_state_device_type").on(table.deviceId, table.type),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const policyGroupsRelations = relations(policyGroups, ({ many }) => ({
  members: many(policyGroupMembers),
  policies: many(policies),
}))

export const policyGroupMembersRelations = relations(policyGroupMembers, ({ one }) => ({
  group: one(policyGroups, { fields: [policyGroupMembers.groupId], references: [policyGroups.id] }),
  device: one(softwareUpdateDevices, { fields: [policyGroupMembers.deviceId], references: [softwareUpdateDevices.id] }),
  user: one(users, { fields: [policyGroupMembers.userId], references: [users.id] }),
}))

export const policiesRelations = relations(policies, ({ one }) => ({
  group: one(policyGroups, { fields: [policies.groupId], references: [policyGroups.id] }),
}))

export const devicePolicyStateRelations = relations(devicePolicyState, ({ one }) => ({
  device: one(softwareUpdateDevices, { fields: [devicePolicyState.deviceId], references: [softwareUpdateDevices.id] }),
}))

// ============================================================================
// TYPES
// ============================================================================

export type PolicyGroup = typeof policyGroups.$inferSelect
export type PolicyGroupMember = typeof policyGroupMembers.$inferSelect
export type Policy = typeof policies.$inferSelect
export type DevicePolicyState = typeof devicePolicyState.$inferSelect
