/**
 * Vault Administration API client (RBAC security.vault) - org password policy + Security Audit.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { VaultEnforcement } from "@/lib/db/schema/security-vault"

export type { VaultEnforcement }

export interface VaultPolicy {
  id: string
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireDigit: boolean
  requireSymbol: boolean
  noReuse: boolean
  maxAgeDays: number
  enforcement: VaultEnforcement
  updatedAt: string
}

export type VaultPolicyInput = Partial<Omit<VaultPolicy, "id" | "updatedAt">>

export interface VaultComplianceRow {
  userId: string
  name: string | null
  email: string | null
  total: number
  weak: number
  reused: number
  old: number
}

export interface VaultComplianceSummary {
  rows: VaultComplianceRow[]
  totals: { users: number; total: number; weak: number; reused: number; old: number }
  maxAgeDays: number
}

async function request<T>(url: string, init?: RequestInit, errorMessage = "Request failed"): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string })?.error || errorMessage)
  return body as T
}

export function useVaultPolicy() {
  return useQuery({
    queryKey: ["security-vault-policy"],
    queryFn: () => request<{ data: VaultPolicy }>("/api/security/vault/settings", undefined, "Failed to load the policy"),
  })
}

export function useUpdateVaultPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VaultPolicyInput) =>
      request<{ data: VaultPolicy }>(
        "/api/security/vault/settings",
        { method: "PUT", body: JSON.stringify(input) },
        "Failed to update the policy"
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["security-vault-policy"] }),
  })
}

export function useVaultCompliance() {
  return useQuery({
    queryKey: ["security-vault-compliance"],
    queryFn: () =>
      request<{ data: VaultComplianceSummary }>("/api/security/vault/compliance", undefined, "Failed to load the Security Audit"),
  })
}

// ============================================================================
// GROUPS
// ============================================================================

export interface VaultGroup {
  id: string
  name: string
  memberCount: number
  createdAt: string
}

export interface VaultGroupMember {
  userId: string
  name: string | null
  email: string | null
}

const groupsKey = ["security-vault-groups"]

export function useVaultGroups() {
  return useQuery({
    queryKey: groupsKey,
    queryFn: () => request<{ data: VaultGroup[] }>("/api/security/vault/groups", undefined, "Failed to load groups"),
  })
}

export function useCreateVaultGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      request<{ data: VaultGroup }>("/api/security/vault/groups", { method: "POST", body: JSON.stringify({ name }) }, "Failed to create the group"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupsKey }),
  })
}

export function useRenameVaultGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      request(`/api/security/vault/groups/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }, "Failed to rename the group"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupsKey }),
  })
}

export function useDeleteVaultGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => request(`/api/security/vault/groups/${id}`, { method: "DELETE" }, "Failed to delete the group"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupsKey }),
  })
}

export function useGroupMembers(groupId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["security-vault-group-members", groupId],
    queryFn: () => request<{ data: VaultGroupMember[] }>(`/api/security/vault/groups/${groupId}/members`, undefined, "Failed to load members"),
    enabled: !!groupId && enabled,
  })
}

export function useAddGroupMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      request(`/api/security/vault/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ userId }) }, "Failed to add the member"),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["security-vault-group-members", vars.groupId] })
      queryClient.invalidateQueries({ queryKey: groupsKey })
    },
  })
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      request(`/api/security/vault/groups/${groupId}/members`, { method: "DELETE", body: JSON.stringify({ userId }) }, "Failed to remove the member"),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["security-vault-group-members", vars.groupId] })
      queryClient.invalidateQueries({ queryKey: groupsKey })
    },
  })
}
