import { afterEach, describe, it, expect, vi } from "vitest"
import {
  isScheduledRunDue,
  isValidWingetId,
  latestScheduledRun,
  mapIntuneInstallState,
  nextScheduledRun,
  summarizeRun,
  truncateLog,
  type UpdateSchedule,
} from "../../lib/security/software"
import { checkCatalogApp } from "../../lib/security/software-validation"

vi.mock("@/lib/graph/client", () => ({
  getGraphAccessToken: vi.fn(async () => "test-token"),
}))
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }))

const {
  addDeviceToGroup,
  getDeviceInstallState,
  parseReport,
  removeDeviceFromGroup,
  resolveDeviceObjectId,
} = await import("../../lib/security/software-intune")
const { hashSecret, parseDeviceAuthorization } = await import("../../lib/security/software-updates-server")

const DEVICE_ID = "11111111-2222-3333-4444-555555555555"
const GROUP_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const APP_ID = "99999999-8888-7777-6666-555555555555"

describe("winget IDs", () => {
  it("accepts real package IDs", () => {
    for (const id of ["Git.Git", "Notepad++.Notepad++", "Microsoft.VisualStudio.2022.Professional", "Schniz.fnm", "Microsoft.WSL"]) {
      expect(isValidWingetId(id)).toBe(true)
    }
  })

  it("rejects anything that could become a command", () => {
    for (const id of ["", "Git.Git; rm -rf", "Git Git", "../evil", "-Id", "a&b", "x".repeat(129), "a..b"]) {
      expect(isValidWingetId(id)).toBe(false)
    }
  })
})

describe("update schedule", () => {
  // Mon-Fri 12:00 in Karachi (UTC+5, no daylight saving)
  const weekdays: UpdateSchedule = { enabled: true, days: [1, 2, 3, 4, 5], time: "12:00", timezone: "Asia/Karachi" }

  it("finds the latest and next run in the schedule's time zone", () => {
    const thursday1pm = new Date("2026-10-29T08:00:00Z")
    expect(latestScheduledRun(weekdays, thursday1pm)?.toISOString()).toBe("2026-10-29T07:00:00.000Z")
    expect(nextScheduledRun(weekdays, thursday1pm)?.toISOString()).toBe("2026-10-30T07:00:00.000Z")
  })

  it("skips days that aren't selected", () => {
    const saturday = new Date("2026-10-31T08:00:00Z")
    expect(latestScheduledRun(weekdays, saturday)?.toISOString()).toBe("2026-10-30T07:00:00.000Z")
    expect(nextScheduledRun(weekdays, saturday)?.toISOString()).toBe("2026-11-02T07:00:00.000Z")
  })

  it("follows daylight saving changes", () => {
    // New York leaves daylight saving on 2026-11-01
    const daily: UpdateSchedule = { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], time: "09:00", timezone: "America/New_York" }
    expect(nextScheduledRun(daily, new Date("2026-10-30T20:00:00Z"))?.toISOString()).toBe("2026-10-31T13:00:00.000Z")
    expect(nextScheduledRun(daily, new Date("2026-10-31T20:00:00Z"))?.toISOString()).toBe("2026-11-01T14:00:00.000Z")
  })

  it("runs a device once per scheduled time, catching up after it was offline", () => {
    const now = new Date("2026-10-29T08:00:00Z")
    const enrolled = new Date("2026-10-01T00:00:00Z")
    expect(isScheduledRunDue(weekdays, null, enrolled, now)).toBe(true)
    expect(isScheduledRunDue(weekdays, new Date("2026-10-28T07:05:00Z"), enrolled, now)).toBe(true)
    expect(isScheduledRunDue(weekdays, new Date("2026-10-29T07:01:00Z"), enrolled, now)).toBe(false)
  })

  it("doesn't run for times before enrollment, or when turned off", () => {
    const now = new Date("2026-10-29T08:00:00Z")
    expect(isScheduledRunDue(weekdays, null, new Date("2026-10-29T07:30:00Z"), now)).toBe(false)
    expect(isScheduledRunDue({ ...weekdays, enabled: false }, null, new Date(0), now)).toBe(false)
    expect(isScheduledRunDue({ ...weekdays, days: [] }, null, new Date(0), now)).toBe(false)
  })
})

