/**
 * SCIM Schema - SCIM Groups and Group Memberships
 * 
 * This implements SCIM group provisioning with role mapping:
 * - scimGroups: Groups provisioned from Azure AD via SCIM
 * - userScimGroups: Junction table tracking user membership in SCIM groups
 * 
 * The system maps Entra groups to application roles using a naming convention:
 * - Groups are named with a prefix (e.g., "IdaraOS-Admin")
 * - The suffix after the prefix maps to the role slug (e.g., "admin")
 */

import { pgTable, uuid, text, timestamp, boolean, index, primaryKey } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"
import { roles } from "./rbac"

/**
 * SCIM Groups table - stores groups provisioned from identity providers
 */
export const scimGroups = pgTable(
  "scim_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // External identifiers
    externalId: text("external_id"), // Azure AD group object ID
    displayName: text("display_name").notNull(),
    
    // Mapped role (derived from group name using prefix convention)
    mappedRoleId: uuid("mapped_role_id").references(() => roles.id, { onDelete: "set null" }),
    
    // Metadata
    memberCount: text("member_count").default("0"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_scim_groups_org").on(table.orgId),
    index("idx_scim_groups_external_id").on(table.externalId),
    index("idx_scim_groups_display_name").on(table.displayName),
  ]
)

/**
 * User SCIM Groups - junction table for user membership in SCIM groups
 * This tracks which users belong to which SCIM-provisioned groups
 */
export const userScimGroups = pgTable(
  "user_scim_groups",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scimGroupId: uuid("scim_group_id").notNull().references(() => scimGroups.id, { onDelete: "cascade" }),
    
    // When the membership was synced
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.scimGroupId] }),
    index("idx_user_scim_groups_user").on(table.userId),
    index("idx_user_scim_groups_group").on(table.scimGroupId),
  ]
)

// ============ Relations ============

export const scimGroupsRelations = relations(scimGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [scimGroups.orgId],
    references: [organizations.id],
  }),
  mappedRole: one(roles, {
    fields: [scimGroups.mappedRoleId],
    references: [roles.id],
  }),
  userScimGroups: many(userScimGroups),
}))

export const userScimGroupsRelations = relations(userScimGroups, ({ one }) => ({
  user: one(users, {
    fields: [userScimGroups.userId],
    references: [users.id],
  }),
  scimGroup: one(scimGroups, {
    fields: [userScimGroups.scimGroupId],
    references: [scimGroups.id],
  }),
}))

// ============ Type Exports ============

export type ScimGroup = typeof scimGroups.$inferSelect
export type NewScimGroup = typeof scimGroups.$inferInsert

export type UserScimGroup = typeof userScimGroups.$inferSelect
export type NewUserScimGroup = typeof userScimGroups.$inferInsert
