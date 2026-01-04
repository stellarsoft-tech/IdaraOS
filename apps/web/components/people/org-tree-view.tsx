"use client"

import { useMemo } from "react"
import { Building2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  HierarchyTreeView, 
  type HierarchyItem,
  type HierarchyTreeConfig,
} from "@/components/primitives/hierarchy-tree-view"
import { type OrganizationalRole } from "@/lib/api/org-roles"

export interface OrgTreeViewProps {
  roles: OrganizationalRole[]
  selectedRoleId?: string | null
  onSelect?: (role: OrganizationalRole) => void
  onAdd?: (parentRoleId?: string | null) => void
  onEdit?: (role: OrganizationalRole) => void
  onDelete?: (role: OrganizationalRole) => void
  canEdit?: boolean
  canDelete?: boolean
  isLoading?: boolean
  className?: string
}

/**
 * Adapter interface to map OrganizationalRole to HierarchyItem
 * The generic tree requires `parentId` but OrganizationalRole uses `parentRoleId`
 */
interface OrgRoleTreeItem extends HierarchyItem {
  originalRole: OrganizationalRole
}

/**
 * OrgTreeView - Tree view component for organizational roles
 * Wraps the generic HierarchyTreeView with role-specific rendering
 */
export function OrgTreeView({
  roles,
  selectedRoleId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  isLoading,
  className,
}: OrgTreeViewProps) {
  // Map OrganizationalRole[] to HierarchyItem[]
  const items: OrgRoleTreeItem[] = useMemo(() => 
    roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      parentId: role.parentRoleId, // Map parentRoleId -> parentId
      level: role.level,
      sortOrder: role.sortOrder,
      originalRole: role,
    })),
    [roles]
  )
  
  // Configuration for role-specific rendering
  const config: HierarchyTreeConfig<OrgRoleTreeItem> = useMemo(() => ({
    labels: {
      itemName: "role",
      addChild: "Add Sub-Role",
      editItem: "Edit Role",
      deleteItem: "Delete Role",
      addRoot: "Add Root",
      emptyTitle: "No roles defined",
      emptyDescription: "Create organizational roles to define your company structure.",
      addFirstButton: "Add First Role",
    },
    emptyIcon: <Building2 className="h-10 w-10 text-muted-foreground mb-3" />,
    
    // Render role-specific icon
    renderIcon: (item, depth) => (
      <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Building2 className="h-3.5 w-3.5 text-primary" />
      </div>
    ),
    
    // Render badges (top-level indicator, holder count)
    renderBadges: (item) => (
      <>
        {item.level === 0 && (
          <Badge variant="outline" className="text-xs">Top</Badge>
        )}
        {item.originalRole.holderCount > 0 && (
          <Badge variant="secondary" className="font-mono text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            {item.originalRole.holderCount}
          </Badge>
        )}
      </>
    ),
    
    // Check if role can be deleted
    canDeleteItem: (item) => 
      item.originalRole.childCount === 0 && item.originalRole.holderCount === 0,
    
    // Sort by sortOrder, then level, then name
    sortFn: (a, b) => {
      if (a.sortOrder !== b.sortOrder) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      if (a.level !== b.level) return (a.level ?? 0) - (b.level ?? 0)
      return a.name.localeCompare(b.name)
    },
  }), [])
  
  // Event handlers that map back to OrganizationalRole
  const handleSelect = (item: OrgRoleTreeItem) => {
    onSelect?.(item.originalRole)
  }
  
  const handleEdit = (item: OrgRoleTreeItem) => {
    onEdit?.(item.originalRole)
  }
  
  const handleDelete = (item: OrgRoleTreeItem) => {
    onDelete?.(item.originalRole)
  }
  
  return (
    <HierarchyTreeView
      items={items}
      selectedId={selectedRoleId}
      onSelect={handleSelect}
      onAdd={onAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      canEdit={canEdit}
      canDelete={canDelete}
      isLoading={isLoading}
      className={className}
      config={config}
    />
  )
}
