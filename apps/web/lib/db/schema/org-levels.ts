/**
 * Organizational Levels Schema - Drizzle ORM table definitions
 * Defines hierarchical levels for organizational roles (e.g., Executive, Director, Manager)
 */

import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

/**
 * Organizational Levels table - defines hierarchical levels for roles
 * Each level has a name, code, and sort order for positioning in the org chart
 */
export const organizationalLevels = pgTable(
  "people_organizational_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    
    // Display name (e.g., "Executive", "Director", "Manager")
    name: text("name").notNull(),
    
    // Short code for display (e.g., "L0", "L1", "L2")
    code: text("code").notNull(),
    
    // Optional description
    description: text("description"),
    
    // Sort order determines vertical positioning in org chart (0 = top)
    sortOrder: integer("sort_order").notNull().default(0),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_org_levels_org").on(table.orgId),
    index("idx_people_org_levels_sort").on(table.sortOrder),
    uniqueIndex("idx_people_org_levels_code_org").on(table.orgId, table.code),
  ]
)

/**
 * Organizational Levels relations
 * Note: The roles relation is defined in org-roles.ts to avoid circular imports
 */
export const organizationalLevelsRelations = relations(organizationalLevels, () => ({
  // Roles at this level are accessed via organizationalRoles.levelId
}))

/**
 * Type inference for OrganizationalLevel
 */
export type OrganizationalLevel = typeof organizationalLevels.$inferSelect
export type NewOrganizationalLevel = typeof organizationalLevels.$inferInsert

