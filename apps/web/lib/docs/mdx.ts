/**
 * MDX utilities for documentation module
 * Handles reading and processing MDX files from the content directory
 */

import fs from "fs/promises"
import path from "path"

// Content directory path
const CONTENT_DIR = path.join(process.cwd(), "content/docs")

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
 * Read MDX content from file
 */
export async function readDocumentContent(slug: string): Promise<string | null> {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
    const content = await fs.readFile(filePath, "utf-8")
    return content
  } catch (error) {
    // File doesn't exist or can't be read
    console.error(`Error reading document ${slug}:`, error)
    return null
  }
}

/**
 * Check if document file exists
 */
export async function documentFileExists(slug: string): Promise<boolean> {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * List all document files in the content directory
 */
export async function listDocumentFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(CONTENT_DIR)
    return files
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => file.replace(".mdx", ""))
  } catch {
    return []
  }
}

/**
 * Write MDX content to file (for admin editing)
 */
export async function writeDocumentContent(slug: string, content: string): Promise<boolean> {
  try {
    // Ensure directory exists
    await fs.mkdir(CONTENT_DIR, { recursive: true })
    
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
    await fs.writeFile(filePath, content, "utf-8")
    return true
  } catch (error) {
    console.error(`Error writing document ${slug}:`, error)
    return false
  }
}

/**
 * Delete MDX file
 */
export async function deleteDocumentFile(slug: string): Promise<boolean> {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
    await fs.unlink(filePath)
    return true
  } catch (error) {
    console.error(`Error deleting document ${slug}:`, error)
    return false
  }
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
  
  // Simple YAML parsing for frontmatter
  const frontmatter: DocumentFrontmatter = {}
  const lines = frontmatterStr.split("\n")
  
  for (const line of lines) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue
    
    const key = line.substring(0, colonIndex).trim()
    let value = line.substring(colonIndex + 1).trim()
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    
    // Handle arrays (simple format: [item1, item2])
    if (value.startsWith("[") && value.endsWith("]")) {
      const arrayContent = value.slice(1, -1)
      const items = arrayContent.split(",").map((s) => s.trim().replace(/["']/g, ""))
      ;(frontmatter as Record<string, unknown>)[key] = items
    } else {
      ;(frontmatter as Record<string, unknown>)[key] = value
    }
  }
  
  return { frontmatter, content: cleanContent }
}

