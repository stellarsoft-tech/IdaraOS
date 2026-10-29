/**
 * Intune app installs via Microsoft Graph
 * Approved installs work by adding the device to the app's Required-assigned install group.
 *
 * Required application permissions on the Entra app registration:
 * - DeviceManagementApps.Read.All (list apps and assignments, install status report)
 * - Device.Read.All (resolve the device's directory object ID)
 * - GroupMember.ReadWrite.All (add / remove the device in install groups)
 * - DeviceManagementManagedDevices.PrivilegedOperations.All (syncDevice - already granted for LAPS rotation)
 */

import { getGraphAccessToken } from "@/lib/graph/client"
import { mapIntuneInstallState, type IntuneInstallState } from "./software"

const GRAPH_URL = "https://graph.microsoft.com"

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// TYPES
// ============================================================================

export type IntuneErrorCode = "not_configured" | "not_found" | "forbidden" | "graph_error"

export class IntuneError extends Error {
  constructor(public code: IntuneErrorCode, message: string) {
    super(message)
    this.name = "IntuneError"
  }
}

export interface IntuneAppAssignmentGroup {
  groupId: string
  groupName: string | null
  intent: string
}

export interface IntuneApp {
  id: string
  name: string
  publisher: string | null
  type: string
  version: string | null
  groups: IntuneAppAssignmentGroup[]
}

interface GraphMobileApp {
  id: string
  displayName: string
  publisher?: string | null
  displayVersion?: string | null
  "@odata.type"?: string
  assignments?: Array<{
    intent: string
    target?: { "@odata.type"?: string; groupId?: string }
  }>
}

// ============================================================================
// GRAPH CALLS
// ============================================================================

async function graphFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getGraphAccessToken()
  if (!token) {
    throw new IntuneError("not_configured", "Microsoft Entra integration is not configured")
  }

  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  if (response.ok) return response

  const body = await response.json().catch(() => ({}))
  const message: string = body?.error?.message || `Microsoft Graph returned ${response.status}`
  if (response.status === 404) throw new IntuneError("not_found", message)
  if (response.status === 401 || response.status === 403) {
    throw new IntuneError("forbidden", `IdaraOS is not allowed to do this in Microsoft Graph: ${message}`)
  }
  // Adding a member that's already there is not an error for us
  if (response.status === 400 && /already exist/i.test(message)) {
    return new Response(null, { status: 204 })
  }
  throw new IntuneError("graph_error", message)
}

function assertGuid(id: string, label: string) {
  if (!GUID_PATTERN.test(id)) {
    throw new IntuneError("not_found", `${label} is not a valid ID`)
  }
}

/**
 * Windows apps in Intune (Win32 and Microsoft Store "new") with their group assignments
 */
