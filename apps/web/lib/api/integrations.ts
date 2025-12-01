/**
 * Integrations API - React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { usersKeys } from "./users"

// Query keys
export const integrationsKeys = {
  all: ["integrations"] as const,
  provider: (provider: string) => ["integrations", provider] as const,
}

// Types
export interface EntraIntegration {
  id?: string
  provider: "entra"
  status: "connected" | "disconnected" | "pending" | "error"
  tenantId: string | null
  clientId: string | null
  ssoEnabled: boolean
  passwordAuthDisabled: boolean
  scimEnabled: boolean
  scimEndpoint: string | null
  scimToken?: string // Only returned on create/update
  hasScimToken?: boolean
  scimGroupPrefix: string | null // Prefix to match group names to roles (e.g., "IdaraOS-")
  scimBidirectionalSync: boolean // If true, role changes in UI sync back to Entra groups
  syncPeopleEnabled: boolean // If true, creates Person records in People Directory during sync
  deletePeopleOnUserDelete: boolean // If true, deletes Person when their linked User is deleted
  settings?: Record<string, unknown> | null // Property mappings and other settings
  lastSyncAt: string | null
  syncedUserCount: number
  syncedGroupCount: number
  lastError?: string | null
  lastErrorAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SaveEntraConfig {
  provider: "entra"
  tenantId: string
  clientId: string
  clientSecret: string
  ssoEnabled?: boolean
  scimEnabled?: boolean
}

export interface UpdateEntraConfig {
  provider: "entra"
  ssoEnabled?: boolean
  passwordAuthDisabled?: boolean
  scimEnabled?: boolean
  scimGroupPrefix?: string
  scimBidirectionalSync?: boolean
  syncPeopleEnabled?: boolean
  deletePeopleOnUserDelete?: boolean
  settings?: Record<string, unknown>
}

// API functions
async function fetchEntraIntegration(): Promise<EntraIntegration> {
  const response = await fetch("/api/settings/integrations?provider=entra")
  if (!response.ok) {
    throw new Error("Failed to fetch integration")
  }
  return response.json()
}

// Custom error class to include validation details
export class IntegrationError extends Error {
  details?: string
  field?: string
  
  constructor(message: string, details?: string, field?: string) {
    super(message)
    this.name = "IntegrationError"
    this.details = details
    this.field = field
  }
}

async function saveEntraIntegration(data: SaveEntraConfig): Promise<EntraIntegration> {
  const response = await fetch("/api/settings/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new IntegrationError(
      error.error || "Failed to save integration",
      error.details,
      error.field
    )
  }
  return response.json()
}

async function updateEntraIntegration(data: UpdateEntraConfig): Promise<EntraIntegration> {
  const response = await fetch("/api/settings/integrations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update integration")
  }
  return response.json()
}

async function disconnectEntraIntegration(): Promise<void> {
  const response = await fetch("/api/settings/integrations?provider=entra", {
    method: "DELETE",
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to disconnect integration")
  }
}

async function regenerateScimToken(): Promise<{ scimToken: string }> {
  const response = await fetch("/api/settings/integrations/entra/regenerate-token", {
    method: "POST",
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to regenerate token")
  }
  return response.json()
}

export interface SyncStats {
  groupsFound: number
  groupsSynced: number
  groupsRemoved: number
  usersCreated: number
  usersUpdated: number
  usersDeleted: number
  peopleCreated: number
  peopleUpdated: number
  peopleDeleted: number
  rolesAssigned: number
  rolesRemoved: number
  errors: string[]
}

export interface SyncResult {
  success: boolean
  syncedUserCount: number
  syncedGroupCount: number
  lastSyncAt: string
  message: string
  stats?: SyncStats
}

async function triggerSync(): Promise<SyncResult> {
  const response = await fetch("/api/settings/integrations/entra/sync", {
    method: "POST",
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to sync")
  }
  return response.json()
}

// React Query hooks

/**
 * Get Entra integration configuration
 */
export function useEntraIntegration() {
  return useQuery({
    queryKey: integrationsKeys.provider("entra"),
    queryFn: fetchEntraIntegration,
    staleTime: 30000, // 30 seconds
  })
}

/**
 * Save/Connect Entra integration
 */
export function useSaveEntraIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveEntraIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationsKeys.provider("entra") })
    },
  })
}

/**
 * Update Entra integration settings (SSO/SCIM toggles)
 */
export function useUpdateEntraIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateEntraIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationsKeys.provider("entra") })
    },
  })
}

/**
 * Disconnect Entra integration
 */
export function useDisconnectEntraIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disconnectEntraIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationsKeys.provider("entra") })
    },
  })
}

/**
 * Regenerate SCIM token
 */
export function useRegenerateScimToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: regenerateScimToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationsKeys.provider("entra") })
    },
  })
}

/**
 * Trigger manual sync
 */
export function useTriggerSync() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      // Invalidate integrations query to update sync stats
      queryClient.invalidateQueries({ queryKey: integrationsKeys.provider("entra") })
      // Invalidate users list to refresh the table after sync
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      // Invalidate roles in case role assignments changed
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      // Invalidate people in case people records were created/updated/deleted
      queryClient.invalidateQueries({ queryKey: ["people"] })
    },
  })
}

// Entra Users types
export interface EntraUser {
  id: string
  name: string
  email: string
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  department: string | null
}

// Search Entra users
async function searchEntraUsers(search: string): Promise<EntraUser[]> {
  const response = await fetch(`/api/settings/integrations/entra/users?search=${encodeURIComponent(search)}`)
  if (!response.ok) {
    throw new Error("Failed to search Entra users")
  }
  const data = await response.json()
  return data.users || []
}

/**
 * Search Entra ID users (excludes already registered users)
 */
export function useSearchEntraUsers(search: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...integrationsKeys.provider("entra"), "users", search] as const,
    queryFn: () => searchEntraUsers(search),
    enabled: enabled && search.length >= 1,
    staleTime: 10000, // 10 seconds
  })
}

