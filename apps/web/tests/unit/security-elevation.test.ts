import { afterEach, describe, it, expect, vi } from "vitest"
import {
  allowedDurations,
  checkApproval,
  checkCanDecide,
  checkRequestedMinutes,
  checkReveal,
  computeGrantWindow,
  formatMinutes,
  isGrantLive,
  isRotationVerified,
  needsRecentAuth,
  normalizeDurationOptions,
  rotationStatusAfterEnd,
  type ApprovalInput,
  type GrantState,
} from "../../lib/security/elevation"

vi.mock("@/lib/graph/client", () => ({
  getGraphAccessToken: vi.fn(async () => "test-token"),
}))

const { LapsError, decodeLapsPassword, getLapsPassword, pickLatestCredential, requestLapsRotation } = await import(
  "../../lib/security/elevation-laps"
)

const DEVICE_ID = "11111111-2222-3333-4444-555555555555"
const NOW = new Date("2026-10-29T10:00:00Z")

describe("formatMinutes", () => {
  it("formats minutes and hours", () => {
    expect(formatMinutes(15)).toBe("15 min")
    expect(formatMinutes(60)).toBe("1 h")
    expect(formatMinutes(90)).toBe("1 h 30 min")
    expect(formatMinutes(240)).toBe("4 h")
  })
})

describe("duration settings", () => {
  it("normalizes options: unique, sorted, within the cap", () => {
    expect(normalizeDurationOptions([60, 15, 15, 480, 0, 30.4], 240)).toEqual([15, 30, 60])
  })

  it("falls back to one option when none fit", () => {
    expect(allowedDurations({ durationOptions: [480], maxMinutes: 240 })).toEqual([15])
  })

  it("only accepts configured durations", () => {
    const settings = { durationOptions: [15, 30, 60], maxMinutes: 60 }
    expect(checkRequestedMinutes(30, settings).ok).toBe(true)
    expect(checkRequestedMinutes(45, settings).ok).toBe(false)
  })
})

describe("checkApproval", () => {
  const base: ApprovalInput = {
    request: { status: "pending", requesterId: "requester", requestedMinutes: 60 },
    deciderId: "approver",
    mode: "credentials",
    minutes: 30,
    settings: { credentialModeEnabled: true, maxMinutes: 240 },
    canUseCredentials: true,
  }

  it("allows a valid credentials approval", () => {
    expect(checkApproval(base)).toEqual({ ok: true })
  })

  it("blocks self-approval", () => {
    expect(checkApproval({ ...base, deciderId: "requester" })).toMatchObject({ ok: false, status: 403 })
  })

  it("blocks deciding twice", () => {
    expect(checkApproval({ ...base, request: { ...base.request, status: "approved" } })).toMatchObject({
      ok: false,
      status: 409,
    })
  })

  it("requires the credentials permission and the org toggle", () => {
    expect(checkApproval({ ...base, canUseCredentials: false })).toMatchObject({ ok: false, status: 403 })
    expect(
      checkApproval({ ...base, settings: { ...base.settings, credentialModeEnabled: false } })
    ).toMatchObject({ ok: false, status: 400 })
  })

  it("rejects elevate-app until the agent exists", () => {
    expect(checkApproval({ ...base, mode: "elevate_app" })).toMatchObject({ ok: false, status: 400 })
  })

  it("lets approvers shorten but never extend", () => {
    expect(checkApproval({ ...base, minutes: 60 }).ok).toBe(true)
    expect(checkApproval({ ...base, minutes: 61 }).ok).toBe(false)
    expect(checkApproval({ ...base, minutes: 0 }).ok).toBe(false)
    expect(checkApproval({ ...base, minutes: 60, settings: { ...base.settings, maxMinutes: 30 } }).ok).toBe(false)
  })

  it("checkCanDecide applies to deny as well", () => {
    expect(checkCanDecide({ status: "pending", requesterId: "a" }, "a").ok).toBe(false)
    expect(checkCanDecide({ status: "pending", requesterId: "a" }, "b").ok).toBe(true)
  })
})

