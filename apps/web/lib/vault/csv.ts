/**
 * Minimal CSV parsing + mapping for vault import (dependency-free).
 *
 * parseCsv handles quoted fields, embedded commas and newlines (RFC 4180-ish). mapImportCsv maps a
 * password-manager CSV export (Keeper, Bitwarden, LastPass, 1Password, …) to vault item fields, using
 * the header row when present, otherwise Keeper's positional order.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ",") {
      row.push(field)
      field = ""
      i++
      continue
    }
    if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

export interface ImportMapped {
  folder: string | null
  title: string
  username: string | null
  password: string | null
  url: string | null
  notes: string | null
  totp: string | null
}

export function mapImportCsv(rows: string[][]): ImportMapped[] {
  if (rows.length === 0) return []
  const header = rows[0].map((c) => c.trim().toLowerCase())
  const looksHeader = header.some((c) => /title|name/.test(c)) && header.some((c) => /password/.test(c))
  const find = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)))

  let idx: Record<string, number>
  let dataRows: string[][]
  if (looksHeader) {
    idx = {
      folder: find(["folder", "grouping", "group"]),
      title: find(["title", "name"]),
      username: find(["login", "username", "user"]),
      password: find(["password"]),
      url: find(["url", "website", "uri", "link"]),
      notes: find(["notes", "note"]),
      totp: find(["totp", "otpauth", "2fa"]),
    }
    dataRows = rows.slice(1)
  } else {
    // Keeper's header-less order: Folder, Title, Login, Password, Website, Notes
    idx = { folder: 0, title: 1, username: 2, password: 3, url: 4, notes: 5, totp: -1 }
    dataRows = rows
  }

  const at = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "")
  return dataRows
    .map((r) => ({
      folder: at(r, idx.folder) || null,
      title: at(r, idx.title),
      username: at(r, idx.username) || null,
      password: at(r, idx.password) || null,
      url: at(r, idx.url) || null,
      notes: at(r, idx.notes) || null,
      totp: at(r, idx.totp) || null,
    }))
    .filter((m) => m.title || m.username || m.password || m.url)
    .map((m) => ({ ...m, title: m.title || m.url || m.username || "Untitled" }))
}
