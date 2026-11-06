/**
 * Website block events - server helpers
 *
 * The agent reports domains that resolved to 0.0.0.0 (blocked by web filtering). We upsert one row per
 * (device, domain), accumulating a hit count, and list them for the device's Web filtering tab.
 */

import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { webBlockEvents, type SoftwareUpdateDevice } from "@/lib/db/schema"
import { normalizeDomainPattern } from "./device-policies"

export interface ReportedBlockEvent {
  domain: string
  count?: number | null
  lastSeen?: string | null
}

const MAX_BLOCK_EVENTS_PER_REPORT = 100

/** Record domains the agent saw resolve to 0.0.0.0 (blocked). Upsert per (device, domain). */
export async function recordWebBlockEvents(
  device: SoftwareUpdateDevice,
  events: ReportedBlockEvent[],
  now: Date = new Date()
): Promise<void> {
  const seen = new Set<string>()
  for (const ev of events.slice(0, MAX_BLOCK_EVENTS_PER_REPORT)) {
    const domain = normalizeDomainPattern(ev.domain)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    const inc = Math.min(Math.max(Math.trunc(Number(ev.count) || 1), 1), 10000)
    const parsed = ev.lastSeen ? new Date(ev.lastSeen) : now
    const last = Number.isNaN(parsed.getTime()) ? now : parsed
    await db
      .insert(webBlockEvents)
      .values({ orgId: device.orgId, deviceId: device.id, domain, hitCount: inc, firstSeenAt: last, lastSeenAt: last })
      .onConflictDoUpdate({
        target: [webBlockEvents.deviceId, webBlockEvents.domain],
        set: { hitCount: sql`${webBlockEvents.hitCount} + ${inc}`, lastSeenAt: last, updatedAt: now },
      })
  }
}

export interface WebBlockEventView {
  domain: string
  hitCount: number
  firstSeenAt: string
  lastSeenAt: string
}

export async function listWebBlockEvents(deviceId: string, limit = 100): Promise<WebBlockEventView[]> {
  const rows = await db
    .select()
    .from(webBlockEvents)
    .where(eq(webBlockEvents.deviceId, deviceId))
    .orderBy(desc(webBlockEvents.lastSeenAt))
    .limit(limit)
  return rows.map((r) => ({
    domain: r.domain,
    hitCount: r.hitCount,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }))
}
