/**
 * IdaraOS web filtering - curated category domain lists
 *
 * IdaraOS ships one domain list per category (deployment/agent/filter-lists/<category>.txt). The
 * agent fetches only the lists for the categories an admin selected, verifies the SHA-256 (also
 * advertised in the check-in response), and sinkholes those domains in the device's hosts file.
 *
 * This mirrors agent-release.ts: the server serves exactly the lists shipped with this deployment -
 * never admin-supplied content - so, like the agent self-update, it is a data channel, not a way to
 * run arbitrary code. Cached per file, invalidated when the file's mtime changes.
 */

import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { WEB_FILTERING_CATEGORIES, isWebFilteringCategory, type WebFilteringCategory } from "./device-policies"

export interface FilterList {
  category: WebFilteringCategory
  /** Lowercase hex SHA-256 of the raw file bytes (the agent verifies this with Get-FileHash) */
  sha256: string
  /** Raw file bytes, served verbatim so the agent's on-disk hash matches */
  content: Buffer
}

const DIR_CANDIDATES = [
  process.env.FILTER_LISTS_PATH,
  // cwd is the repo root (dev container) or apps/web depending on how the server was started
  path.join(process.cwd(), "deployment/agent/filter-lists"),
  path.join(process.cwd(), "..", "..", "deployment/agent/filter-lists"),
  path.join(process.cwd(), "..", "deployment/agent/filter-lists"),
].filter((p): p is string => !!p)

const cache = new Map<WebFilteringCategory, { path: string; mtimeMs: number; list: FilterList }>()

async function resolveListPath(category: WebFilteringCategory): Promise<string | null> {
  for (const dir of DIR_CANDIDATES) {
    const candidate = path.join(dir, `${category}.txt`)
    try {
      await stat(candidate)
      return candidate
    } catch {
      // try the next candidate
    }
  }
  return null
}

/**
 * The curated list for a category with its SHA-256, or null if the category is unknown or no list
 * file ships on this server. Cached, invalidated when the file's mtime changes.
 */
export async function getFilterList(category: string): Promise<FilterList | null> {
  if (!isWebFilteringCategory(category)) return null
  const listPath = await resolveListPath(category)
  if (!listPath) return null

  const info = await stat(listPath)
  const cached = cache.get(category)
  if (cached && cached.path === listPath && cached.mtimeMs === info.mtimeMs) {
    return cached.list
  }

  const content = await readFile(listPath)
  const sha256 = createHash("sha256").update(content).digest("hex")
  const list: FilterList = { category, sha256, content }
  cache.set(category, { path: listPath, mtimeMs: info.mtimeMs, list })
  return list
}

/**
 * `{ category, sha256 }` for each requested category that has a shipped list (defaults to all).
 * The check-in response advertises this so the agent re-downloads only the lists whose hash changed.
 */
export async function getFilterListManifest(
  categories?: readonly string[]
): Promise<Array<{ category: WebFilteringCategory; sha256: string }>> {
  const wanted = (categories ?? WEB_FILTERING_CATEGORIES).filter(isWebFilteringCategory)
  const out: Array<{ category: WebFilteringCategory; sha256: string }> = []
  for (const category of wanted) {
    const list = await getFilterList(category)
    if (list) out.push({ category, sha256: list.sha256 })
  }
  return out
}
