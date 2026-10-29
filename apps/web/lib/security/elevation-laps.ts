/**
 * Windows LAPS via Microsoft Graph
 *
 * Required application permissions on the Entra app registration:
 * - DeviceLocalCredential.Read.All (read the password)
 * - DeviceManagementManagedDevices.PrivilegedOperations.All (rotate via Intune)
 *
 * Passwords returned here must never be stored or logged.
 */

import { getGraphAccessToken } from "@/lib/graph/client"

const GRAPH_URL = "https://graph.microsoft.com"

// Graph requires client identification headers on deviceLocalCredentials calls
const LAPS_HEADERS = {
  "ocp-client-name": "IdaraOS",
  "ocp-client-version": "1.0",
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// TYPES
// ============================================================================

export type LapsErrorCode = "not_configured" | "not_found" | "forbidden" | "graph_error"

export class LapsError extends Error {
  constructor(public code: LapsErrorCode, message: string) {
    super(message)
    this.name = "LapsError"
  }
}

export interface LapsCredentialEntry {
  accountName: string
  accountSid?: string
  backupDateTime: string
  passwordBase64: string
}

export interface LapsPassword {
  accountName: string
  password: string
  backupDateTime: string
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Entra keeps the current and previous LAPS passwords - the newest backup is the live one
 */
export function pickLatestCredential(entries: LapsCredentialEntry[] | undefined): LapsCredentialEntry | null {
  if (!entries || entries.length === 0) return null
  return entries.reduce((latest, entry) =>
    new Date(entry.backupDateTime).getTime() > new Date(latest.backupDateTime).getTime() ? entry : latest
  )
}

export function decodeLapsPassword(passwordBase64: string): string {
  return Buffer.from(passwordBase64, "base64").toString("utf8")
}

// ============================================================================
// GRAPH CALLS
// ============================================================================

async function graphFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getGraphAccessToken()
  if (!token) {
    throw new LapsError("not_configured", "Microsoft Entra integration is not configured")
  }

  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...LAPS_HEADERS, ...init?.headers },
  })

  if (response.ok) return response

  const body = await response.json().catch(() => ({}))
  const message: string = body?.error?.message || `Microsoft Graph returned ${response.status}`
  if (response.status === 404) {
    throw new LapsError("not_found", "No LAPS password is backed up in Entra for this device")
  }
  if (response.status === 401 || response.status === 403) {
    throw new LapsError("forbidden", `IdaraOS is not allowed to do this in Microsoft Graph: ${message}`)
  }
  throw new LapsError("graph_error", message)
}

function assertGuid(id: string, label: string) {
  if (!GUID_PATTERN.test(id)) {
    throw new LapsError("not_found", `${label} is not a valid ID`)
  }
}

/**
 * Fetch the current LAPS password for an Entra device
 */
export async function getLapsPassword(entraDeviceId: string): Promise<LapsPassword> {
  assertGuid(entraDeviceId, "Entra device ID")

  const response = await graphFetch(
    `${GRAPH_URL}/v1.0/directory/deviceLocalCredentials/${entraDeviceId}?$select=credentials`
  )
  const data: { credentials?: LapsCredentialEntry[] } = await response.json()

  const latest = pickLatestCredential(data.credentials)
  if (!latest) {
    throw new LapsError("not_found", "No LAPS password is backed up in Entra for this device")
  }

  return {
    accountName: latest.accountName,
    password: decodeLapsPassword(latest.passwordBase64),
    backupDateTime: latest.backupDateTime,
  }
}

/**
 * Time of the latest LAPS backup for an Entra device (does not read the password)
 */
export async function getLapsLastBackupAt(entraDeviceId: string): Promise<Date | null> {
  assertGuid(entraDeviceId, "Entra device ID")

  const response = await graphFetch(`${GRAPH_URL}/v1.0/directory/deviceLocalCredentials/${entraDeviceId}`)
  const data: { lastBackupDateTime?: string | null } = await response.json()
  return data.lastBackupDateTime ? new Date(data.lastBackupDateTime) : null
}

/**
 * Ask Intune to rotate the LAPS password. The device applies it at its next check-in.
 * (Graph beta endpoint - there is no v1.0 equivalent yet)
 */
export async function requestLapsRotation(intuneDeviceId: string): Promise<void> {
  assertGuid(intuneDeviceId, "Intune device ID")

  await graphFetch(
    `${GRAPH_URL}/beta/deviceManagement/managedDevices/${intuneDeviceId}/rotateLocalAdminPassword`,
    { method: "POST" }
  )
}
