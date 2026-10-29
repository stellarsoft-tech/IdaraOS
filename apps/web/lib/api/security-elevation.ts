/**
 * Security Endpoint Elevation API Client
 * React Query hooks for My Admin Access (employees) and Admin Access Approvals (approvers)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SoftwareAccess, SoftwareInstallStatus } from "@/lib/db/schema/security-software"
import type {
  ElevationGrantMode,
  ElevationGrantStatus,
  ElevationRequestStatus,
  ElevationRotationStatus,
} from "@/lib/db/schema/security-elevation"

// ============================================================================
// TYPES
// ============================================================================

export interface ElevationGrantSummary {
  id: string
  mode: ElevationGrantMode
  status: ElevationGrantStatus
  startsAt: string
  expiresAt: string
  endedAt: string | null
  revealCount: number
  rotationStatus: ElevationRotationStatus
}

export interface InstallSummary {
  status: SoftwareInstallStatus
  installedAt: string | null
}

export interface MyElevationRequest {
  id: string
  assetId: string | null
  deviceName: string
  catalogAppId: string | null
  appName: string | null
  requestedMinutes: number | null
  reason: string | null
  status: ElevationRequestStatus
  decisionNote: string | null
  decidedAt: string | null
  createdAt: string
  grant: ElevationGrantSummary | null
  install: InstallSummary | null
}

export interface MyElevationDevice {
  id: string
  name: string
  assetTag: string
  model: string | null
  intuneManaged: boolean
}

export interface MyCatalogApp {
  id: string
  name: string
  publisher: string | null
  description: string | null
  access: SoftwareAccess
  requestable: boolean
  companyPortalUrl: string | null
}

export interface MyElevationData {
  data: MyElevationRequest[]
  devices: MyElevationDevice[]
  catalog: MyCatalogApp[]
  options: {
    durationOptions: number[]
    requireReason: boolean
    maxRevealsPerGrant: number
  }
}

export interface ApproverGrantSummary extends ElevationGrantSummary {
  endReason: string | null
  lastRevealedAt: string | null
  rotationError: string | null
  rotationVerifiedAt: string | null
}

export interface ApproverElevationRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterEmail: string
  assetId: string | null
  deviceName: string
  catalogAppId: string | null
  appName: string | null
  installReady: boolean
  intuneManaged: boolean
  requestedMinutes: number | null
  reason: string | null
  status: ElevationRequestStatus
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
  isOwnRequest: boolean
  grant: ApproverGrantSummary | null
  install: ApproverInstallSummary | null
}

export interface ApproverInstallSummary extends InstallSummary {
  attempts: number
  groupAddedAt: string | null
  lastCheckedAt: string | null
  lastIntuneState: string | null
  error: string | null
}

export interface ApproverElevationData {
  data: ApproverElevationRequest[]
  stats: { pending: number; active: number; rotationIssues: number; installIssues: number }
  settings: { credentialModeEnabled: boolean; maxMinutes: number }
}

export interface ElevationSettingsData {
  id: string
  durationOptions: number[]
  maxMinutes: number
  requireReason: boolean
  credentialModeEnabled: boolean
  requireRecentAuth: boolean
  recentAuthMinutes: number
  maxRevealsPerGrant: number
  teamsWebhookConfigured: boolean
  updatedAt: string
}

export type ElevationSettingsUpdate = Partial<Omit<ElevationSettingsData, "id" | "updatedAt" | "teamsWebhookConfigured">> & {
  teamsWebhookUrl?: string | null
}

export interface RevealedCredential {
  accountName: string
  password: string
  deviceName: string
  expiresAt: string
  revealCount: number
}

/**
 * API error with the server's optional machine-readable code (e.g. "reauth_required")
 */
export class ElevationApiError extends Error {
  constructor(message: string, public code?: string, public reauthUrl?: string) {
    super(message)
    this.name = "ElevationApiError"
  }
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
    throw new ElevationApiError(body.error || fallbackError, body.code, body.reauthUrl)
  }
  return res.json()
}

