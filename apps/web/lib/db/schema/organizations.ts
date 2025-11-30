/**
 * Organizations Schema - Drizzle ORM table definitions
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"

/**
 * Organizations table
 */
export const organizations = pgTable("core_organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  logo: text("logo"),
  // Application branding name - shown in header, login, etc.
  // Defaults to "IdaraOS", minimum 3 characters
  appName: text("app_name").notNull().default("IdaraOS"),
  // Social & professional links
  linkedIn: text("linked_in"),
  twitter: text("twitter"),
  youtube: text("youtube"),
  timezone: text("timezone").notNull().default("UTC"),
  dateFormat: text("date_format").notNull().default("YYYY-MM-DD"),
  currency: text("currency").notNull().default("USD"),
  settings: jsonb("settings").default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Type inference for Organization
 */
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert

