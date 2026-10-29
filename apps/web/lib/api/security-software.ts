/**
 * Security Software API Client
 * React Query hooks for Approved Software (catalog) and Software Updates (IdaraOS Updater)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  entraDeviceId: string
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
  runRequestedAt: string | null
  offline: boolean
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
    enrollmentTokenHint: string | null
    enrollmentTokenCreatedAt: string | null
    nextRunAt: string | null
  }
  stats: { devices: number; failing: number; offline: number }
}

export type ScheduleUpdate = Partial<
  Pick<SoftwareUpdatesData["settings"], "scheduleEnabled" | "scheduleDays" | "scheduleTime" | "scheduleTimezone" | "checkInMinutes">
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
