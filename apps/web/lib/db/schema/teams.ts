/**
 * Teams Schema - Drizzle ORM table definitions
 * Hierarchical team structure for organizing people
 */

import { pgTable, uuid, text, integer, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

/**
 * Teams table - hierarchical team structure
 * Note: leadId references persons table - using deferred reference via AnyPgColumn to avoid circular imports
 */
export const teams = pgTable(
  "people_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    
    // Team lead - FK to persons (deferred, no direct import to avoid circular deps)
    leadId: uuid("lead_id"),
    
    // Parent team for hierarchy - self-referential FK
    parentTeamId: uuid("parent_team_id").references((): AnyPgColumn => teams.id, { onDelete: "set null" }),
    
    // Sort order for display
    sortOrder: integer("sort_order").notNull().default(0),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_teams_org").on(table.orgId),
    index("idx_people_teams_parent").on(table.parentTeamId),
    index("idx_people_teams_lead").on(table.leadId),
  ]
)

/**
 * Team relations
 * Note: lead and members relations are defined in people.ts to avoid circular imports
 */
export const teamsRelations = relations(teams, ({ one, many }) => ({
  // Self-referential: parent team
  parentTeam: one(teams, {
    fields: [teams.parentTeamId],
    references: [teams.id],
    relationName: "parentTeam",
  }),
  // Self-referential: child teams
  childTeams: many(teams, {
    relationName: "parentTeam",
  }),
  // Note: lead relation and members relation defined via join queries
  // to avoid circular import issues with persons table
}))

/**
 * Type inference for Team
 */
export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert

