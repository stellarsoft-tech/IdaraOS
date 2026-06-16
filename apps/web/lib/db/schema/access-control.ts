/**
 * People Access Control Schema - ISO 27001:2022 access groups and register
 */

import { relations } from "drizzle-orm"
import { pgTable, uuid, text, timestamp, index, primaryKey, jsonb } from "drizzle-orm/pg-core"
import { persons } from "./people"
import { organizationalRoles } from "./org-roles"
import { users } from "./users"

export const accessGroupStatusValues = ["active", "draft", "retired"] as const
export type AccessGroupStatus = (typeof accessGroupStatusValues)[number]

export const accessGroupRiskLevelValues = ["low", "medium", "high", "critical"] as const
export type AccessGroupRiskLevel = (typeof accessGroupRiskLevelValues)[number]

export const accessReviewStatusValues = ["not_reviewed", "approved", "changes_required", "revoked"] as const
export type AccessReviewStatus = (typeof accessReviewStatusValues)[number]

export const accessReviewFrequencyValues = ["monthly", "quarterly", "semi_annual", "annual"] as const
export type AccessReviewFrequency = (typeof accessReviewFrequencyValues)[number]

/**
 * Access groups define least-privilege bundles for people based on role and responsibility.
 */
export const accessGroups = pgTable(
  "people_access_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    businessJustification: text("business_justification").notNull(),
    accessItems: jsonb("access_items").$type<string[]>().notNull().default([]),
    isoControls: jsonb("iso_controls").$type<string[]>().notNull().default(["A.5.15", "A.5.18"]),
    ownerPersonId: uuid("owner_person_id").references(() => persons.id, { onDelete: "set null" }),
    reviewFrequency: text("review_frequency", { enum: accessReviewFrequencyValues }).notNull().default("quarterly"),
    riskLevel: text("risk_level", { enum: accessGroupRiskLevelValues }).notNull().default("medium"),
    status: text("status", { enum: accessGroupStatusValues }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_access_groups_org").on(table.orgId),
    index("idx_people_access_groups_status").on(table.status),
    index("idx_people_access_groups_owner").on(table.ownerPersonId),
  ]
)

/**
 * Recommended organizational roles for each access group.
 */
export const accessGroupRoles = pgTable(
  "people_access_group_roles",
  {
    accessGroupId: uuid("access_group_id").notNull().references(() => accessGroups.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => organizationalRoles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accessGroupId, table.roleId] }),
    index("idx_people_access_group_roles_group").on(table.accessGroupId),
    index("idx_people_access_group_roles_role").on(table.roleId),
  ]
)

/**
 * Access register assignments show which person currently holds an access group.
 */
export const accessGroupAssignments = pgTable(
  "people_access_group_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    accessGroupId: uuid("access_group_id").notNull().references(() => accessGroups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    grantedByPersonId: uuid("granted_by_person_id").references(() => persons.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    reviewStatus: text("review_status", { enum: accessReviewStatusValues }).notNull().default("not_reviewed"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_people_access_assignments_org").on(table.orgId),
    index("idx_people_access_assignments_group").on(table.accessGroupId),
    index("idx_people_access_assignments_user").on(table.userId),
    index("idx_people_access_assignments_person").on(table.personId),
    index("idx_people_access_assignments_review").on(table.reviewStatus),
  ]
)

export const accessGroupsRelations = relations(accessGroups, ({ one, many }) => ({
  owner: one(persons, {
    fields: [accessGroups.ownerPersonId],
    references: [persons.id],
  }),
  roles: many(accessGroupRoles),
  assignments: many(accessGroupAssignments),
}))

export const accessGroupRolesRelations = relations(accessGroupRoles, ({ one }) => ({
  accessGroup: one(accessGroups, {
    fields: [accessGroupRoles.accessGroupId],
    references: [accessGroups.id],
  }),
  role: one(organizationalRoles, {
    fields: [accessGroupRoles.roleId],
    references: [organizationalRoles.id],
  }),
}))

export const accessGroupAssignmentsRelations = relations(accessGroupAssignments, ({ one }) => ({
  accessGroup: one(accessGroups, {
    fields: [accessGroupAssignments.accessGroupId],
    references: [accessGroups.id],
  }),
  user: one(users, {
    fields: [accessGroupAssignments.userId],
    references: [users.id],
  }),
  person: one(persons, {
    fields: [accessGroupAssignments.personId],
    references: [persons.id],
  }),
  grantedBy: one(persons, {
    fields: [accessGroupAssignments.grantedByPersonId],
    references: [persons.id],
  }),
}))

export type AccessGroup = typeof accessGroups.$inferSelect
export type NewAccessGroup = typeof accessGroups.$inferInsert
export type AccessGroupRole = typeof accessGroupRoles.$inferSelect
export type NewAccessGroupRole = typeof accessGroupRoles.$inferInsert
export type AccessGroupAssignment = typeof accessGroupAssignments.$inferSelect
export type NewAccessGroupAssignment = typeof accessGroupAssignments.$inferInsert
