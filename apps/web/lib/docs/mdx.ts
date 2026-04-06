/**
 * MDX utilities for documentation module
 *
 * Content storage is now handled by the storage resolver (./storage.ts).
 * This file retains only the frontmatter parser used by the MDX renderer.
 */

/**
 * Document frontmatter structure (optional in MDX files)
 */
export interface DocumentFrontmatter {
  title?: string
  description?: string
  category?: string
  tags?: string[]
  effectiveDate?: string
  confidentiality?: "public" | "internal" | "confidential" | "restricted"
}

/**
 * Extract frontmatter from MDX content (simple YAML-like parsing)
 */
export function extractFrontmatter(content: string): {
  frontmatter: DocumentFrontmatter
  content: string
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: {}, content }
  }

  const frontmatterStr = match[1]
  const cleanContent = content.replace(frontmatterRegex, "")

  const frontmatter: DocumentFrontmatter = {}
  const lines = frontmatterStr.split("\n")

  for (const line of lines) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue

    const key = line.substring(0, colonIndex).trim()
    let value = line.substring(colonIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      const arrayContent = value.slice(1, -1)
      const items = arrayContent
        .split(",")
        .map((s) => s.trim().replace(/["']/g, ""))
      ;(frontmatter as Record<string, unknown>)[key] = items
    } else {
      ;(frontmatter as Record<string, unknown>)[key] = value
    }
  }

  return { frontmatter, content: cleanContent }
}
