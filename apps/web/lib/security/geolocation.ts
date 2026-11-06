/**
 * IP geolocation - approximate device location from the public IP seen at check-in.
 *
 * On-demand, server-side, lightly cached. Uses a configurable provider (env IP_GEOLOCATION_URL, with
 * `{ip}` substituted; default ip-api.com, free/no-key). City-level only - VPN/proxy skews it, and the
 * lookup sends the device's IP to a third party. Swap the env to an https/self-hosted provider, or a
 * future offline MaxMind lookup, to avoid the external call.
 */

export interface GeoLocation {
  ip: string
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  source: string
}

const cache = new Map<string, { at: number; geo: GeoLocation | null }>()
const TTL_MS = 60 * 60 * 1000 // 1 hour

const PROVIDER = process.env.IP_GEOLOCATION_URL || "http://ip-api.com/json/{ip}"

/** Public (routable) IPv4/IPv6 only - skip private/reserved ranges we can't geolocate. */
export function isPublicIp(ip: string): boolean {
  if (!ip) return false
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip.startsWith("169.254.") ||
    ip === "::1" ||
    ip.startsWith("fe80") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  ) {
    return false
  }
  const m = ip.match(/^172\.(\d+)\./)
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false
  return true
}

export async function geolocateIp(ip: string | null): Promise<GeoLocation | null> {
  if (!ip || !isPublicIp(ip)) return null
  const cached = cache.get(ip)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.geo

  let geo: GeoLocation | null = null
  try {
    const url = PROVIDER.replace("{ip}", encodeURIComponent(ip))
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const j = (await res.json()) as Record<string, unknown>
      const lat = (j.lat ?? j.latitude) as number | undefined
      const lng = (j.lon ?? j.longitude) as number | undefined
      geo = {
        ip,
        city: (j.city as string) ?? null,
        region: (j.regionName as string) ?? (j.region as string) ?? null,
        country: (j.country as string) ?? (j.country_name as string) ?? null,
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        source: new URL(url).host,
      }
    }
  } catch {
    geo = null
  }
  cache.set(ip, { at: Date.now(), geo })
  return geo
}
