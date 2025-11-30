/**
 * Users Schema - Drizzle ORM table definitions
 */

import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { persons } from "./people"

/**
 * User role enum values - matches RBAC types
 */
export const userRoleValues = ["Owner", "Admin", "HR", "Security", "Auditor", "User"] as const
export type UserRole = (typeof userRoleValues)[number]

/**
 * User status enum values
 */
export const userStatusValues = ["active", "invited", "suspended", "deactivated"] as const
export type UserStatus = (typeof userStatusValues)[number]

/**
 * Users table - system users with authentication
 */
export const users = pgTable(
  "core_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"), // null for invited users who haven't set password
    name: text("name").notNull(),
    avatar: text("avatar"),
    role: text("role", { enum: userRoleValues }).notNull().default("User"),
    status: text("status", { enum: userStatusValues }).notNull().default("invited"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_core_users_org").on(table.orgId),
    index("idx_core_users_email").on(table.email),
    index("idx_core_users_role").on(table.role),
    index("idx_core_users_status").on(table.status),
  ]
)

/**
 * User relations
 * Note: userRoles relation is defined in rbac.ts to avoid circular imports
 */
export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  person: one(persons, {
    fields: [users.personId],
    references: [persons.id],
  }),
}))

/**
 * Type inference for User
 */
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

