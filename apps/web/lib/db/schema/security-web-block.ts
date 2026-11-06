/**
 * Website block events - attempts to reach a site the web-filtering policy blocks
 *
 * The agent reads the Windows DNS-Client log and reports domains that resolved to 0.0.0.0 - both our
 * hosts-file sinkhole and Cloudflare-for-Families' block answer are 0.0.0.0, so this is a unified
 * "someone tried to reach a blocked site" signal. One row per (device, domain) with a hit count and
 * first/last-seen timestamps, shown on the device's Web filtering tab. Only blocked (0.0.0.0) answers
 * are kept - never full browsing history.
 */

import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { softwareUpdateDevices } from "./security-software"

export const webBlockEvents = pgTable(
  "security_web_block_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => softwareUpdateDevices.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    hitCount: integer("hit_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_security_web_block_device_domain").on(table.deviceId, table.domain),
    index("idx_security_web_block_device").on(table.deviceId),
    index("idx_security_web_block_org").on(table.orgId),
  ]
)

export const webBlockEventsRelations = relations(webBlockEvents, ({ one }) => ({
  org: one(organizations, { fields: [webBlockEvents.orgId], references: [organizations.id] }),
  device: one(softwareUpdateDevices, { fields: [webBlockEvents.deviceId], references: [softwareUpdateDevices.id] }),
}))

export type WebBlockEvent = typeof webBlockEvents.$inferSelect
export type NewWebBlockEvent = typeof webBlockEvents.$inferInsert
