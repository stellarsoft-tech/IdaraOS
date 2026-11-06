import { describe, it, expect } from "vitest"
import { generateTotp, parseTotp } from "@/lib/vault/totp"
import { mapImportCsv, parseCsv } from "@/lib/vault/csv"

describe("totp", () => {
  it("matches the RFC 6238 SHA-1 test vector", () => {
    // RFC 6238 seed "12345678901234567890" in base32; at T=59s (counter 1) TOTP8 = 94287082
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const code = generateTotp(secret, 59_000)
    expect(code?.code).toBe("287082")
    expect(code?.period).toBe(30)
  })

  it("parses an otpauth:// URI", () => {
    const cfg = parseTotp("otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP&digits=6&period=30")
    expect(cfg?.secret).toBe("JBSWY3DPEHPK3PXP")
    expect(cfg?.period).toBe(30)
  })

  it("returns null for an empty secret", () => {
    expect(generateTotp("")).toBeNull()
  })
})

describe("csv import", () => {
  it("parses quoted fields with commas and newlines", () => {
    const rows = parseCsv('Folder,Title,Login,Password,Website,Notes\nWork,"GitHub, Inc.",alice,"p,w",https://x,"line1\nline2"')
    expect(rows.length).toBe(2)
    expect(rows[1][1]).toBe("GitHub, Inc.")
    expect(rows[1][3]).toBe("p,w")
    expect(rows[1][5]).toBe("line1\nline2")
  })

  it("maps a CSV with headers", () => {
    const mapped = mapImportCsv(parseCsv("Title,Login,Password,URL\nGitHub,alice,secret,https://github.com"))
    expect(mapped).toHaveLength(1)
    expect(mapped[0]).toMatchObject({ title: "GitHub", username: "alice", password: "secret", url: "https://github.com" })
  })

  it("maps a header-less Keeper CSV positionally", () => {
    const mapped = mapImportCsv(parseCsv("Work,GitHub,alice,secret,https://github.com,my note"))
    expect(mapped[0]).toMatchObject({ folder: "Work", title: "GitHub", username: "alice", notes: "my note" })
  })
})
