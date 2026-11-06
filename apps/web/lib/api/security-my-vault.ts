/**
 * Password Vault API client - React Query hooks for the signed-in user's personal vault.
 *
 * The list returns metadata only; opening an item fetches its decrypted secrets from the audited
 * reveal endpoint. Decrypted values are never cached (gcTime/staleTime 0) so they don't linger in
 * the query cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { VaultItemType } from "@/lib/db/schema/security-vault"

export type { VaultItemType }

// ============================================================================
// TYPES (mirror the JSON shapes from lib/security/vault-server.ts)
// ============================================================================

export interface VaultFolder {
  id: string
  name: string
  parentFolderId: string | null
  createdAt: string
  updatedAt: string
}

export interface VaultItemSummary {
  id: string
  type: VaultItemType
  title: string
  username: string | null
  url: string | null
  favorite: boolean
  folderId: string | null
  hasPassword: boolean
  hasNotes: boolean
  lastPasswordChangeAt: string | null
  createdAt: string
  updatedAt: string
}

export interface VaultItemDetail extends VaultItemSummary {
  password: string | null
  notes: string | null
  extra: Record<string, unknown> | null
}

export interface VaultHistoryEntry {
  id: string
  password: string
  changedAt: string
}

export interface VaultItemInput {
  type?: VaultItemType
  title: string
  username?: string | null
  url?: string | null
  favorite?: boolean
  folderId?: string | null
  password?: string | null
  notes?: string | null
  extra?: Record<string, unknown> | null
}

// ============================================================================
// FETCH HELPER
// ============================================================================

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

const keys = {
  vault: ["security-my-vault"] as const,
  item: (id: string) => ["security-my-vault-item", id] as const,
  history: (id: string) => ["security-my-vault-item-history", id] as const,
}

// ============================================================================
// QUERIES
// ============================================================================

export function useVault() {
  return useQuery({
    queryKey: keys.vault,
    queryFn: () =>
      request<{ folders: VaultFolder[]; items: VaultItemSummary[]; encryptionKeyConfigured: boolean }>(
        "/api/security/my-vault",
        undefined,
        "Failed to load the vault"
      ),
  })
}

/** Fetches one item WITH its decrypted secrets (audited server-side). Not cached. */
export function useVaultItem(id: string | null) {
  return useQuery({
    queryKey: id ? keys.item(id) : ["security-my-vault-item", "none"],
    queryFn: () =>
      request<{ data: VaultItemDetail }>(`/api/security/my-vault/items/${id}`, undefined, "Failed to load the item"),
    enabled: !!id,
    gcTime: 0,
    staleTime: 0,
  })
}

/** Fetches decrypted password history for an item (audited server-side). Not cached. */
export function useVaultItemHistory(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: id ? keys.history(id) : ["security-my-vault-item-history", "none"],
    queryFn: () =>
      request<{ data: VaultHistoryEntry[] }>(
        `/api/security/my-vault/items/${id}/history`,
        undefined,
        "Failed to load the history"
      ),
    enabled: !!id && enabled,
    gcTime: 0,
    staleTime: 0,
  })
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useCreateVaultItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VaultItemInput) =>
      request<{ data: VaultItemSummary }>(
        "/api/security/my-vault/items",
        { method: "POST", body: JSON.stringify(input) },
        "Failed to save the item"
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.vault }),
  })
}

export function useUpdateVaultItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<VaultItemInput> & { id: string }) =>
      request<{ data: VaultItemSummary }>(
        `/api/security/my-vault/items/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
        "Failed to update the item"
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: keys.vault })
      queryClient.invalidateQueries({ queryKey: keys.item(vars.id) })
      queryClient.invalidateQueries({ queryKey: keys.history(vars.id) })
    },
  })
}

export function useDeleteVaultItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request<{ data: { id: string } }>(`/api/security/my-vault/items/${id}`, { method: "DELETE" }, "Failed to delete the item"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.vault }),
  })
}

export function useCreateVaultFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; parentFolderId?: string | null }) =>
      request<{ data: VaultFolder }>(
        "/api/security/my-vault/folders",
        { method: "POST", body: JSON.stringify(input) },
        "Failed to create the folder"
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.vault }),
  })
}

export function useRenameVaultFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      request<{ data: VaultFolder }>(
        `/api/security/my-vault/folders/${id}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
        "Failed to rename the folder"
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.vault }),
  })
}

export function useDeleteVaultFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request<{ data: { id: string } }>(`/api/security/my-vault/folders/${id}`, { method: "DELETE" }, "Failed to delete the folder"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.vault }),
  })
}
