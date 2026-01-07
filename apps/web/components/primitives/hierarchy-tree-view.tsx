"use client"

import { useState, useMemo, useCallback, type ReactNode } from "react"
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  FolderTree,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Base interface for hierarchy items
 * All items must have these fields to work with the tree view
 */
export interface HierarchyItem {
  id: string
  name: string
  parentId: string | null
  description?: string | null
  level?: number
  sortOrder?: number
}

/**
 * Configuration for rendering tree items
 */
export interface HierarchyTreeConfig<TItem extends HierarchyItem> {
  /** Render the icon for an item */
  renderIcon?: (item: TItem, depth: number) => ReactNode
  /** Render custom badges for an item */
  renderBadges?: (item: TItem, depth: number) => ReactNode
  /** Check if an item can be deleted (e.g., has children or dependencies) */
  canDeleteItem?: (item: TItem) => boolean
  /** Custom labels */
  labels?: {
    itemName?: string // e.g., "Role", "Category"
    itemNamePlural?: string // e.g., "Roles", "Categories" (for irregular plurals)
    addChild?: string // e.g., "Add Sub-Role", "Add Sub-Category"
    editItem?: string // e.g., "Edit Role", "Edit Category"
    deleteItem?: string // e.g., "Delete Role", "Delete Category"
    addRoot?: string // e.g., "Add Root", "Add Category"
    emptyTitle?: string
    emptyDescription?: string
    addFirstButton?: string
  }
  /** Custom empty state icon */
  emptyIcon?: ReactNode
  /** Custom sort function for items within the same parent */
  sortFn?: (a: TItem, b: TItem) => number
}

export interface HierarchyTreeViewProps<TItem extends HierarchyItem> {
  items: TItem[]
  selectedId?: string | null
  onSelect?: (item: TItem) => void
  onAdd?: (parentId?: string | null) => void
  onEdit?: (item: TItem) => void
  onDelete?: (item: TItem) => void
  canEdit?: boolean
  canDelete?: boolean
  isLoading?: boolean
  className?: string
  config?: HierarchyTreeConfig<TItem>
}

interface TreeNode<TItem extends HierarchyItem> {
  item: TItem
  children: TreeNode<TItem>[]
  depth: number
}

// Default sort function
function defaultSort<TItem extends HierarchyItem>(a: TItem, b: TItem): number {
  // Sort by sortOrder if available, then by level, then by name
  const aSort = a.sortOrder ?? 0
  const bSort = b.sortOrder ?? 0
  if (aSort !== bSort) return aSort - bSort
  
  const aLevel = a.level ?? 0
  const bLevel = b.level ?? 0
  if (aLevel !== bLevel) return aLevel - bLevel
  
  return a.name.localeCompare(b.name)
}

// Build tree structure from flat list
function buildTree<TItem extends HierarchyItem>(
  items: TItem[],
  sortFn: (a: TItem, b: TItem) => number = defaultSort
): TreeNode<TItem>[] {
  const itemMap = new Map<string, TItem>()
  const childrenMap = new Map<string | null, TItem[]>()
  
  // First pass: build maps
  for (const item of items) {
    itemMap.set(item.id, item)
    const parentId = item.parentId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(item)
  }
  
  // Sort children
  for (const children of childrenMap.values()) {
    children.sort(sortFn)
  }
  
  // Recursive function to build tree nodes
  function buildNodes(parentId: string | null, depth: number): TreeNode<TItem>[] {
    const children = childrenMap.get(parentId) || []
    return children.map(item => ({
      item,
      children: buildNodes(item.id, depth + 1),
      depth,
    }))
  }
  
  return buildNodes(null, 0)
}

interface TreeNodeItemProps<TItem extends HierarchyItem> {
  node: TreeNode<TItem>
  isSelected: boolean
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelect?: (item: TItem) => void
  onAdd?: (parentId?: string | null) => void
  onEdit?: (item: TItem) => void
  onDelete?: (item: TItem) => void
  canEdit?: boolean
  canDelete?: boolean
  config?: HierarchyTreeConfig<TItem>
}

function TreeNodeItem<TItem extends HierarchyItem>({
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
  config,
}: TreeNodeItemProps<TItem>) {
  const { item, children, depth } = node
  const isExpanded = expandedIds.has(item.id)
  const hasChildren = children.length > 0
  
  const labels = config?.labels || {}
  const canDeleteThisItem = config?.canDeleteItem?.(item) ?? true
  
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
        onClick={() => onSelect?.(item)}
      >
        {/* Expand/collapse button */}
        <button
          className={cn(
            "h-5 w-5 flex items-center justify-center rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(item.id)
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
        {config?.renderIcon ? (
          config.renderIcon(item, depth)
        ) : (
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderTree className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        
        {/* Name and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.name}</span>
          </div>
          {item.description && (
            <div className="text-xs text-muted-foreground truncate max-w-[250px]">
              {item.description}
            </div>
          )}
        </div>
        
        {/* Custom badges */}
        {config?.renderBadges?.(item, depth)}
        
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
                    onAdd(item.id)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {labels.addChild || "Add Child"}
                </DropdownMenuItem>
              )}
              {onEdit && canEdit && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(item)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {labels.editItem || "Edit"}
                </DropdownMenuItem>
              )}
              {onDelete && canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item)
                    }}
                    className="text-destructive focus:text-destructive"
                    disabled={!canDeleteThisItem}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {labels.deleteItem || "Delete"}
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
              key={child.item.id}
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
              config={config}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function HierarchyTreeView<TItem extends HierarchyItem>({
  items,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  isLoading,
  className,
  config,
}: HierarchyTreeViewProps<TItem>) {
  const labels = config?.labels || {}
  const itemName = labels.itemName || "item"
  
  // Track expanded nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Initially expand all top-level nodes
    return new Set(items.filter(i => i.parentId === null).map(i => i.id))
  })
  
  // Build tree structure
  const tree = useMemo(
    () => buildTree(items, config?.sortFn || defaultSort),
    [items, config?.sortFn]
  )
  
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
    setExpandedIds(new Set(items.map(i => i.id)))
  }, [items])
  
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
  
  if (items.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center min-h-[300px]", className)}>
        {config?.emptyIcon || <FolderTree className="h-10 w-10 text-muted-foreground mb-3" />}
        <h3 className="font-semibold mb-1">
          {labels.emptyTitle || `No ${itemName}s defined`}
        </h3>
        <p className="text-sm text-muted-foreground mb-3 max-w-md">
          {labels.emptyDescription || `Create ${itemName}s to build your hierarchy.`}
        </p>
        {onAdd && canEdit && (
          <Button size="sm" onClick={() => onAdd(null)}>
            <Plus className="h-4 w-4 mr-1" />
            {labels.addFirstButton || `Add First ${itemName}`}
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm text-muted-foreground">
          {items.length} {items.length !== 1 ? (labels.itemNamePlural || `${itemName}s`) : itemName}
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
              {labels.addRoot || "Add Root"}
            </Button>
          )}
        </div>
      </div>
      
      {/* Tree */}
      <div className="px-1 py-1">
        {tree.map(node => (
          <TreeNodeItem
            key={node.item.id}
            node={node}
            isSelected={selectedId === node.item.id}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onSelect={onSelect}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
            config={config}
          />
        ))}
      </div>
    </div>
  )
}