describe("grants", () => {
  const grant: GrantState = {
    userId: "requester",
    mode: "credentials",
    status: "active",
    expiresAt: new Date(NOW.getTime() + 30 * 60_000),
    revealCount: 0,
  }

  it("computes the grant window", () => {
    const { startsAt, expiresAt } = computeGrantWindow(NOW, 30)
    expect(startsAt).toEqual(NOW)
    expect(expiresAt.toISOString()).toBe("2026-10-29T10:30:00.000Z")
  })

  it("is live only while active and unexpired", () => {
    expect(isGrantLive(grant, NOW)).toBe(true)
    expect(isGrantLive({ ...grant, expiresAt: NOW }, NOW)).toBe(false)
    expect(isGrantLive({ ...grant, status: "revoked" }, NOW)).toBe(false)
  })

  it("only lets the grantee reveal, while live, under the limit", () => {
    expect(checkReveal(grant, "requester", NOW, 5)).toEqual({ ok: true })
    expect(checkReveal(grant, "someone-else", NOW, 5)).toMatchObject({ ok: false, status: 404 })
    expect(checkReveal({ ...grant, mode: "elevate_app" }, "requester", NOW, 5)).toMatchObject({ ok: false, status: 400 })
    expect(checkReveal({ ...grant, status: "expired" }, "requester", NOW, 5)).toMatchObject({ ok: false, status: 410 })
    expect(checkReveal({ ...grant, revealCount: 5 }, "requester", NOW, 5)).toMatchObject({ ok: false, status: 429 })
  })

  it("requires a recent sign-in when configured", () => {
    const settings = { requireRecentAuth: true, recentAuthMinutes: 15 }
    const iat = (minutesAgo: number) => Math.floor(NOW.getTime() / 1000) - minutesAgo * 60
    expect(needsRecentAuth(settings, iat(5), NOW)).toBe(false)
    expect(needsRecentAuth(settings, iat(16), NOW)).toBe(true)
    expect(needsRecentAuth(settings, undefined, NOW)).toBe(true)
    expect(needsRecentAuth({ ...settings, requireRecentAuth: false }, undefined, NOW)).toBe(false)
  })

  it("rotates only passwords that were revealed", () => {
    expect(rotationStatusAfterEnd({ mode: "credentials", revealCount: 0 })).toBe("not_required")
    expect(rotationStatusAfterEnd({ mode: "credentials", revealCount: 2 })).toBe("pending")
    expect(rotationStatusAfterEnd({ mode: "elevate_app", revealCount: 0 })).toBe("not_required")
  })

  it("verifies rotation once a newer LAPS backup exists", () => {
    const revealed = new Date("2026-10-29T10:05:00Z")
    expect(isRotationVerified(new Date("2026-10-29T10:40:00Z"), revealed)).toBe(true)
    expect(isRotationVerified(new Date("2026-10-29T09:00:00Z"), revealed)).toBe(false)
    expect(isRotationVerified(null, revealed)).toBe(false)
  })
})

describe("LAPS", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("picks the newest backed-up credential and decodes it", () => {
    const latest = pickLatestCredential([
      { accountName: "laps", backupDateTime: "2026-10-01T00:00:00Z", passwordBase64: Buffer.from("old").toString("base64") },
      { accountName: "laps", backupDateTime: "2026-10-20T00:00:00Z", passwordBase64: Buffer.from("n3w!Pw").toString("base64") },
    ])
    expect(decodeLapsPassword(latest!.passwordBase64)).toBe("n3w!Pw")
    expect(pickLatestCredential([])).toBeNull()
  })

  it("requests credentials with the Graph client headers", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          credentials: [
            { accountName: "laps", backupDateTime: "2026-10-20T00:00:00Z", passwordBase64: Buffer.from("secret").toString("base64") },
          ],
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getLapsPassword(DEVICE_ID)
    expect(result).toEqual({ accountName: "laps", password: "secret", backupDateTime: "2026-10-20T00:00:00Z" })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://graph.microsoft.com/v1.0/directory/deviceLocalCredentials/${DEVICE_ID}?$select=credentials`)
    expect(init.headers).toMatchObject({ "ocp-client-name": "IdaraOS", Authorization: "Bearer test-token" })
  })

  it("maps Graph errors to LAPS error codes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 403 })))
    await expect(getLapsPassword(DEVICE_ID)).rejects.toMatchObject({ code: "forbidden" })

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })))
    await expect(getLapsPassword(DEVICE_ID)).rejects.toMatchObject({ code: "not_found" })
  })

  it("rejects malformed device IDs without calling Graph", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(getLapsPassword("../me")).rejects.toBeInstanceOf(LapsError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rotates via the Intune beta endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    await requestLapsRotation(DEVICE_ID)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://graph.microsoft.com/beta/deviceManagement/managedDevices/${DEVICE_ID}/rotateLocalAdminPassword`)
    expect(init.method).toBe("POST")
  })
})
