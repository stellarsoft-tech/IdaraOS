/**
 * Organizational Roles Schema - Drizzle ORM table definitions
 * Hierarchical organizational roles for org chart structure
 */

import { pgTable, uuid, text, integer, timestamp, index, primaryKey, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { teams } from "./teams"
import { organizationalLevels } from "./org-levels"

/**
 * Organizational Roles table - hierarchical role structure for org chart       
 * Each role can belong to multiple teams via the junction table.
 * The teamId field is kept as the "primary" team for backwards compatibility.
 */
export const organizationalRoles = pgTable(
  "people_organizational_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),

    // Primary team this role belongs to (required, for backwards compatibility)
    // Additional teams are stored in the organizationalRoleTeams junction table
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),

    // Parent role for hierarchy - self-referential FK
    parentRoleId: uuid("parent_role_id").references((): AnyPgColumn => organizationalRoles.id, { onDelete: "set null" }),

    // Level reference - FK to organizational_levels table
    levelId: uuid("level_id").references(() => organizationalLevels.id, { onDelete: "set null" }),

    // Legacy level integer (deprecated, kept for backward compatibility)       
    // Will be auto-calculated from levelId's sortOrder when set
    level: integer("level").notNull().default(0),

    // Sort order for display within same level
    sortOrder: integer("sort_order").notNull().default(0),

    // Canvas position for org chart designer
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_org_roles_org").on(table.orgId),
    index("idx_people_org_roles_team").on(table.teamId),
    index("idx_people_org_roles_parent").on(table.parentRoleId),
    index("idx_people_org_roles_level").on(table.level),
    index("idx_people_org_roles_level_id").on(table.levelId),
  ]
)

/**
 * Organizational Role Teams junction table - many-to-many relationship
 * Allows a role to belong to multiple teams
 */
export const organizationalRoleTeams = pgTable(
  "people_organizational_role_teams",
  {
    roleId: uuid("role_id").notNull().references(() => organizationalRoles.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.teamId] }),
    index("idx_org_role_teams_role").on(table.roleId),
    index("idx_org_role_teams_team").on(table.teamId),
  ]
)

/**
 * Organizational Role relations
 */
export const organizationalRolesRelations = relations(organizationalRoles, ({ one, many }) => ({
  // Team this role belongs to
  team: one(teams, {
    fields: [organizationalRoles.teamId],
    references: [teams.id],
  }),
  // Self-referential: parent role
  parentRole: one(organizationalRoles, {
    fields: [organizationalRoles.parentRoleId],
    references: [organizationalRoles.id],
    relationName: "parentRole",
  }),
  // Self-referential: child roles (direct reports)
  childRoles: many(organizationalRoles, {
    relationName: "parentRole",
  }),
  // Level this role belongs to
  organizationalLevel: one(organizationalLevels, {
    fields: [organizationalRoles.levelId],
    references: [organizationalLevels.id],
  }),
  // Role holders will be accessed via persons.roleId -> organizationalRoles.id
}))

/**
 * Type inference for OrganizationalRole
 */
export type OrganizationalRole = typeof organizationalRoles.$inferSelect
export type NewOrganizationalRole = typeof organizationalRoles.$inferInsert

