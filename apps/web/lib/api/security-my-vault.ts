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
  access: "owner" | "edit" | "view"
}

export interface VaultSharedItem extends VaultItemSummary {
  access: "edit" | "view"
  ownerName: string | null
}

export interface ShareTargets {
  users: { id: string; name: string | null; email: string | null }[]
  groups: { id: string; name: string }[]
}

export interface ItemShare {
  id: string
  targetUserId: string | null
  targetGroupId: string | null
  targetName: string | null
  permission: "view" | "edit"
  expiresAt: string | null
  createdAt: string
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

export interface VaultHealth {
  total: number
  weak: number
  reused: number
  old: number
  maxAgeDays: number
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
      request<{
        folders: VaultFolder[]
        items: VaultItemSummary[]
        shared: VaultSharedItem[]
        health: VaultHealth
        encryptionKeyConfigured: boolean
      }>("/api/security/my-vault", undefined, "Failed to load the vault"),
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

// ============================================================================
// SHARING
// ============================================================================

export function useShareTargets() {
  return useQuery({
    queryKey: ["security-vault-share-targets"],
    queryFn: () => request<{ data: ShareTargets }>("/api/security/my-vault/share-targets", undefined, "Failed to load share targets"),
  })
}

export function useItemShares(itemId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["security-vault-item-shares", itemId],
    queryFn: () => request<{ data: ItemShare[] }>(`/api/security/my-vault/items/${itemId}/shares`, undefined, "Failed to load shares"),
    enabled: !!itemId && enabled,
  })
}

export function useShareItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...body }: { itemId: string; targetUserId?: string | null; targetGroupId?: string | null; permission: "view" | "edit"; expiresAt?: string | null }) =>
      request<{ data: ItemShare }>(
        `/api/security/my-vault/items/${itemId}/shares`,
        { method: "POST", body: JSON.stringify(body) },
        "Failed to share the item"
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["security-vault-item-shares", vars.itemId] })
      queryClient.invalidateQueries({ queryKey: keys.vault })
    },
  })
}

export function useRevokeShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId }: { shareId: string; itemId: string }) =>
      request<{ data: { id: string } }>(`/api/security/my-vault/shares/${shareId}`, { method: "DELETE" }, "Failed to revoke the share"),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["security-vault-item-shares", vars.itemId] })
      queryClient.invalidateQueries({ queryKey: keys.vault })
    },
  })
}
