"use client"

import { useState, useMemo, useCallback } from "react"
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  GripVertical,
  Users,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface TreeNode {
  role: OrganizationalRole
  children: TreeNode[]
  depth: number
}

// Build tree structure from flat list
function buildTree(roles: OrganizationalRole[]): TreeNode[] {
  const roleMap = new Map<string, OrganizationalRole>()
  const childrenMap = new Map<string | null, OrganizationalRole[]>()
  
  // First pass: build maps
  for (const role of roles) {
    roleMap.set(role.id, role)
    const parentId = role.parentRoleId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(role)
  }
  
  // Sort children by sortOrder, then level, then name
  for (const children of childrenMap.values()) {
    children.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      if (a.level !== b.level) return a.level - b.level
      return a.name.localeCompare(b.name)
    })
  }
  
  // Recursive function to build tree nodes
  function buildNodes(parentId: string | null, depth: number): TreeNode[] {
    const children = childrenMap.get(parentId) || []
    return children.map(role => ({
      role,
      children: buildNodes(role.id, depth + 1),
      depth,
    }))
  }
  
  return buildNodes(null, 0)
}

interface TreeNodeItemProps {
  node: TreeNode
  isSelected: boolean
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelect?: (role: OrganizationalRole) => void
  onAdd?: (parentRoleId?: string | null) => void
  onEdit?: (role: OrganizationalRole) => void
  onDelete?: (role: OrganizationalRole) => void
  canEdit?: boolean
  canDelete?: boolean
}

function TreeNodeItem({
  node,
  isSelected,
  expandedIds,
  onToggle,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: TreeNodeItemProps) {
  const { role, children, depth } = node
  const isExpanded = expandedIds.has(role.id)
  const hasChildren = children.length > 0
  
  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          isSelected && "bg-primary/10 border border-primary/20"
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect?.(role)}
      >
        {/* Expand/collapse button */}
        <button
          className={cn(
            "h-5 w-5 flex items-center justify-center rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(role.id)
          }}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          )}
        </button>
        
        {/* Icon */}
        <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-3.5 w-3.5 text-primary" />
        </div>
        
        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{role.name}</span>
            {role.level === 0 && (
              <Badge variant="outline" className="text-xs">Top</Badge>
            )}
          </div>
          {role.description && (
            <div className="text-xs text-muted-foreground truncate max-w-[250px]">
              {role.description}
            </div>
          )}
        </div>
        
        {/* Holder count */}
        {role.holderCount > 0 && (
          <Badge variant="secondary" className="font-mono text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            {role.holderCount}
          </Badge>
        )}
        
        {/* Actions dropdown */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onAdd && canEdit && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdd(role.id)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sub-Role
                </DropdownMenuItem>
              )}
              {onEdit && canEdit && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(role)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Role
                </DropdownMenuItem>
              )}
              {onDelete && canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(role)
                    }}
                    className="text-destructive focus:text-destructive"
                    disabled={role.childCount > 0 || role.holderCount > 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Role
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map(child => (
            <TreeNodeItem
              key={child.role.id}
              node={child}
              isSelected={isSelected}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

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
  // Track expanded nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Initially expand all top-level nodes
    return new Set(roles.filter(r => r.parentRoleId === null).map(r => r.id))
  })
  
  // Build tree structure
  const tree = useMemo(() => buildTree(roles), [roles])
  
  // Toggle expansion
  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])
  
  // Expand all
  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(roles.map(r => r.id)))
  }, [roles])
  
  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])
  
  if (isLoading) {
    return (
      <div className={cn("p-3", className)}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 py-1 animate-pulse">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-6 w-6 bg-muted rounded-md" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }
  
  if (roles.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">No roles defined</h3>
        <p className="text-sm text-muted-foreground mb-3 max-w-md">
          Create organizational roles to define your company structure.
        </p>
        {onAdd && canEdit && (
          <Button size="sm" onClick={() => onAdd(null)}>
            <Plus className="h-4 w-4 mr-1" />
            Add First Role
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <div className={cn("", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm text-muted-foreground">
          {roles.length} role{roles.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleExpandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
            Collapse All
          </Button>
          {onAdd && canEdit && (
            <Button variant="outline" size="sm" onClick={() => onAdd(null)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Root
            </Button>
          )}
        </div>
      </div>
      
      {/* Tree */}
      <div className="px-1 py-1">
        {tree.map(node => (
          <TreeNodeItem
            key={node.role.id}
            node={node}
            isSelected={selectedRoleId === node.role.id}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onSelect={onSelect}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
      </div>
    </div>
  )
}

