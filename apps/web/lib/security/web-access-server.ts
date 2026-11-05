/**
 * Website access requests - server helpers
 *
 * The time-boxed exceptions a member requests to reach a site the web-filtering policy blocks. The
 * two helpers the agent pipeline needs live here: marking expired windows, and resolving the live
 * exception domains to merge into a member's effective web-filtering allowlist at check-in. The
 * request/approve/deny/cancel flows live in the routes under app/api/security/web-access.
 */

import { and, eq, gt, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { webAccessRequests } from "@/lib/db/schema"

/** Duration choices offered in the UI, and the hard cap enforced on approval. */
export const WEB_ACCESS_DURATION_OPTIONS = [10, 30, 60, 120] as const
export const WEB_ACCESS_MAX_MINUTES = 480

/** Mark approved exceptions whose window has passed as expired (lazy cleanup, like expireDueGrants). */
export async function expireDueWebAccess(now: Date, orgId: string): Promise<void> {
  await db
    .update(webAccessRequests)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(webAccessRequests.orgId, orgId),
        eq(webAccessRequests.status, "approved"),
        lte(webAccessRequests.expiresAt, now)
      )
    )
}

/**
 * Domains with a live approved exception for this member - merged into their web-filtering allowlist
 * at check-in so the agent stops blocking them until the window ends. Filtered by expiresAt > now, so
 * it stays correct even before expireDueWebAccess runs.
 */
export async function getActiveWebAccessDomains(orgId: string, userId: string, now: Date): Promise<string[]> {
  const rows = await db
    .select({ domain: webAccessRequests.domain })
    .from(webAccessRequests)
    .where(
      and(
        eq(webAccessRequests.orgId, orgId),
        eq(webAccessRequests.requesterId, userId),
        eq(webAccessRequests.status, "approved"),
        gt(webAccessRequests.expiresAt, now)
      )
    )
  return [...new Set(rows.map((r) => r.domain))]
}
