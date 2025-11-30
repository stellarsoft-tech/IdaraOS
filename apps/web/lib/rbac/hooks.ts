/**
 * RBAC hooks for permission checking
 * 
 * These hooks use the permission system from the RBAC context.
 * For legacy role-based checks, use the context's hasPermission directly.
 */

import { useUser } from "./context"

/**
 * Hook to check if current user has permission
 * 
 * @example
 * const canEdit = usePermission("security.risk", "write")
 * const canView = usePermission("people.person") // defaults to "view"
 */
export function usePermission(module: string, action: string = "view"): boolean {
  const { hasPermission, isLoading } = useUser()
  
  if (isLoading) {
    return false
  }
  
  return hasPermission(module, action)
}

/**
 * Hook to check if user has any of the specified permissions on a module
 * 
 * @example
 * const canManageRisks = useAnyPermission("security.risk", ["create", "edit", "delete"])
 */
export function useAnyPermission(module: string, actions: string[]): boolean {
  const { hasAnyPermission, isLoading } = useUser()
  
  if (isLoading) {
    return false
  }
  
  return hasAnyPermission(module, actions)
}

/**
 * Hook to check if user has all specified permissions on a module
 * 
 * @example
 * const canFullyManage = useAllPermissions("security.risk", ["view", "create", "edit", "delete"])
 */
export function useAllPermissions(module: string, actions: string[]): boolean {
  const { hasAllPermissions, isLoading } = useUser()
  
  if (isLoading) {
    return false
  }
  
  return hasAllPermissions(module, actions)
}

/**
 * Hook to check if user can access a module (has view permission)
 * 
 * @example
 * const canAccessSettings = useCanAccess("settings.users")
 */
export function useCanAccess(module: string): boolean {
  const { canAccess, isLoading } = useUser()
  
  if (isLoading) {
    return false
  }
  
  return canAccess(module)
}

/**
 * Hook to get all permissions for current user
 */
export function useUserPermissions() {
  const { permissions, isLoading } = useUser()
  
  if (isLoading || !permissions) {
    return null
  }
  
  return permissions
}
