/**
 * People Schema - Drizzle ORM table definitions
 */

import { pgTable, uuid, text, date, timestamp, index, boolean, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { teams } from "./teams"
import { organizationalRoles } from "./org-roles"

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
    // FK references to entity tables (role and team are linked, not stored as text)
    roleId: uuid("role_id").references(() => organizationalRoles.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
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
    
    // Additional Entra sync fields
    // When the user was created in Entra (createdDateTime)
    entraCreatedAt: timestamp("entra_created_at", { withTimezone: true }),
    // Employee hire date from Entra (employeeHireDate)
    hireDate: date("hire_date"),
    // Last sign-in date (cached from Entra, but fetched real-time when Entra enabled)
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    // Last password change date (cached from Entra, but fetched real-time when Entra enabled)
    lastPasswordChangeAt: timestamp("last_password_change_at", { withTimezone: true }),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_persons_org").on(table.orgId),
    index("idx_people_persons_status").on(table.status),
    index("idx_people_persons_team_id").on(table.teamId),
    index("idx_people_persons_role_id").on(table.roleId),
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
  // Team relationship
  teamEntity: one(teams, {
    fields: [persons.teamId],
    references: [teams.id],
  }),
  // Organizational role relationship
  roleEntity: one(organizationalRoles, {
    fields: [persons.roleId],
    references: [organizationalRoles.id],
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
