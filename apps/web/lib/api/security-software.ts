/**
 * Security Software API Client
 * React Query hooks for Approved Software (catalog) and Software Updates (IdaraOS Updater)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AgentJobStatus } from "@/lib/db/schema/security-agent"
import type {
  SoftwareAccess,
  SoftwareUpdateDeviceStatus,
  SoftwareUpdateMethod,
  SoftwareUpdatePackageResult,
  SoftwareUpdateRunStatus,
  SoftwareUpdateTrigger,
} from "@/lib/db/schema/security-software"

// ============================================================================
// TYPES
// ============================================================================

export interface CatalogApp {
  id: string
  name: string
  publisher: string | null
  description: string | null
  notes: string | null
  access: SoftwareAccess
  enabled: boolean
  wingetId: string | null
  updateMethod: SoftwareUpdateMethod
  autoUpdate: boolean
  vsWorkloads: string[]
  intuneAppId: string | null
  intuneAppName: string | null
  installGroupId: string | null
  installGroupName: string | null
  removeFromGroupAfterInstall: boolean
  installDeadlineHours: number
  createdAt: string
  updatedAt: string
}

export type CatalogAppInput = Omit<CatalogApp, "id" | "createdAt" | "updatedAt">

export interface IntuneApp {
  id: string
  name: string
  publisher: string | null
  type: string
  version: string | null
  groups: Array<{ groupId: string; groupName: string | null; intent: string }>
}

export interface UpdaterDevice {
  id: string
  assetId: string | null
  assetName: string | null
  assetTag: string | null
  entraDeviceId: string | null
  machineId: string | null
  hostname: string
  serialNumber: string | null
  osVersion: string | null
  updaterVersion: string | null
  wingetVersion: string | null
  status: SoftwareUpdateDeviceStatus
  enrolledAt: string
  lastSeenAt: string | null
  lastRunAt: string | null
  lastRunStatus: SoftwareUpdateRunStatus | null
  lastError: string | null
  // IdaraOS Agent: the member who linked the device, and the last signed-in Windows user
  linkedUserName: string | null
  lastLoggedOnUser: string | null
  runRequestedAt: string | null
  offline: boolean
  // IdaraOS Agent self-update
  agentUpdateRequestedAt: string | null
  agentUpdateAvailable: boolean
  // Location + compliance quarantine
  lastPublicIp: string | null
  nonCompliantSince: string | null
  quarantinedAt: string | null
  quarantineManual: boolean
}

export interface SoftwareUpdatesData {
  data: UpdaterDevice[]
  packages: Array<{ wingetId: string; name: string }>
  settings: {
    scheduleEnabled: boolean
    scheduleDays: number[]
    scheduleTime: string
    scheduleTimezone: string
    checkInMinutes: number
    agentAutoUpdate: boolean
    quarantineEnabled: boolean
    quarantineGraceDays: number
    releasedAgentVersion: string | null
    enrollmentTokenHint: string | null
    enrollmentTokenCreatedAt: string | null
    nextRunAt: string | null
  }
  stats: { devices: number; failing: number; offline: number }
}

export type DevicePolicyStatus = "compliant" | "error" | "pending"

export interface DevicePolicyCompliance {
  type: string
  name: string
  status: DevicePolicyStatus
  ok: boolean | null
  message: string | null
  reportedAt: string | null
  state: Record<string, unknown> | null
}

export interface DeviceInternetStatus {
  status: "compliant" | "grace" | "applying" | "quarantined"
  manual: boolean
  quarantineEnabled: boolean
  graceDays: number
  nonCompliantSince: string | null
  graceEndsAt: string | null
  hasIp: boolean
}

export interface PendingWipe {
  id: string
  status: "pending" | "sent" | "succeeded" | "failed" | "cancelled"
  queuedAt: string
  dispatchAt: string
  cancellable: boolean
}

export interface UpdaterDeviceDetail {
  data: UpdaterDevice
  compliance: DevicePolicyCompliance[]
  internet: DeviceInternetStatus
  pendingWipe: PendingWipe | null
}

export interface DeviceLocation {
  ip: string
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  source: string
}

export interface DeviceLocationResponse {
  data: DeviceLocation | null
  ip: string | null
}

export type ScheduleUpdate = Partial<
  Pick<
    SoftwareUpdatesData["settings"],
    | "scheduleEnabled"
    | "scheduleDays"
    | "scheduleTime"
    | "scheduleTimezone"
    | "checkInMinutes"
    | "agentAutoUpdate"
    | "quarantineEnabled"
    | "quarantineGraceDays"
  >
>

export interface UpdateRun {
  id: string
  deviceId: string
  hostname: string
  trigger: SoftwareUpdateTrigger
  requestedByName: string | null
  status: SoftwareUpdateRunStatus
  packages: string[]
  results: SoftwareUpdatePackageResult[]
  updatedCount: number
  failedCount: number
  rebootRequired: boolean
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface UpdateRunDetail extends UpdateRun {
  log: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

async function request<T>(url: string, init?: RequestInit, fallbackError = "Request failed"): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || fallbackError)
  }
  return res.json()
}

const keys = {
  catalog: ["security-software"] as const,
  intuneApps: (search: string) => ["security-software-intune-apps", search] as const,
  updates: ["security-software-updates"] as const,
  runs: (deviceId?: string, status?: string) => ["security-software-update-runs", deviceId ?? "", status ?? ""] as const,
  run: (id: string) => ["security-software-update-run", id] as const,
}

// ============================================================================
// APPROVED SOFTWARE
// ============================================================================

export function useSoftwareCatalog() {
  return useQuery({
    queryKey: keys.catalog,
    queryFn: () => request<{ data: CatalogApp[] }>("/api/security/software", undefined, "Failed to fetch approved software"),
  })
}

export function useIntuneApps(search: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.intuneApps(search),
    queryFn: () =>
      request<{ data: IntuneApp[] }>(
        `/api/security/software/intune-apps?search=${encodeURIComponent(search)}`,
        undefined,
        "Failed to list Intune apps"
      ),
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

export function useSaveCatalogApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CatalogAppInput> & { id?: string }) =>
      request<{ data: CatalogApp; warning: string | null }>(
        id ? `/api/security/software/${id}` : "/api/security/software",
        { method: id ? "PATCH" : "POST", body: JSON.stringify(data) },
        "Failed to save the app"
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.catalog })
      queryClient.invalidateQueries({ queryKey: keys.updates })
    },
  })
}

export function useDeleteCatalogApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => request(`/api/security/software/${id}`, { method: "DELETE" }, "Failed to delete the app"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.catalog })
      queryClient.invalidateQueries({ queryKey: keys.updates })
    },
  })
}

// ============================================================================
// SOFTWARE UPDATES
// ============================================================================

export function useSoftwareUpdates() {
  return useQuery({
    queryKey: keys.updates,
    queryFn: () => request<SoftwareUpdatesData>("/api/security/software-updates", undefined, "Failed to fetch devices"),
    refetchInterval: 60_000,
  })
}

export function useUpdaterDevice(id: string) {
  return useQuery({
    queryKey: ["security-software-device", id],
    queryFn: () =>
      request<UpdaterDeviceDetail>(`/api/security/software-updates/devices/${id}`, undefined, "Failed to fetch the device"),
    enabled: !!id,
    refetchInterval: 60_000,
  })
}

export function useDeviceLocation(id: string) {
  return useQuery({
    queryKey: ["device-location", id],
    queryFn: () =>
      request<DeviceLocationResponse>(
        `/api/security/software-updates/devices/${id}/location`,
        undefined,
        "Failed to locate the device"
      ),
    enabled: false,
  })
}

export function useLockDeviceInternet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/software-updates/devices/${id}/lock`, { method: "POST" }, "Failed to lock the device"),
    onSettled: (_data, _err, id) => queryClient.invalidateQueries({ queryKey: ["security-software-device", id] }),
  })
}

export function useUnlockDeviceInternet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/software-updates/devices/${id}/unlock`, { method: "POST" }, "Failed to unlock the device"),
    onSettled: (_data, _err, id) => queryClient.invalidateQueries({ queryKey: ["security-software-device", id] }),
  })
}

export function useWipeDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm: string }) =>
      request(
        `/api/security/software-updates/devices/${id}/wipe`,
        { method: "POST", body: JSON.stringify({ confirm }) },
        "Failed to queue the reset"
      ),
    onSettled: (_data, _err, vars) =>
      queryClient.invalidateQueries({ queryKey: ["security-software-device", vars.id] }),
  })
}

export function useCancelWipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/software-updates/devices/${id}/wipe`, { method: "DELETE" }, "Failed to cancel the reset"),
    onSettled: (_data, _err, id) => queryClient.invalidateQueries({ queryKey: ["security-software-device", id] }),
  })
}

export function useUpdateRuns(deviceId?: string, status?: string) {
  return useQuery({
    queryKey: keys.runs(deviceId, status),
    queryFn: () => {
      const params = new URLSearchParams()
      if (deviceId) params.set("deviceId", deviceId)
      if (status) params.set("status", status)
      return request<{ data: UpdateRun[] }>(
        `/api/security/software-updates/runs?${params.toString()}`,
        undefined,
        "Failed to fetch the update log"
      )
    },
    refetchInterval: 60_000,
  })
}

export function useUpdateRun(id: string | null) {
  return useQuery({
    queryKey: keys.run(id ?? ""),
    queryFn: () => request<{ data: UpdateRunDetail }>(`/api/security/software-updates/runs/${id}`, undefined, "Failed to fetch the run"),
    enabled: !!id,
  })
}

function useUpdatesMutation<TVars, TResult = unknown>(buildRequest: (vars: TVars) => [string, RequestInit], fallbackError: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => request<TResult>(...buildRequest(vars), fallbackError),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.updates })
      queryClient.invalidateQueries({ queryKey: ["security-software-update-runs"] })
    },
  })
}

export function useRunDeviceUpdate() {
  return useUpdatesMutation<string>(
    (id) => [`/api/security/software-updates/devices/${id}/run`, { method: "POST" }],
    "Failed to request updates"
  )
}

export function useRunAllUpdates() {
  return useUpdatesMutation<void, { data: { count: number } }>(
    () => ["/api/security/software-updates/run-all", { method: "POST" }],
    "Failed to request updates"
  )
}

export function useRevokeUpdaterDevice() {
  return useUpdatesMutation<string>(
    (id) => [`/api/security/software-updates/devices/${id}/revoke`, { method: "POST" }],
    "Failed to revoke the device"
  )
}

export function useUpdateDeviceAgent() {
  return useUpdatesMutation<string>(
    (id) => [`/api/security/software-updates/devices/${id}/update-agent`, { method: "POST" }],
    "Failed to request the agent update"
  )
}

export function useUpdateAllAgents() {
  return useUpdatesMutation<void, { data: { count: number } }>(
    () => ["/api/security/software-updates/update-all-agents", { method: "POST" }],
    "Failed to request agent updates"
  )
}

export interface DeviceActionJobEntry {
  id: string
  actionKey: string
  actionName: string
  param: string | null
  status: AgentJobStatus
  message: string | null
  log: string | null
  createdAt: string
  finishedAt: string | null
}

export function useDeviceActions(deviceId: string | null) {
  return useQuery({
    queryKey: ["security-device-actions", deviceId],
    queryFn: () =>
      request<{ data: DeviceActionJobEntry[] }>(
        `/api/security/software-updates/devices/${deviceId}/action`,
        undefined,
        "Failed to load device actions"
      ),
    enabled: !!deviceId,
    refetchInterval: 15_000,
  })
}

export function useQueueDeviceAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, param }: { id: string; action: string; param?: string | null }) =>
      request(
        `/api/security/software-updates/devices/${id}/action`,
        { method: "POST", body: JSON.stringify({ action, param: param ?? null }) },
        "Failed to queue the action"
      ),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["security-device-actions", vars.id] })
    },
  })
}

export interface BitlockerKeyEntry {
  id: string
  volume: string
  recoveryKeyId: string | null
  encryptionMethod: string | null
  protectionOn: boolean
  encryptionPercentage: number | null
  reportedAt: string
}

export function useBitlockerKeys(deviceId: string | null) {
  return useQuery({
    queryKey: ["security-bitlocker-keys", deviceId],
    queryFn: () =>
      request<{ data: BitlockerKeyEntry[]; encryptionKeyConfigured: boolean }>(
        `/api/security/software-updates/devices/${deviceId}/bitlocker-keys`,
        undefined,
        "Failed to load recovery keys"
      ),
    enabled: !!deviceId,
    refetchInterval: 30_000,
  })
}

/** Reveals a single recovery key (audited server-side). The decrypted key is never cached. */
export function useRevealBitlockerKey() {
  return useMutation({
    mutationFn: ({ deviceId, keyId }: { deviceId: string; keyId: string }) =>
      request<{ data: { volume: string; recoveryKey: string } }>(
        `/api/security/software-updates/devices/${deviceId}/bitlocker-keys/${keyId}/reveal`,
        { method: "POST" },
        "Failed to reveal the recovery key"
      ),
  })
}