const keys = {
  my: ["my-elevation"] as const,
  approvals: ["security-elevation-requests"] as const,
  settings: ["security-elevation-settings"] as const,
}

// Grants expire on the clock, so keep lists fresh
const REFRESH_MS = 30_000

// ============================================================================
// MY ADMIN ACCESS
// ============================================================================

export function useMyElevation() {
  return useQuery({
    queryKey: keys.my,
    queryFn: () => request<MyElevationData>("/api/security/my-elevation", undefined, "Failed to fetch your admin access"),
    refetchInterval: REFRESH_MS,
  })
}

export function useCreateElevationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      assetId: string
      catalogAppId?: string | null
      minutes?: number | null
      appName?: string | null
      reason?: string | null
    }) =>
      request("/api/security/my-elevation", { method: "POST", body: JSON.stringify(data) }, "Failed to create request"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.my })
    },
  })
}

export function useCancelElevationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/my-elevation/requests/${id}/cancel`, { method: "POST" }, "Failed to cancel request"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.my })
    },
  })
}

export function useRevealCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (grantId: string) =>
      request<{ data: RevealedCredential }>(
        `/api/security/my-elevation/grants/${grantId}/reveal`,
        { method: "POST" },
        "Failed to reveal the password"
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.my })
    },
  })
}

// ============================================================================
// APPROVALS
// ============================================================================

export function useElevationRequests() {
  return useQuery({
    queryKey: keys.approvals,
    queryFn: () => request<ApproverElevationData>("/api/security/elevation/requests", undefined, "Failed to fetch requests"),
    refetchInterval: REFRESH_MS,
  })
}

function useApprovalMutation<TVars>(buildRequest: (vars: TVars) => [string, RequestInit], fallbackError: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => request(...buildRequest(vars), fallbackError),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.approvals })
    },
  })
}

export function useApproveElevationRequest() {
  return useApprovalMutation<{ id: string; mode: ElevationGrantMode; minutes?: number | null; note?: string | null }>(
    ({ id, ...body }) => [`/api/security/elevation/requests/${id}/approve`, { method: "POST", body: JSON.stringify(body) }],
    "Failed to approve request"
  )
}

export function useDenyElevationRequest() {
  return useApprovalMutation<{ id: string; note?: string | null }>(
    ({ id, ...body }) => [`/api/security/elevation/requests/${id}/deny`, { method: "POST", body: JSON.stringify(body) }],
    "Failed to deny request"
  )
}

export function useRevokeElevationGrant() {
  return useApprovalMutation<{ id: string; reason?: string | null }>(
    ({ id, ...body }) => [`/api/security/elevation/grants/${id}/revoke`, { method: "POST", body: JSON.stringify(body) }],
    "Failed to revoke access"
  )
}

export function useRotateElevationGrant() {
  return useApprovalMutation<string>(
    (id) => [`/api/security/elevation/grants/${id}/rotate`, { method: "POST" }],
    "Failed to request rotation"
  )
}

export function useRetryInstall() {
  return useApprovalMutation<string>(
    (id) => [`/api/security/elevation/grants/${id}/retry-install`, { method: "POST" }],
    "Failed to retry the install"
  )
}

// ============================================================================
// SETTINGS
// ============================================================================

export function useElevationSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => request<{ data: ElevationSettingsData }>("/api/security/elevation/settings", undefined, "Failed to fetch settings"),
  })
}

export function useUpdateElevationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ElevationSettingsUpdate) =>
      request<{ data: ElevationSettingsData }>(
        "/api/security/elevation/settings",
        { method: "PATCH", body: JSON.stringify(data) },
        "Failed to update settings"
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.settings })
      queryClient.invalidateQueries({ queryKey: keys.approvals })
    },
  })
}
