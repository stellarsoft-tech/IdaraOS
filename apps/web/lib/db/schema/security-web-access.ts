/**
 * Website access requests - time-boxed exceptions to web content filtering
 *
 * A member blocked by the web-filtering policy requests temporary access to a domain; an approver
 * (anyone who can edit device policies) grants it for a short window. While a request is live
 * (status 'approved' and not past expiresAt), its domain is merged into the member's effective
 * web-filtering allowlist at check-in, so the agent stops blocking it. When the window ends the
 * exception drops out of the allowlist and the agent re-blocks the site at the next check-in; the
 * member requests again to get back in. Per-member (applies to every agent device they're signed in
 * to), mirroring how web-filtering policies reach a device.
 * See docs/modules/security/web-filtering.md
 */

import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"

/**
 * - pending: waiting for an approver
 * - approved: live until expiresAt, then the agent re-blocks the site
 * - denied: rejected by an approver
 * - cancelled: withdrawn by the member before a decision
 * - expired: the approved window has passed
 */
export const webAccessStatusValues = ["pending", "approved", "denied", "cancelled", "expired"] as const
export type WebAccessStatus = (typeof webAccessStatusValues)[number]

export const webAccessRequests = pgTable(
  "security_web_access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // The domain the member wants to reach (normalized, e.g. "example.com")
    domain: text("domain").notNull(),
    reason: text("reason"),
    requestedMinutes: integer("requested_minutes").notNull(),
    status: text("status", { enum: webAccessStatusValues }).notNull().default("pending"),
    decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    // Set when approved: the exception is live until this instant
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_web_access_org").on(table.orgId),
    index("idx_security_web_access_requester").on(table.requesterId),
    index("idx_security_web_access_status").on(table.status),
  ]
)

export const webAccessRequestsRelations = relations(webAccessRequests, ({ one }) => ({
  org: one(organizations, { fields: [webAccessRequests.orgId], references: [organizations.id] }),
  requester: one(users, { fields: [webAccessRequests.requesterId], references: [users.id] }),
}))

export type WebAccessRequest = typeof webAccessRequests.$inferSelect
export type NewWebAccessRequest = typeof webAccessRequests.$inferInsert
