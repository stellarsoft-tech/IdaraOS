/**
 * Organizational Roles API Client
 * React Query hooks for the Organizational Roles module
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Parent role info
export interface ParentRole {
  id: string
  name: string
  level: number
}

// Team info
export interface RoleTeam {
  id: string
  name: string
}

// Organizational Role type from API
export interface OrganizationalRole {
  id: string
  name: string
  description?: string
  teamId: string
  team: RoleTeam | null
  parentRoleId: string | null
  parentRole: ParentRole | null
  level: number
  sortOrder: number
  positionX: number
  positionY: number
  holderCount: number
  childCount: number
  createdAt: string
  updatedAt: string
}

// Create role payload - teamId is required
export interface CreateOrganizationalRole {
  name: string
  description?: string
  teamId: string
  parentRoleId?: string | null
  level?: number
  sortOrder?: number
  positionX?: number
  positionY?: number
}

// Update role payload
export interface UpdateOrganizationalRole {
  name?: string
  description?: string | null
  teamId?: string
  parentRoleId?: string | null
  level?: number
  sortOrder?: number
  positionX?: number
  positionY?: number
}

// Bulk update payload for designer
export interface BulkUpdateOrganizationalRoles {
  updates: Array<{
    id: string
    positionX?: number
    positionY?: number
    parentRoleId?: string | null
    teamId?: string
    level?: number
    sortOrder?: number
  }>
}

// Filter options
export interface OrganizationalRoleFilters {
  search?: string
  parentId?: string
  teamId?: string
  topLevelOnly?: boolean
}

// Query keys
export const orgRolesKeys = {
  all: ["org-roles"] as const,
  lists: () => [...orgRolesKeys.all, "list"] as const,
  list: (filters?: OrganizationalRoleFilters) => [...orgRolesKeys.lists(), filters] as const,
  details: () => [...orgRolesKeys.all, "detail"] as const,
  detail: (id: string) => [...orgRolesKeys.details(), id] as const,
}

// Base URL for API
const API_BASE = "/api/people/roles"

/**
 * Fetch all organizational roles with optional filters
 */
async function fetchRoles(filters?: OrganizationalRoleFilters): Promise<OrganizationalRole[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) {
    params.set("search", filters.search)
  }
  if (filters?.parentId) {
    params.set("parentId", filters.parentId)
  }
  if (filters?.teamId) {
    params.set("teamId", filters.teamId)
  }
  if (filters?.topLevelOnly) {
    params.set("topLevelOnly", "true")
  }
  
  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch roles")
  }
  
  return res.json()
}

/**
 * Fetch a single role by ID
 */
async function fetchRole(id: string): Promise<OrganizationalRole | null> {
  const res = await fetch(`${API_BASE}/${id}`)
  
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error("Failed to fetch role")
  }
  
  return res.json()
}

/**
 * Create a new role
 */
async function createRole(data: CreateOrganizationalRole): Promise<OrganizationalRole> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to create role")
  }
  
  return res.json()
}

/**
 * Update a role
 */
async function updateRole(id: string, data: UpdateOrganizationalRole): Promise<OrganizationalRole> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to update role")
  }
  
  return res.json()
}

/**
 * Bulk update roles (for designer)
 */
async function bulkUpdateRoles(data: BulkUpdateOrganizationalRoles): Promise<{ success: boolean; updatedCount: number }> {
  const res = await fetch(API_BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to bulk update roles")
  }
  
  return res.json()
}

/**
 * Delete a role
 */
async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to delete role")
  }
}

// ============ React Query Hooks ============

/**
 * Hook to fetch organizational roles list
 */
export function useOrganizationalRolesList(filters?: OrganizationalRoleFilters) {
  return useQuery({
    queryKey: orgRolesKeys.list(filters),
    queryFn: () => fetchRoles(filters),
  })
}

/**
 * Hook to fetch a single organizational role
 */
export function useOrganizationalRole(id: string | null | undefined) {
  return useQuery({
    queryKey: orgRolesKeys.detail(id!),
    queryFn: () => fetchRole(id!),
    enabled: !!id,
  })
}

/**
 * Hook to create an organizational role
 */
export function useCreateOrganizationalRole() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgRolesKeys.lists() })
    },
  })
}

/**
 * Hook to update an organizational role
 */
export function useUpdateOrganizationalRole() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrganizationalRole }) => updateRole(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orgRolesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orgRolesKeys.detail(id) })
    },
  })
}

/**
 * Hook to bulk update organizational roles (from designer)
 */
export function useBulkUpdateOrganizationalRoles() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bulkUpdateRoles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgRolesKeys.lists() })
    },
  })
}

/**
 * Hook to delete an organizational role
 */
export function useDeleteOrganizationalRole() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgRolesKeys.lists() })
    },
  })
}

