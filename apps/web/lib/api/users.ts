/**
 * Users API Client
 * React Query hooks for user management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserRole, UserStatus } from "@/lib/db/schema"

// Query keys
export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "list"] as const,
  list: (filters?: UserFilters) => [...usersKeys.lists(), filters] as const,
  details: () => [...usersKeys.all, "detail"] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
}

// Filter types
export interface UserFilters {
  role?: UserRole[]
  status?: UserStatus[]
  search?: string
}

// Assigned role info from RBAC system
export interface AssignedRole {
  roleId: string
  roleName: string
  roleColor: string | null
  source?: "manual" | "scim"
  scimGroupId?: string | null
}

// Linked person info
export interface LinkedPerson {
  id: string
  name: string
  slug: string
  role: string
  team: string | null
}

// API User type
export interface ApiUser {
  id: string
  orgId: string
  personId: string | null
  entraId: string | null
  email: string
  name: string
  avatar: string | null
  role: UserRole // Legacy field
  roles: AssignedRole[] // Actual RBAC roles
  status: UserStatus
  lastLoginAt: string | null
  invitedAt: string | null
  createdAt: string
  updatedAt: string
  // Linked entity info
  person: LinkedPerson | null
  hasLinkedPerson: boolean
  hasEntraLink: boolean
  // SCIM-related flags for role management
  hasScimRoles: boolean // True if user has any SCIM-assigned roles
}

// Create/Update types
export interface CreateUser {
  name: string
  email: string
  role: UserRole
  personId?: string | null
  entraId?: string | null
}

export interface UpdateUser {
  name?: string
  email?: string
  role?: UserRole
  status?: UserStatus
  personId?: string | null
  entraId?: string | null
  avatar?: string | null
}

const API_BASE = "/api/settings/users"

/**
 * Fetch all users
 */
async function fetchUsers(): Promise<ApiUser[]> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error("Failed to fetch users")
  return res.json()
}

/**
 * Fetch a single user
 */
async function fetchUser(id: string): Promise<ApiUser | null> {
  const res = await fetch(`${API_BASE}/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch user")
  return res.json()
}

/**
 * Create a new user
 */
async function createUser(data: CreateUser): Promise<ApiUser> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create user" }))
    throw new Error(error.error || "Failed to create user")
  }
  return res.json()
}

/**
 * Update a user
 */
async function updateUser(id: string, data: UpdateUser): Promise<ApiUser> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update user" }))
    throw new Error(error.error || "Failed to update user")
  }
  return res.json()
}

/**
 * Delete a user
 */
async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" })
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete user")
  }
}

// React Query Hooks

export function useUsersList(filters?: UserFilters) {
  return useQuery({
    queryKey: usersKeys.list(filters),
    queryFn: fetchUsers,
  })
}

export function useUserDetail(id: string) {
  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUser }) => updateUser(id, data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(user.id) })
      // Also invalidate people queries since personId link may have changed
      queryClient.invalidateQueries({ queryKey: ["people"] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}

