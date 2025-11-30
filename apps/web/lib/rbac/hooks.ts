/**
 * RBAC hooks for permission checking
 */

import { useUser } from "./context"
import { hasPermission as checkPermission } from "./permissions"
import type { Role } from "./types"

/**
 * Hook to check if current user has permission
 * 
 * @example
 * const canEdit = usePermission("security.risk", "write")
 * const canView = usePermission("people.person") // defaults to "read"
 */
export function usePermission(resource: string, action: string = "read"): boolean {
  const { user, isLoading } = useUser()
  
  if (isLoading || !user) {
    return false
  }
  
  return checkPermission(user.role, resource, action)
}

/**
 * Hook to check if user has specific role
 * 
 * @example
 * const isAdmin = useRole("Admin")
 * const isOwner = useRole("Owner")
 */
export function useRole(role: Role): boolean {
  const { user, isLoading } = useUser()
  
  if (isLoading || !user) {
    return false
  }
  
  return user.role === role
}

/**
 * Hook to check if user has any of the specified roles
 * 
 * @example
 * const canManageUsers = useRoles(["Admin", "Owner"])
 */
export function useRoles(roles: Role[]): boolean {
  const { user, isLoading } = useUser()
  
  if (isLoading || !user) {
    return false
  }
  
  return roles.includes(user.role)
}

/**
 * Hook to get all permissions for current user
 */
export function useUserPermissions() {
  const { user, isLoading } = useUser()
  
  if (isLoading || !user) {
    return []
  }
  
  // TODO: Fetch from API or compute from role
  return []
}

