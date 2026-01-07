"use client"

import { useMemo } from "react"
import { Briefcase, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  HierarchyTreeSelect, 
  type HierarchySelectItem,
  type HierarchyTreeSelectConfig,
} from "@/components/primitives/hierarchy-tree-select"
import { type OrganizationalRole } from "@/lib/api/org-roles"

/**
 * Simplified role interface for the tree select
 * Allows using either full OrganizationalRole or a minimal subset
 */
export interface RoleTreeSelectItem {
  id: string
  name: string
  parentRoleId: string | null
  level: number
  holderCount: number
  childCount: number
  description?: string | null
  team?: { id: string; name: string } | null
}

export interface RoleTreeSelectProps {
  roles: RoleTreeSelectItem[] | OrganizationalRole[]
  value: string | null
  onChange: (value: string | null) => void
  /** ID to exclude from selection (e.g., the role being edited can't be its own parent) */
  excludeId?: string | null
  disabled?: boolean
  placeholder?: string
  /** Whether to allow selecting "None" option */
  allowNone?: boolean
  /** Label for the "None" option */
  noneLabel?: string
  className?: string
}

/**
 * Adapter interface to map Role to HierarchySelectItem
 */
interface RoleSelectItem extends HierarchySelectItem {
  originalRole: RoleTreeSelectItem
  holderCount: number
  childCount: number
  level: number
  teamName: string | null
}

/**
 * RoleTreeSelect - Hierarchical role selector
 * Shows roles in a tree structure for easier selection
 */
export function RoleTreeSelect({
  roles,
  value,
  onChange,
  excludeId,
  disabled,
  placeholder = "Select role...",
  allowNone = false,
  noneLabel = "None",
  className,
}: RoleTreeSelectProps) {
  // Map OrganizationalRole[] to HierarchySelectItem[]
  const items: RoleSelectItem[] = useMemo(() => 
    roles.map(role => ({
      id: role.id,
      name: role.name,
      parentId: role.parentRoleId,
      description: role.description,
      originalRole: role,
      holderCount: role.holderCount,
      childCount: role.childCount,
      level: role.level,
      teamName: role.team?.name ?? null,
    })),
    [roles]
  )
  
  // Configuration for role-specific rendering
  const config: HierarchyTreeSelectConfig<RoleSelectItem> = useMemo(() => ({
    labels: {
      title: "Select Role",
      placeholder,
      searchPlaceholder: "Search roles...",
      emptySearch: "No roles found",
      clear: "Clear",
      noneOption: noneLabel,
    },
    allowNone,
    
    // Render role icon with level indicator
    renderIcon: (item) => (
      <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${
        item.parentId === null ? "bg-primary text-primary-foreground" : "bg-primary/10"
      }`}>
        <Briefcase className={`h-3 w-3 ${item.parentId !== null ? "text-primary" : ""}`} />
      </div>
    ),
    
    // Render holder count and level badge
    renderInfo: (item) => (
      <div className="flex items-center gap-1 ml-auto">
        {item.holderCount > 0 && (
          <Badge variant="secondary" className="text-xs font-mono flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {item.holderCount}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs font-mono">
          L{item.level}
        </Badge>
      </div>
    ),
    
    // Don't allow selecting roles that would create circular references
    canSelect: (item) => {
      if (!excludeId) return true
      return item.id !== excludeId && !isDescendantOf(item.id, excludeId, roles)
    },
    
    // Sort by level, then name
    sortFn: (a, b) => {
      if (a.level !== b.level) return a.level - b.level
      return a.name.localeCompare(b.name)
    },
  }), [placeholder, excludeId, roles, allowNone, noneLabel])
  
  return (
    <HierarchyTreeSelect
      items={items}
      value={value}
      onChange={onChange}
      excludeId={excludeId}
      disabled={disabled}
      className={className}
      config={config}
    />
  )
}

/**
 * Check if a role is a descendant of another role
 * Used to prevent circular references when selecting parent roles
 */
function isDescendantOf(
  potentialAncestorId: string, 
  descendantId: string, 
  roles: RoleTreeSelectItem[]
): boolean {
  const roleMap = new Map(roles.map(r => [r.id, r]))
  
  let current = roleMap.get(descendantId)
  const visited = new Set<string>()
  
  while (current && current.parentRoleId) {
    if (visited.has(current.id)) break // Prevent infinite loop
    visited.add(current.id)
    
    if (current.parentRoleId === potentialAncestorId) {
      return true
    }
    current = roleMap.get(current.parentRoleId)
  }
  
  return false
}