export async function listIntuneApps(search?: string): Promise<IntuneApp[]> {
  const filter = "(isof('microsoft.graph.win32LobApp') or isof('microsoft.graph.winGetApp'))"
  let url: string | null =
    `${GRAPH_URL}/beta/deviceAppManagement/mobileApps?$filter=${encodeURIComponent(filter)}&$expand=assignments`

  const apps: GraphMobileApp[] = []
  // Follow paging, capped so a huge tenant can't stall the request
  for (let page = 0; url && page < 10; page++) {
    const response = await graphFetch(url)
    const data: { value?: GraphMobileApp[]; "@odata.nextLink"?: string } = await response.json()
    apps.push(...(data.value ?? []))
    url = data["@odata.nextLink"] ?? null
  }

  const term = search?.trim().toLowerCase()
  const matching = term
    ? apps.filter((a) => a.displayName.toLowerCase().includes(term) || a.publisher?.toLowerCase().includes(term))
    : apps

  const groupIds = new Set<string>()
  for (const app of matching) {
    for (const assignment of app.assignments ?? []) {
      if (assignment.target?.groupId) groupIds.add(assignment.target.groupId)
    }
  }
  const groupNames = await getGroupNames([...groupIds])

  return matching
    .map((app) => ({
      id: app.id,
      name: app.displayName,
      publisher: app.publisher ?? null,
      type: app["@odata.type"] === "#microsoft.graph.winGetApp" ? "Microsoft Store" : "Win32",
      version: app.displayVersion ?? null,
      groups: (app.assignments ?? [])
        .filter((a) => a.target?.groupId)
        .map((a) => ({
          groupId: a.target!.groupId!,
          groupName: groupNames.get(a.target!.groupId!) ?? null,
          intent: a.intent,
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function getGroupNames(groupIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  await Promise.all(
    groupIds.filter((id) => GUID_PATTERN.test(id)).map(async (id) => {
      try {
        const response = await graphFetch(`${GRAPH_URL}/v1.0/groups/${id}?$select=id,displayName`)
        const group: { displayName?: string } = await response.json()
        if (group.displayName) names.set(id, group.displayName)
      } catch {
        // Group may have been deleted - show the ID instead
      }
    })
  )
  return names
}

/**
 * Required-assignment groups of one Intune app (to validate a catalog entry)
 */
export async function getRequiredGroupIds(intuneAppId: string): Promise<string[]> {
  assertGuid(intuneAppId, "Intune app ID")
  const response = await graphFetch(`${GRAPH_URL}/beta/deviceAppManagement/mobileApps/${intuneAppId}/assignments`)
  const data: { value?: GraphMobileApp["assignments"] } = await response.json()
  return (data.value ?? [])
    .filter((a) => a.intent === "required" && a.target?.groupId)
    .map((a) => a.target!.groupId!)
}

/**
 * Entra directory object ID for a device (group membership needs this, not the device ID)
 */
export async function resolveDeviceObjectId(entraDeviceId: string): Promise<string> {
  assertGuid(entraDeviceId, "Entra device ID")
  const filter = encodeURIComponent(`deviceId eq '${entraDeviceId}'`)
  const response = await graphFetch(`${GRAPH_URL}/v1.0/devices?$filter=${filter}&$select=id`)
  const data: { value?: Array<{ id: string }> } = await response.json()
  const objectId = data.value?.[0]?.id
  if (!objectId) {
    throw new IntuneError("not_found", "Device not found in Entra ID")
  }
  return objectId
}

export async function addDeviceToGroup(groupId: string, deviceObjectId: string): Promise<void> {
  assertGuid(groupId, "Group ID")
  assertGuid(deviceObjectId, "Device object ID")
  await graphFetch(`${GRAPH_URL}/v1.0/groups/${groupId}/members/$ref`, {
    method: "POST",
    body: JSON.stringify({ "@odata.id": `${GRAPH_URL}/v1.0/directoryObjects/${deviceObjectId}` }),
  })
}

export async function removeDeviceFromGroup(groupId: string, deviceObjectId: string): Promise<void> {
  assertGuid(groupId, "Group ID")
  assertGuid(deviceObjectId, "Device object ID")
  try {
    await graphFetch(`${GRAPH_URL}/v1.0/groups/${groupId}/members/${deviceObjectId}/$ref`, { method: "DELETE" })
  } catch (error) {
    // Already removed
    if (error instanceof IntuneError && error.code === "not_found") return
    throw error
  }
}

/**
 * Ask the device to check in with Intune now, so a new Required assignment installs in minutes
 */
export async function syncDevice(intuneDeviceId: string): Promise<void> {
  assertGuid(intuneDeviceId, "Intune device ID")
  await graphFetch(`${GRAPH_URL}/v1.0/deviceManagement/managedDevices/${intuneDeviceId}/syncDevice`, {
    method: "POST",
  })
}

/**
 * Install state of an app on one device, from the Intune device install status report (beta).
 * Column names are read from the report schema, so minor report changes don't break parsing.
 */
export async function getDeviceInstallState(intuneAppId: string, intuneDeviceId: string): Promise<IntuneInstallState> {
  assertGuid(intuneAppId, "Intune app ID")
  assertGuid(intuneDeviceId, "Intune device ID")

  const pageSize = 500
  for (let skip = 0; skip < 5000; skip += pageSize) {
    const response = await graphFetch(`${GRAPH_URL}/beta/deviceManagement/reports/getDeviceInstallStatusReport`, {
      method: "POST",
      body: JSON.stringify({ filter: `(ApplicationId eq '${intuneAppId}')`, top: pageSize, skip }),
    })
    const report = parseReport(await response.json())
    const row = report.rows.find((r) => String(r.DeviceId ?? "").toLowerCase() === intuneDeviceId.toLowerCase())
    if (row) {
      return mapIntuneInstallState(row.InstallState ?? row.AppInstallState_loc ?? row.AppInstallState)
    }
    if (report.rows.length < pageSize) break
  }
  return "unknown"
}

/**
 * Intune reports return { Schema: [{ Column }], Values: [[...]] }
 */
export function parseReport(body: unknown): { rows: Array<Record<string, unknown>> } {
  const data = body as { Schema?: Array<{ Column: string }>; Values?: unknown[][] }
  const columns = (data?.Schema ?? []).map((c) => c.Column)
  const rows = (data?.Values ?? []).map((values) =>
    Object.fromEntries(columns.map((column, i) => [column, values[i]]))
  )
  return { rows }
}
