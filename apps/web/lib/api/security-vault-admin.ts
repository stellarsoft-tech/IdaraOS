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
