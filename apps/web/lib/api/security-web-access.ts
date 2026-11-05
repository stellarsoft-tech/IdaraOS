/**
 * Website access API client
 * React Query hooks for the per-site request / approve exception flow on top of web filtering.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export type WebAccessStatus = "pending" | "approved" | "denied" | "cancelled" | "expired"

export interface MyWebAccessRequest {
  id: string
  domain: string
  reason: string | null
  requestedMinutes: number
  status: WebAccessStatus
  decisionNote: string | null
  decidedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface MyWebAccessData {
  data: MyWebAccessRequest[]
  options: { durationOptions: number[] }
}

export interface WebAccessApproval {
  id: string
  domain: string
  requesterName: string | null
  requesterEmail: string | null
  reason: string | null
  requestedMinutes: number
  status: WebAccessStatus
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  expiresAt: string | null
  createdAt: string
}

export interface WebAccessApprovalsData {
  data: WebAccessApproval[]
  stats: { pending: number }
  options: { durationOptions: number[] }
}

async function request<T>(url: string, init?: RequestInit, fallbackError = "Request failed"): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? fallbackError)
  }
  return res.json()
}

const MY_KEY = ["web-access-my"]
const ADMIN_KEY = ["web-access-admin"]

export function useMyWebAccess() {
  return useQuery({ queryKey: MY_KEY, queryFn: () => request<MyWebAccessData>("/api/security/web-access/my") })
}

export function useCreateWebAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { domain: string; minutes: number; reason?: string | null }) =>
      request("/api/security/web-access/my", { method: "POST", body: JSON.stringify(body) }, "Failed to create request"),
    onSettled: () => qc.invalidateQueries({ queryKey: MY_KEY }),
  })
}

export function useCancelWebAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/web-access/my/${id}`, { method: "DELETE" }, "Failed to cancel the request"),
    onSettled: () => qc.invalidateQueries({ queryKey: MY_KEY }),
  })
}

export function useWebAccessApprovals() {
  return useQuery({ queryKey: ADMIN_KEY, queryFn: () => request<WebAccessApprovalsData>("/api/security/web-access") })
}

export function useApproveWebAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; minutes?: number | null; note?: string | null }) =>
      request(`/api/security/web-access/${id}/approve`, { method: "POST", body: JSON.stringify(body) }, "Failed to approve"),
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_KEY }),
  })
}

export function useDenyWebAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; note?: string | null }) =>
      request(`/api/security/web-access/${id}/deny`, { method: "POST", body: JSON.stringify(body) }, "Failed to deny"),
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_KEY }),
  })
}
