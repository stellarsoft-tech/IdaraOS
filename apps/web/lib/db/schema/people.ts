/**
 * People Schema - Drizzle ORM table definitions
 */

import { pgTable, uuid, text, date, timestamp, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

/**
 * Person status enum values
 */
export const personStatusValues = ["active", "onboarding", "offboarding", "inactive"] as const
export type PersonStatus = (typeof personStatusValues)[number]

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
    managerId: uuid("manager_id").references(() => persons.id, { onDelete: "set null" }),
    status: text("status", { enum: personStatusValues }).notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    phone: text("phone"),
    location: text("location"),
    avatar: text("avatar"),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_persons_org").on(table.orgId),
    index("idx_people_persons_status").on(table.status),
    index("idx_people_persons_team").on(table.team),
    index("idx_people_persons_slug").on(table.slug),
  ]
)

/**
 * Person relations
 */
export const personsRelations = relations(persons, ({ one }) => ({
  manager: one(persons, {
    fields: [persons.managerId],
    references: [persons.id],
    relationName: "manager",
  }),
}))

/**
 * Type inference for Person
 */
export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert

