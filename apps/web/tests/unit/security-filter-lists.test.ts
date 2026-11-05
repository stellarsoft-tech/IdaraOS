import { createHash } from "node:crypto"
import { describe, it, expect } from "vitest"
import { getFilterList, getFilterListManifest } from "../../lib/security/filter-lists"
import { WEB_FILTERING_CATEGORIES } from "../../lib/security/device-policies"

describe("filter-lists loader", () => {
  it("serves every curated category list with a verifiable SHA-256", async () => {
    for (const category of WEB_FILTERING_CATEGORIES) {
      const list = await getFilterList(category)
      expect(list, `list for ${category}`).not.toBeNull()
      expect(list!.category).toBe(category)
      expect(list!.sha256).toMatch(/^[0-9a-f]{64}$/)
      // The advertised hash must match a fresh hash of the served bytes (what the agent verifies)
      expect(list!.sha256).toBe(createHash("sha256").update(list!.content).digest("hex"))
      expect(list!.content.length).toBeGreaterThan(0)
    }
  })

  it("returns null for an unknown or unsafe category", async () => {
    expect(await getFilterList("bogus")).toBeNull()
    expect(await getFilterList("../secret")).toBeNull()
    expect(await getFilterList("constructor")).toBeNull()
  })

  it("manifest advertises a hash for each requested category and drops unknown ones", async () => {
    const manifest = await getFilterListManifest(["gambling", "social", "bogus"])
    expect(manifest.map((m) => m.category).sort()).toEqual(["gambling", "social"])
    for (const entry of manifest) expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})
