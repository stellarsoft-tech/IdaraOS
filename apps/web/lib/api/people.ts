/**
 * People API Client
 * React Query hooks for the People module
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Person as BasePerson, CreatePerson, UpdatePerson, PersonFilters } from "@/lib/generated/people/person/types"

// Linked user info (when person has a system account)
export interface LinkedUser {
  id: string
  name: string
  email: string
  status: string
  hasEntraLink: boolean
}

// Manager info
export interface ManagerInfo {
  id: string
  name: string
  email: string
  slug: string
}

// Sync tracking info
export interface SyncInfo {
  source: "manual" | "sync"
  entraId: string | null
  entraGroupId: string | null
  entraGroupName: string | null
  lastSyncedAt: string | null
  syncEnabled: boolean
}

// Extended Person type with linked user info and sync tracking
export interface Person extends BasePerson, SyncInfo {
  linkedUser: LinkedUser | null
  hasLinkedUser: boolean
  hasEntraLink: boolean
  createdAt: string
  updatedAt: string
  // Manager info
  managerId: string | null
  manager: ManagerInfo | null
  // Entra fields (stored in DB, but fetched real-time when Entra enabled)
  entraCreatedAt: string | null
  hireDate: string | null
  lastSignInAt: string | null
  lastPasswordChangeAt: string | null
}

// Query keys
export const peopleKeys = {
  all: ["people"] as const,
  lists: () => [...peopleKeys.all, "list"] as const,
  list: (filters?: PersonFilters) => [...peopleKeys.lists(), filters] as const,
  details: () => [...peopleKeys.all, "detail"] as const,
  detail: (id: string) => [...peopleKeys.details(), id] as const,
}

// Base URL for API
const API_BASE = "/api/people/person"

/**
 * Fetch all people with optional filters
 */
async function fetchPeople(filters?: PersonFilters): Promise<Person[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) params.set("search", filters.search)
  if (filters?.status?.length) params.set("status", filters.status.join(","))
  if (filters?.team?.length) params.set("team", filters.team.join(","))
  if (filters?.role?.length) params.set("role", filters.role.join(","))
  
  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch people")
  }
  
  return res.json()
}

/**
 * Fetch a single person by ID or slug
 */
async function fetchPerson(idOrSlug: string): Promise<Person | null> {
  const res = await fetch(`${API_BASE}/${idOrSlug}`)
  
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch person")
  
  return res.json()
}

/**
 * Create a new person
 */
async function createPerson(data: CreatePerson): Promise<Person> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create person" }))
    throw new Error(error.error || "Failed to create person")
  }
  
  return res.json()
}

/**
 * Update a person
 */
async function updatePerson(id: string, data: UpdatePerson): Promise<Person> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update person" }))
    throw new Error(error.error || "Failed to update person")
  }
  
  return res.json()
}

/**
 * Delete a person
 */
async function deletePerson(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" })
  
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete person")
  }
}

// React Query Hooks

export function usePeopleList(filters?: PersonFilters) {
  return useQuery({
    queryKey: peopleKeys.list(filters),
    queryFn: () => fetchPeople(filters),
  })
}

export function usePersonDetail(idOrSlug: string) {
  return useQuery({
    queryKey: peopleKeys.detail(idOrSlug),
    queryFn: () => fetchPerson(idOrSlug),
    enabled: !!idOrSlug,
  })
}

export function useCreatePerson() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.lists() })
    },
  })
}

export function useUpdatePerson() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePerson }) => updatePerson(id, data),
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.lists() })
      queryClient.invalidateQueries({ queryKey: peopleKeys.detail(person.id) })
      queryClient.invalidateQueries({ queryKey: peopleKeys.detail(person.slug) })
    },
  })
}

export function useDeletePerson() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.lists() })
    },
  })
}