export interface AdminCredentialEntry {
  accountName: string
  hasPassword: boolean
  lastStatus: string | null
  lastError: string | null
  rotatedAt: string | null
  reportedAt: string | null
  rotateRequestedAt: string | null
}

export function useDeviceAdminCredential(deviceId: string | null) {
  return useQuery({
    queryKey: ["security-device-admin-credential", deviceId],
    queryFn: () =>
      request<{ data: AdminCredentialEntry | null; encryptionKeyConfigured: boolean }>(
        `/api/security/software-updates/devices/${deviceId}/admin-credential`,
        undefined,
        "Failed to load the admin password"
      ),
    enabled: !!deviceId,
    refetchInterval: 30_000,
  })
}

/** Reveals the managed local admin password (audited server-side). The decrypted value is never cached. */
export function useRevealAdminCredential() {
  return useMutation({
    mutationFn: (deviceId: string) =>
      request<{ data: { accountName: string; password: string } }>(
        `/api/security/software-updates/devices/${deviceId}/admin-credential/reveal`,
        { method: "POST" },
        "Failed to reveal the admin password"
      ),
  })
}

/** Flags the device to rotate its managed admin password at the next check-in. */
export function useRotateAdminCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: string) =>
      request<{ data: { id: string; rotateRequested: boolean } }>(
        `/api/security/software-updates/devices/${deviceId}/admin-credential/rotate`,
        { method: "POST" },
        "Failed to request the rotation"
      ),
    onSuccess: (_data, deviceId) =>
      queryClient.invalidateQueries({ queryKey: ["security-device-admin-credential", deviceId] }),
  })
}

export function useUpdateSchedule() {
  return useUpdatesMutation<ScheduleUpdate>(
    (data) => ["/api/security/software-updates/settings", { method: "PATCH", body: JSON.stringify(data) }],
    "Failed to update the schedule"
  )
}

export function useCreateEnrollmentToken() {
  return useUpdatesMutation<void, { data: { token: string; createdAt: string } }>(
    () => ["/api/security/software-updates/enrollment-token", { method: "POST" }],
    "Failed to create the enrollment token"
  )
}
