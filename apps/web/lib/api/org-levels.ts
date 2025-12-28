/**
 * Organizational Levels API Client
 * React Query hooks for the Organizational Levels module
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Organizational Level type from API
export interface OrganizationalLevel {
  id: string
  name: string
  code: string
  description?: string
  sortOrder: number
  roleCount?: number
  createdAt: string
  updatedAt: string
}

// Create level payload
export interface CreateOrganizationalLevel {
  name: string
  code: string
  description?: string
  sortOrder?: number
}

// Update level payload
export interface UpdateOrganizationalLevel {
  name?: string
  code?: string
  description?: string | null
  sortOrder?: number
}

// Bulk update payload for reordering
export interface BulkUpdateOrganizationalLevels {
  updates: Array<{
    id: string
    name?: string
    code?: string
    description?: string | null
    sortOrder?: number
  }>
}

// Query keys
export const orgLevelsKeys = {
  all: ["org-levels"] as const,
  lists: () => [...orgLevelsKeys.all, "list"] as const,
  list: () => [...orgLevelsKeys.lists()] as const,
  details: () => [...orgLevelsKeys.all, "detail"] as const,
  detail: (id: string) => [...orgLevelsKeys.details(), id] as const,
}

// Base URL for API
const API_BASE = "/api/people/levels"

/**
 * Fetch all organizational levels
 */
async function fetchLevels(): Promise<OrganizationalLevel[]> {
  const res = await fetch(API_BASE)
  
  if (!res.ok) {
    throw new Error("Failed to fetch levels")
  }
  
  return res.json()
}

/**
 * Fetch a single level by ID
 */
async function fetchLevel(id: string): Promise<OrganizationalLevel | null> {
  const res = await fetch(`${API_BASE}/${id}`)
  
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error("Failed to fetch level")
  }
  
  return res.json()
}

/**
 * Create a new level
 */
async function createLevel(data: CreateOrganizationalLevel): Promise<OrganizationalLevel> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to create level")
  }
  
  return res.json()
}

/**
 * Update a level
 */
async function updateLevel(id: string, data: UpdateOrganizationalLevel): Promise<OrganizationalLevel> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to update level")
  }
  
  return res.json()
}

/**
 * Bulk update levels (for reordering)
 */
async function bulkUpdateLevels(data: BulkUpdateOrganizationalLevels): Promise<OrganizationalLevel[]> {
  const res = await fetch(API_BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to bulk update levels")
  }
  
  return res.json()
}

/**
 * Delete a level
 */
async function deleteLevel(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to delete level")
  }
}

// ============ React Query Hooks ============

/**
 * Hook to fetch organizational levels list
 */
export function useOrganizationalLevelsList() {
  return useQuery({
    queryKey: orgLevelsKeys.list(),
    queryFn: fetchLevels,
  })
}

/**
 * Hook to fetch a single organizational level
 */
export function useOrganizationalLevel(id: string | null | undefined) {
  return useQuery({
    queryKey: orgLevelsKeys.detail(id!),
    queryFn: () => fetchLevel(id!),
    enabled: !!id,
  })
}

/**
 * Hook to create an organizational level
 */
export function useCreateOrganizationalLevel() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createLevel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgLevelsKeys.lists() })
    },
  })
}

/**
 * Hook to update an organizational level
 */
export function useUpdateOrganizationalLevel() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrganizationalLevel }) => updateLevel(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orgLevelsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orgLevelsKeys.detail(id) })
    },
  })
}

/**
 * Hook to bulk update organizational levels (for reordering)
 */
export function useBulkUpdateOrganizationalLevels() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bulkUpdateLevels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgLevelsKeys.lists() })
    },
  })
}

/**
 * Hook to delete an organizational level
 */
export function useDeleteOrganizationalLevel() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteLevel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgLevelsKeys.lists() })
    },
  })
}

