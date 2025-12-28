/**
 * Teams API Client
 * React Query hooks for the Teams module
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Lead info
export interface TeamLead {
  id: string
  name: string
  email: string
  slug: string
}

// Parent team info
export interface ParentTeam {
  id: string
  name: string
}

// Team type from API
export interface Team {
  id: string
  name: string
  description?: string
  leadId: string | null
  lead: TeamLead | null
  parentTeamId: string | null
  parentTeam: ParentTeam | null
  sortOrder: number
  memberCount: number
  childCount: number
  createdAt: string
  updatedAt: string
}

// Create team payload
export interface CreateTeam {
  name: string
  description?: string
  leadId?: string | null
  parentTeamId?: string | null
  sortOrder?: number
}

// Update team payload
export interface UpdateTeam {
  name?: string
  description?: string | null
  leadId?: string | null
  parentTeamId?: string | null
  sortOrder?: number
}

// Filter options
export interface TeamFilters {
  search?: string
  parentId?: string
  topLevelOnly?: boolean
}

// Query keys
export const teamsKeys = {
  all: ["teams"] as const,
  lists: () => [...teamsKeys.all, "list"] as const,
  list: (filters?: TeamFilters) => [...teamsKeys.lists(), filters] as const,
  details: () => [...teamsKeys.all, "detail"] as const,
  detail: (id: string) => [...teamsKeys.details(), id] as const,
}

// Base URL for API
const API_BASE = "/api/people/teams"

/**
 * Fetch all teams with optional filters
 */
async function fetchTeams(filters?: TeamFilters): Promise<Team[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) {
    params.set("search", filters.search)
  }
  if (filters?.parentId) {
    params.set("parentId", filters.parentId)
  }
  if (filters?.topLevelOnly) {
    params.set("topLevelOnly", "true")
  }
  
  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch teams")
  }
  
  return res.json()
}

/**
 * Fetch a single team by ID
 */
async function fetchTeam(id: string): Promise<Team | null> {
  const res = await fetch(`${API_BASE}/${id}`)
  
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error("Failed to fetch team")
  }
  
  return res.json()
}

/**
 * Create a new team
 */
async function createTeam(data: CreateTeam): Promise<Team> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to create team")
  }
  
  return res.json()
}

/**
 * Update a team
 */
async function updateTeam(id: string, data: UpdateTeam): Promise<Team> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to update team")
  }
  
  return res.json()
}

/**
 * Delete a team
 */
async function deleteTeam(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to delete team")
  }
}

// ============ React Query Hooks ============

/**
 * Hook to fetch teams list
 */
export function useTeamsList(filters?: TeamFilters) {
  return useQuery({
    queryKey: teamsKeys.list(filters),
    queryFn: () => fetchTeams(filters),
  })
}

/**
 * Hook to fetch a single team
 */
export function useTeam(id: string | null | undefined) {
  return useQuery({
    queryKey: teamsKeys.detail(id!),
    queryFn: () => fetchTeam(id!),
    enabled: !!id,
  })
}

/**
 * Hook to create a team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() })
    },
  })
}

/**
 * Hook to update a team
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeam }) => updateTeam(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: teamsKeys.detail(id) })
    },
  })
}

/**
 * Hook to delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() })
    },
  })
}

