/**
 * RBAC API Client and React Query Hooks
 * 
 * Provides hooks for managing roles, permissions, and user assignments.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ============ Types ============

export interface Module {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  icon: string | null
  sortOrder: string
  isActive: boolean
  createdAt: string
}

export interface Action {
  id: string
  slug: string
  name: string
  description: string | null
  sortOrder: string
  createdAt: string
}

export interface Permission {
  id: string
  moduleId: string
  actionId: string
  moduleSlug: string
  moduleName: string
  moduleCategory: string
  moduleIcon: string | null
  moduleSortOrder: string
  actionSlug: string
  actionName: string
  actionSortOrder: string
}

export interface Role {
  id: string
  slug: string
  name: string
  description: string | null
  color: string | null
  isSystem: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
  permissionCount?: number
  userCount?: number
}

export interface RoleWithPermissions extends Role {
  permissions: Array<{
    permissionId: string
    moduleSlug: string
    moduleName: string
    moduleCategory: string
    actionSlug: string
    actionName: string
  }>
}

export interface UserRole {
  roleId: string
  roleSlug: string
  roleName: string
  roleColor: string | null
  roleDescription: string | null
  isSystem: boolean
  assignedAt: string
}

export interface UserPermissions {
  roleIds: string[]
  permissionMap: Record<string, Record<string, boolean>>
}

// ============ Query Keys ============

export const rbacKeys = {
  all: ["rbac"] as const,
  modules: () => [...rbacKeys.all, "modules"] as const,
  actions: () => [...rbacKeys.all, "actions"] as const,
  permissions: () => [...rbacKeys.all, "permissions"] as const,
  roles: () => [...rbacKeys.all, "roles"] as const,
  role: (id: string) => [...rbacKeys.roles(), id] as const,
  userRoles: (userId: string) => [...rbacKeys.all, "userRoles", userId] as const,
  userPermissions: () => [...rbacKeys.all, "userPermissions"] as const,
}

// ============ Fetch Functions ============

async function fetchModules(): Promise<Module[]> {
  const response = await fetch("/api/rbac/modules")
  if (!response.ok) {
    throw new Error("Failed to fetch modules")
  }
  return response.json()
}

async function fetchActions(): Promise<Action[]> {
  const response = await fetch("/api/rbac/actions")
  if (!response.ok) {
    throw new Error("Failed to fetch actions")
  }
  return response.json()
}

async function fetchPermissions(): Promise<Permission[]> {
  const response = await fetch("/api/rbac/permissions")
  if (!response.ok) {
    throw new Error("Failed to fetch permissions")
  }
  return response.json()
}

async function fetchRoles(): Promise<Role[]> {
  const response = await fetch("/api/rbac/roles")
  if (!response.ok) {
    throw new Error("Failed to fetch roles")
  }
  return response.json()
}

async function fetchRole(id: string): Promise<RoleWithPermissions> {
  const response = await fetch(`/api/rbac/roles/${id}`)
  if (!response.ok) {
    throw new Error("Failed to fetch role")
  }
  return response.json()
}

async function fetchUserRoles(userId: string): Promise<UserRole[]> {
  const response = await fetch(`/api/rbac/users/${userId}/roles`)
  if (!response.ok) {
    throw new Error("Failed to fetch user roles")
  }
  return response.json()
}

async function fetchUserPermissions(): Promise<UserPermissions> {
  const response = await fetch("/api/rbac/user-permissions")
  if (!response.ok) {
    throw new Error("Failed to fetch user permissions")
  }
  return response.json()
}

// ============ Query Hooks ============

export function useModules() {
  return useQuery({
    queryKey: rbacKeys.modules(),
    queryFn: fetchModules,
  })
}

export function useActions() {
  return useQuery({
    queryKey: rbacKeys.actions(),
    queryFn: fetchActions,
  })
}

export function usePermissions() {
  return useQuery({
    queryKey: rbacKeys.permissions(),
    queryFn: fetchPermissions,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: rbacKeys.roles(),
    queryFn: fetchRoles,
  })
}

export function useRole(id: string) {
  return useQuery({
    queryKey: rbacKeys.role(id),
    queryFn: () => fetchRole(id),
    enabled: !!id,
  })
}

export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: rbacKeys.userRoles(userId),
    queryFn: () => fetchUserRoles(userId),
    enabled: !!userId,
  })
}

export function useUserPermissions() {
  return useQuery({
    queryKey: rbacKeys.userPermissions(),
    queryFn: fetchUserPermissions,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}

// ============ Mutation Hooks ============

export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      description?: string
      color?: string
      permissionIds?: string[]
    }) => {
      const response = await fetch("/api/rbac/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create role")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() })
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: {
        name?: string
        description?: string
        color?: string
        permissionIds?: string[]
      }
    }) => {
      const response = await fetch(`/api/rbac/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update role")
      }
      return response.json()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() })
      queryClient.invalidateQueries({ queryKey: rbacKeys.role(id) })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/rbac/roles/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete role")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() })
    },
  })
}

export function useUpdateUserRoles() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      roleIds,
    }: {
      userId: string
      roleIds: string[]
    }) => {
      const response = await fetch(`/api/rbac/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update user roles")
      }
      return response.json()
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userRoles(userId) })
      queryClient.invalidateQueries({ queryKey: rbacKeys.userPermissions() })
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() }) // User count changed
    },
  })
}

