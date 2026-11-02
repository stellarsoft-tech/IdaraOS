/**
 * IdaraOS Agent - pure helpers (no database access)
 * Pairing codes, job limits and winget install exit codes.
 */

import { randomInt } from "crypto"
import type { AgentJobResult } from "@/lib/db/schema"

// ============================================================================
// PAIRING
// ============================================================================

/** How long a pairing code shown by the agent stays valid */
export const PAIRING_TTL_MINUTES = 15

/** How often the agent polls while waiting for the code to be entered */
export const PAIRING_POLL_SECONDS = 5

/** Wrong codes a user may enter per pairing window before being told to wait */
export const MAX_LINK_ATTEMPTS_PER_WINDOW = 10

// No 0/O, 1/I/L, 5/S, 2/Z - easy to read aloud and type from another screen
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRTUVWXY346789"

/**
 * A new user code, e.g. "KFJD-7QWX"
 */
export function generateUserCode(): string {
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Normalize what a user typed ("kfjd 7qwx", "KFJD7QWX") to the stored form, or null if it can't be a code
 */
export function normalizeUserCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "")
  if (compact.length !== 8) return null
  for (const ch of compact) {
    if (!USER_CODE_ALPHABET.includes(ch)) return null
  }
  return `${compact.slice(0, 4)}-${compact.slice(4)}`
}

/** Page where the member enters the code (the agent prefixes its server URL) */
export const LINK_DEVICE_PATH = "/security/my-elevation/link"

/** Windows MachineGuid */
export const MACHINE_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Asset tag for a device created by agent pairing
 */
export function agentAssetTag(machineId: string): string {
  return `AGT-${machineId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

// ============================================================================
// JOBS
// ============================================================================

/** Times a job is handed to a device before it is failed */
export const MAX_JOB_ATTEMPTS = 3

/** A sent job with no result after this long is sent again */
export const JOB_RESEND_MINUTES = 90

/**
 * Whether a sent job should be handed to the device again (it never reported)
 */
export function isJobDueForResend(sentAt: Date | null, now: Date): boolean {
  if (!sentAt) return true
  return now.getTime() - sentAt.getTime() >= JOB_RESEND_MINUTES * 60_000
}

// winget exit codes (APPINSTALLER_CLI_ERROR_*), as signed 32-bit values
const EXIT_ALREADY_INSTALLED = -1978334963 // 0x8A15010D
const EXIT_REBOOT_TO_FINISH = -1978334967 // 0x8A150109
const EXIT_REBOOT_INITIATED = -1978334965 // 0x8A15010B
const EXIT_NO_PACKAGE_FOUND = -1978335212 // 0x8A150014
const EXIT_PACKAGE_IN_USE = -1978334975 // 0x8A150101
// winget.exe couldn't start (STATUS_DLL_NOT_FOUND): the Visual C++ runtime is missing for SYSTEM
const EXIT_DLL_NOT_FOUND = -1073741515 // 0xC0000135

export interface InstallOutcome {
  succeeded: boolean
  rebootRequired: boolean
  message: string
}

/**
 * What a `winget install` exit code means for an approved install
 */
export function interpretInstallExitCode(exitCode: number | null | undefined): InstallOutcome {
  switch (exitCode) {
    case 0:
      return { succeeded: true, rebootRequired: false, message: "Installed" }
    case EXIT_ALREADY_INSTALLED:
      return { succeeded: true, rebootRequired: false, message: "Already installed" }
    case EXIT_REBOOT_TO_FINISH:
    case EXIT_REBOOT_INITIATED:
      return { succeeded: true, rebootRequired: true, message: "Installed - restart needed to finish" }
    case EXIT_NO_PACKAGE_FOUND:
      return { succeeded: false, rebootRequired: false, message: "winget couldn't find this package ID" }
    case EXIT_PACKAGE_IN_USE:
      return { succeeded: false, rebootRequired: false, message: "The app is in use - close it and retry" }
    case EXIT_DLL_NOT_FOUND:
      return {
        succeeded: false,
        rebootRequired: false,
        message: "winget couldn't start: the Visual C++ runtime is missing on the device. Re-run the agent installer.",
      }
    case null:
    case undefined:
      return { succeeded: false, rebootRequired: false, message: "The agent didn't report an exit code" }
    default:
      return {
        succeeded: false,
        rebootRequired: false,
        message: `winget exited with 0x${(exitCode >>> 0).toString(16).toUpperCase().padStart(8, "0")}`,
      }
  }
}

/**
 * The job result to store for an install the agent reported
 */
export function installJobResult(exitCode: number | null | undefined, agentMessage?: string | null): AgentJobResult & { succeeded: boolean } {
  const outcome = interpretInstallExitCode(exitCode)
  return {
    succeeded: outcome.succeeded,
    exitCode: exitCode ?? null,
    rebootRequired: outcome.rebootRequired,
    message: agentMessage?.trim() || outcome.message,
  }
}
