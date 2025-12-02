/**
 * People Schema - Drizzle ORM table definitions
 */

import { pgTable, uuid, text, date, timestamp, index, boolean, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

/**
 * Person status enum values
 */
export const personStatusValues = ["active", "onboarding", "offboarding", "inactive"] as const
export type PersonStatus = (typeof personStatusValues)[number]

/**
 * Person source enum values - how the person record was created
 */
export const personSourceValues = ["manual", "sync"] as const
export type PersonSource = (typeof personSourceValues)[number]

/**
 * People/Employees table
 */
export const persons = pgTable(
  "people_persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    role: text("role").notNull(),
    team: text("team"),
    managerId: uuid("manager_id").references((): AnyPgColumn => persons.id, { onDelete: "set null" }),
    status: text("status", { enum: personStatusValues }).notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    phone: text("phone"),
    location: text("location"),
    avatar: text("avatar"),
    bio: text("bio"),
    
    // Sync tracking fields
    // Source of creation - "manual" (UI/API) or "sync" (synced from Entra ID)
    source: text("source", { enum: personSourceValues }).notNull().default("manual"),
    // Entra ID of the user this person was synced from (if any)
    entraId: text("entra_id"),
    // Entra group ID this person was synced from
    entraGroupId: text("entra_group_id"),
    // Entra group name for display
    entraGroupName: text("entra_group_name"),
    // Last time this person was synced from Entra
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    // Whether Entra is the source of truth for this person's data
    syncEnabled: boolean("sync_enabled").notNull().default(false),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_persons_org").on(table.orgId),
    index("idx_people_persons_status").on(table.status),
    index("idx_people_persons_team").on(table.team),
    index("idx_people_persons_slug").on(table.slug),
    index("idx_people_persons_source").on(table.source),
    index("idx_people_persons_entra_id").on(table.entraId),
  ]
)

/**
 * Person relations
 * Note: The 'user' relation links to core_users when a person has a system account
 */
export const personsRelations = relations(persons, ({ one }) => ({
  manager: one(persons, {
    fields: [persons.managerId],
    references: [persons.id],
    relationName: "manager",
  }),
  // Note: user relation is defined via users.personId -> persons.id
  // This is accessed through a join query, not a direct relation here
  // to avoid circular import issues
}))

/**
 * Type inference for Person
 */
export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert
