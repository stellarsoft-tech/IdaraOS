/**
 * Device Policies API Client
 * React Query hooks for device groups and the policies applied to them.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PolicySettingValue, PolicyTypeDef } from "@/lib/security/device-policies"

// ============================================================================
// TYPES (mirror lib/security/policy-server.ts view types)
// ============================================================================

export interface PolicyGroupMemberView {
  id: string
  kind: "device" | "user"
  refId: string
  name: string
  detail: string | null
}

export interface PolicyView {
  id: string
  type: string
  name: string
  enabled: boolean
  settings: Record<string, PolicySettingValue>
}

export interface PolicyGroupView {
  id: string
  name: string
  description: string | null
  members: PolicyGroupMemberView[]
  policies: PolicyView[]
  deviceCount: number
  userCount: number
  createdAt: string
}

export interface PolicyPickerOptions {
  devices: Array<{ id: string; hostname: string; detail: string | null }>
  users: Array<{ id: string; name: string; email: string }>
}

export interface PolicyGroupsData {
  data: PolicyGroupView[]
  options: PolicyPickerOptions
  policyTypes: PolicyTypeDef[]
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

const GROUPS_KEY = ["security-policy-groups"] as const

// ============================================================================
// HOOKS
// ============================================================================

export function usePolicyGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => request<PolicyGroupsData>("/api/security/policies/groups", undefined, "Failed to load groups"),
  })
}

function usePolicyMutation<TVars, TResult = unknown>(
  build: (vars: TVars) => [string, RequestInit],
  fallbackError: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => request<TResult>(...build(vars), fallbackError),
    onSettled: () => queryClient.invalidateQueries({ queryKey: GROUPS_KEY }),
  })
}

export function useCreatePolicyGroup() {
  return usePolicyMutation<{ name: string; description?: string | null }>(
    (data) => ["/api/security/policies/groups", { method: "POST", body: JSON.stringify(data) }],
    "Failed to create the group"
  )
}

export function useUpdatePolicyGroup() {
  return usePolicyMutation<{ id: string; name?: string; description?: string | null }>(
    ({ id, ...data }) => [`/api/security/policies/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }],
    "Failed to update the group"
  )
}

export function useDeletePolicyGroup() {
  return usePolicyMutation<string>(
    (id) => [`/api/security/policies/groups/${id}`, { method: "DELETE" }],
    "Failed to delete the group"
  )
}

export function useAddGroupMember() {
  return usePolicyMutation<{ groupId: string; deviceId?: string; userId?: string }>(
    ({ groupId, ...body }) => [
      `/api/security/policies/groups/${groupId}/members`,
      { method: "POST", body: JSON.stringify(body) },
    ],
    "Failed to add the member"
  )
}

export function useRemoveGroupMember() {
  return usePolicyMutation<{ groupId: string; memberId: string }>(
    ({ groupId, memberId }) => [
      `/api/security/policies/groups/${groupId}/members?memberId=${encodeURIComponent(memberId)}`,
      { method: "DELETE" },
    ],
    "Failed to remove the member"
  )
}

export function useSetGroupPolicy() {
  return usePolicyMutation<{ groupId: string; type: string; enabled: boolean; settings?: Record<string, PolicySettingValue> }>(
    ({ groupId, ...body }) => [
      `/api/security/policies/groups/${groupId}/policies`,
      { method: "PUT", body: JSON.stringify(body) },
    ],
    "Failed to set the policy"
  )
}
