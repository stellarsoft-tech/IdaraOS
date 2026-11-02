import { describe, it, expect } from "vitest"
import {
  JOB_RESEND_MINUTES,
  MACHINE_ID_PATTERN,
  agentAssetTag,
  generateUserCode,
  installJobResult,
  interpretInstallExitCode,
  isJobDueForResend,
  normalizeUserCode,
} from "../../lib/security/agent"

describe("pairing codes", () => {
  it("generates XXXX-XXXX codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateUserCode()
      expect(code).toMatch(/^[A-Z3-9]{4}-[A-Z3-9]{4}$/)
      expect(code).not.toMatch(/[01OILSZ25]/)
      expect(normalizeUserCode(code)).toBe(code)
    }
  })

  it("normalizes what people type", () => {
    expect(normalizeUserCode("kfjd-7qwx")).toBe("KFJD-7QWX")
    expect(normalizeUserCode(" kfjd 7qwx ")).toBe("KFJD-7QWX")
    expect(normalizeUserCode("KFJD7QWX")).toBe("KFJD-7QWX")
  })

  it("rejects things that can't be codes", () => {
    expect(normalizeUserCode("")).toBeNull()
    expect(normalizeUserCode("KFJD-7QW")).toBeNull()
    expect(normalizeUserCode("KFJD-7QWXX")).toBeNull()
    // 0, O, 1, I are not in the alphabet
    expect(normalizeUserCode("K0JD-7QWX")).toBeNull()
    expect(normalizeUserCode("KIJD-7QWX")).toBeNull()
    expect(normalizeUserCode("KFJD-7QW'")).toBeNull()
  })
})

describe("device identity", () => {
  it("accepts a MachineGuid", () => {
    expect(MACHINE_ID_PATTERN.test("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true)
    expect(MACHINE_ID_PATTERN.test("not-a-guid")).toBe(false)
  })

  it("builds a short asset tag", () => {
    expect(agentAssetTag("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("AGT-3F2504E0")
  })
})

describe("jobs", () => {
  const now = new Date("2026-11-02T12:00:00Z")

  it("re-sends a job only after the resend window", () => {
    expect(isJobDueForResend(null, now)).toBe(true)
    expect(isJobDueForResend(new Date(now.getTime() - (JOB_RESEND_MINUTES - 1) * 60_000), now)).toBe(false)
    expect(isJobDueForResend(new Date(now.getTime() - JOB_RESEND_MINUTES * 60_000), now)).toBe(true)
  })

  it("maps winget install exit codes", () => {
    expect(interpretInstallExitCode(0)).toMatchObject({ succeeded: true, rebootRequired: false })
    // 0x8A15010D already installed
    expect(interpretInstallExitCode(-1978334963)).toMatchObject({ succeeded: true, message: "Already installed" })
    // 0x8A150109 reboot to finish
    expect(interpretInstallExitCode(-1978334967)).toMatchObject({ succeeded: true, rebootRequired: true })
    // 0x8A150014 no package found
    expect(interpretInstallExitCode(-1978335212)).toMatchObject({ succeeded: false })
    expect(interpretInstallExitCode(null)).toMatchObject({ succeeded: false })
    // 0xC0000135 winget couldn't start (Visual C++ runtime missing)
    expect(interpretInstallExitCode(-1073741515).message).toMatch(/Visual C\+\+ runtime/)
  })

  it("fails at once when retrying can't help", () => {
    // 0x8A150010 no machine-wide installer (per-user-only package)
    expect(interpretInstallExitCode(-1978335216)).toMatchObject({ succeeded: false, retryable: false })
    expect(interpretInstallExitCode(-1978335216).message).toMatch(/no machine-wide installer/)
    // 0x8A150014 no package found
    expect(interpretInstallExitCode(-1978335212)).toMatchObject({ succeeded: false, retryable: false })
    // Temporary problems are retried
    expect(interpretInstallExitCode(-1978334975)).toMatchObject({ retryable: true })
    expect(interpretInstallExitCode(-1073741515)).toMatchObject({ retryable: true })
    expect(interpretInstallExitCode(1603)).toMatchObject({ retryable: true })
    expect(installJobResult(-1978335216, null)).toMatchObject({ succeeded: false, retryable: false })
  })

  it("formats unknown exit codes as hex", () => {
    expect(interpretInstallExitCode(-1978335224).message).toBe("winget exited with 0x8A150008")
    expect(interpretInstallExitCode(1603).message).toBe("winget exited with 0x00000643")
  })

  it("prefers the agent's own message", () => {
    expect(installJobResult(null, "winget (App Installer) isn't installed")).toEqual({
      succeeded: false,
      retryable: true,
      exitCode: null,
      rebootRequired: false,
      message: "winget (App Installer) isn't installed",
    })
    expect(installJobResult(0, null).message).toBe("Installed")
  })
})