describe("update runs", () => {
  it("summarizes package results", () => {
    expect(summarizeRun([])).toMatchObject({ status: "succeeded", updatedCount: 0 })
    expect(
      summarizeRun([
        { wingetId: "Git.Git", outcome: "updated" },
        { wingetId: "Microsoft.WSL", outcome: "up_to_date" },
        { wingetId: "Schniz.fnm", outcome: "not_installed" },
      ])
    ).toMatchObject({ status: "succeeded", updatedCount: 1, failedCount: 0 })
    expect(
      summarizeRun([
        { wingetId: "Git.Git", outcome: "updated", rebootRequired: true },
        { wingetId: "Microsoft.WSL", outcome: "failed" },
      ])
    ).toMatchObject({ status: "partial", failedCount: 1, rebootRequired: true })
    expect(summarizeRun([{ wingetId: "Git.Git", outcome: "failed" }])).toMatchObject({ status: "failed" })
  })

  it("marks a run failed when the device hit an error before any package", () => {
    expect(summarizeRun([], "winget not found")).toMatchObject({ status: "failed" })
  })

  it("keeps the end of long logs", () => {
    const log = "a".repeat(10) + "END"
    expect(truncateLog(log, 5)).toBe("…(truncated)\naaEND")
    expect(truncateLog(null)).toBeNull()
  })
})

describe("catalog rules", () => {
  it("needs a winget ID for automatic winget updates", () => {
    expect(checkCatalogApp({ updateMethod: "winget", autoUpdate: true, wingetId: null })).toMatch(/winget ID/)
    expect(checkCatalogApp({ updateMethod: "winget", autoUpdate: false, wingetId: null })).toBeNull()
    expect(checkCatalogApp({ updateMethod: "self", autoUpdate: true, wingetId: null })).toBeNull()
  })

  it("needs the Intune app when an install group is set", () => {
    expect(checkCatalogApp({ installGroupId: GROUP_ID, intuneAppId: null })).toMatch(/Intune app/)
    expect(checkCatalogApp({ installGroupId: GROUP_ID, intuneAppId: APP_ID })).toBeNull()
  })
})

describe("device auth", () => {
  it("parses the device authorization header", () => {
    expect(parseDeviceAuthorization(`Bearer ${DEVICE_ID}.iud_secret-value`)).toEqual({ deviceId: DEVICE_ID, secret: "iud_secret-value" })
    expect(parseDeviceAuthorization("Bearer nope")).toBeNull()
    expect(parseDeviceAuthorization(null)).toBeNull()
  })

  it("hashes secrets deterministically", () => {
    expect(hashSecret("abc")).toBe(hashSecret("abc"))
    expect(hashSecret("abc")).not.toBe(hashSecret("abd"))
    expect(hashSecret("abc")).toHaveLength(64)
  })
})

describe("Intune installs via Graph", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("maps install states", () => {
    expect(mapIntuneInstallState("installed")).toBe("installed")
    expect(mapIntuneInstallState("Not Installed")).toBe("unknown")
    expect(mapIntuneInstallState("failed")).toBe("failed")
    expect(mapIntuneInstallState("Install Pending")).toBe("pending")
    expect(mapIntuneInstallState(1)).toBe("installed")
    expect(mapIntuneInstallState(2)).toBe("failed")
    expect(mapIntuneInstallState(5)).toBe("pending")
    expect(mapIntuneInstallState(undefined)).toBe("unknown")
  })

  it("parses Intune report rows by column name", () => {
    const { rows } = parseReport({
      Schema: [{ Column: "DeviceId" }, { Column: "InstallState" }],
      Values: [[DEVICE_ID, "installed"]],
    })
    expect(rows).toEqual([{ DeviceId: DEVICE_ID, InstallState: "installed" }])
  })

  it("resolves the device object ID from the Entra device ID", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ value: [{ id: GROUP_ID }] }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await resolveDeviceObjectId(DEVICE_ID)).toBe(GROUP_ID)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(decodeURIComponent(url)).toContain(`deviceId eq '${DEVICE_ID}'`)
  })

  it("adds the device to the install group, tolerating 'already a member'", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    await addDeviceToGroup(GROUP_ID, DEVICE_ID)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://graph.microsoft.com/v1.0/groups/${GROUP_ID}/members/$ref`)
    expect(JSON.parse(init.body as string)).toEqual({ "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${DEVICE_ID}` })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "One or more added object references already exist" } }), { status: 400 })
      )
    )
    await expect(addDeviceToGroup(GROUP_ID, DEVICE_ID)).resolves.toBeUndefined()
  })

  it("treats removing a non-member as done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })))
    await expect(removeDeviceFromGroup(GROUP_ID, DEVICE_ID)).resolves.toBeUndefined()
  })

  it("rejects malformed IDs without calling Graph", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(addDeviceToGroup("not-a-guid", DEVICE_ID)).rejects.toMatchObject({ code: "not_found" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reads one device's install state from the report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            Schema: [{ Column: "DeviceId" }, { Column: "AppInstallState" }],
            Values: [
              ["00000000-0000-0000-0000-000000000000", 2],
              [DEVICE_ID.toUpperCase(), 1],
            ],
          }),
          { status: 200 }
        )
      )
    )
    expect(await getDeviceInstallState(APP_ID, DEVICE_ID)).toBe("installed")
  })
})
