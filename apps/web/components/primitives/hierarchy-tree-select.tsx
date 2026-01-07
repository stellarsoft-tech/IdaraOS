"use client"

import { useState, useMemo, useCallback, type ReactNode } from "react"
import { 
  ChevronRight, 
  ChevronDown, 
  Check,
  X,
  ChevronsUpDown,
  FolderTree,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

/**
 * Base interface for hierarchy items
 */
export interface HierarchySelectItem {
  id: string
  name: string
  parentId: string | null
  description?: string | null
  disabled?: boolean
}

/**
 * Configuration for rendering tree items in the select
 */
export interface HierarchyTreeSelectConfig<TItem extends HierarchySelectItem> {
  /** Render the icon for an item */
  renderIcon?: (item: TItem, depth: number) => ReactNode
  /** Render additional info for an item */
  renderInfo?: (item: TItem, depth: number) => ReactNode
  /** Check if an item can be selected */
  canSelect?: (item: TItem) => boolean
  /** Custom labels */
  labels?: {
    title?: string // Dialog title
    placeholder?: string // Trigger placeholder
    searchPlaceholder?: string // Search input placeholder
    emptySearch?: string // No results message
    clear?: string // Clear button text
    noneOption?: string // "None" option text
  }
  /** Custom empty state icon */
  emptyIcon?: ReactNode
  /** Allow selecting "None" (null) value */
  allowNone?: boolean
  /** Custom sort function */
  sortFn?: (a: TItem, b: TItem) => number
}

export interface HierarchyTreeSelectProps<TItem extends HierarchySelectItem> {
  items: TItem[]
  value: string | null
  onChange: (value: string | null) => void
  /** ID to exclude from selection (e.g., the item being edited can't be its own parent) */
  excludeId?: string | null
  disabled?: boolean
  className?: string
  config?: HierarchyTreeSelectConfig<TItem>
}

interface TreeNode<TItem extends HierarchySelectItem> {
  item: TItem
  children: TreeNode<TItem>[]
  depth: number
}

// Default sort function
function defaultSort<TItem extends HierarchySelectItem>(a: TItem, b: TItem): number {
  return a.name.localeCompare(b.name)
}

// Build tree structure from flat list
function buildTree<TItem extends HierarchySelectItem>(
  items: TItem[],
  sortFn: (a: TItem, b: TItem) => number = defaultSort
): TreeNode<TItem>[] {
  const itemMap = new Map<string, TItem>()
  const childrenMap = new Map<string | null, TItem[]>()
  
  for (const item of items) {
    itemMap.set(item.id, item)
    const parentId = item.parentId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(item)
  }
  
  for (const children of childrenMap.values()) {
    children.sort(sortFn)
  }
  
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

// Flatten tree for search
function flattenTree<TItem extends HierarchySelectItem>(
  nodes: TreeNode<TItem>[]
): Array<{ item: TItem; depth: number; path: string[] }> {
  const result: Array<{ item: TItem; depth: number; path: string[] }> = []
  
  function traverse(nodes: TreeNode<TItem>[], path: string[]) {
    for (const node of nodes) {
      const currentPath = [...path, node.item.name]
      result.push({ item: node.item, depth: node.depth, path: currentPath })
      traverse(node.children, currentPath)
    }
  }
  
  traverse(nodes, [])
  return result
}

interface TreeSelectNodeProps<TItem extends HierarchySelectItem> {
  node: TreeNode<TItem>
  selectedId: string | null
  expandedIds: Set<string>
  excludeId?: string | null
  onToggle: (id: string) => void
  onSelect: (item: TItem) => void
  config?: HierarchyTreeSelectConfig<TItem>
}

function TreeSelectNode<TItem extends HierarchySelectItem>({
  node,
  selectedId,
  expandedIds,
  excludeId,
  onToggle,
  onSelect,
  config,
}: TreeSelectNodeProps<TItem>) {
  const { item, children, depth } = node
  const isExpanded = expandedIds.has(item.id)
  const hasChildren = children.length > 0
  const isSelected = selectedId === item.id
  const isExcluded = excludeId === item.id
  const canSelect = config?.canSelect?.(item) ?? true
  const isDisabled = item.disabled || isExcluded || !canSelect
  
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          isSelected && "bg-primary/10 border border-primary/20",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isDisabled && onSelect(item)}
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
          <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderTree className="h-3 w-3 text-primary" />
          </div>
        )}
        
        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{item.name}</div>
          {item.description && (
            <div className="text-xs text-muted-foreground truncate">
              {item.description}
            </div>
          )}
        </div>
        
        {/* Additional info */}
        {config?.renderInfo?.(item, depth)}
        
        {/* Selected indicator */}
        {isSelected && (
          <Check className="h-4 w-4 text-primary flex-shrink-0" />
        )}
        
        {/* Excluded indicator */}
        {isExcluded && (
          <span className="text-xs text-muted-foreground">(current)</span>
        )}
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map(child => (
            <TreeSelectNode
              key={child.item.id}
              node={child}
              selectedId={selectedId}
              expandedIds={expandedIds}
              excludeId={excludeId}
              onToggle={onToggle}
              onSelect={onSelect}
              config={config}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function HierarchyTreeSelect<TItem extends HierarchySelectItem>({
  items,
  value,
  onChange,
  excludeId,
  disabled,
  className,
  config,
}: HierarchyTreeSelectProps<TItem>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [pendingValue, setPendingValue] = useState<string | null>(value)
  
  const labels = config?.labels || {}
  const allowNone = config?.allowNone ?? true
  
  // Build tree structure
  const tree = useMemo(
    () => buildTree(items, config?.sortFn || defaultSort),
    [items, config?.sortFn]
  )
  
  // Track expanded nodes - expand all by default for easier navigation
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(items.map(i => i.id))
  })
  
  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return null // Use tree view
    
    const flat = flattenTree(tree)
    const searchLower = search.toLowerCase()
    return flat.filter(({ item, path }) => 
      item.name.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      path.join(" > ").toLowerCase().includes(searchLower)
    )
  }, [tree, search])
  
  // Get selected item for display
  const selectedItem = useMemo(
    () => items.find(i => i.id === value),
    [items, value]
  )
  
  // Get path for selected item
  const selectedPath = useMemo(() => {
    if (!selectedItem) return null
    
    const path: string[] = []
    let current: TItem | undefined = selectedItem
    while (current) {
      path.unshift(current.name)
      current = items.find(i => i.id === current?.parentId)
    }
    return path
  }, [selectedItem, items])
  
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
  
  // Handle select (set pending, don't close yet)
  const handleSelect = useCallback((item: TItem) => {
    setPendingValue(item.id)
  }, [])
  
  // Handle confirm
  const handleConfirm = useCallback(() => {
    onChange(pendingValue)
    setOpen(false)
    setSearch("")
  }, [pendingValue, onChange])
  
  // Handle clear
  const handleClear = useCallback(() => {
    setPendingValue(null)
  }, [])
  
  // Handle open change
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setPendingValue(value)
      setSearch("")
    }
    setOpen(isOpen)
  }, [value])
  
  // Expand all
  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(items.map(i => i.id)))
  }, [items])
  
  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])
  
  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn("w-full justify-between font-normal", className)}
        onClick={() => handleOpenChange(true)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {selectedItem ? (
            <>
              {config?.renderIcon?.(selectedItem as TItem, 0) || (
                <FolderTree className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {selectedPath && selectedPath.length > 1 ? (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground truncate">
                      {selectedPath.slice(0, -1).join(" › ")} ›
                    </span>
                    <span className="font-medium truncate">{selectedItem.name}</span>
                  </div>
                ) : (
                  <span className="truncate">{selectedItem.name}</span>
                )}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">
              {labels.placeholder || "Select..."}
            </span>
          )}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {/* Selection dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.title || "Select Item"}</DialogTitle>
          </DialogHeader>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={labels.searchPlaceholder || "Search..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Tree view */}
          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-2">
              {/* None option */}
              {allowNone && !search && (
                <div
                  className={cn(
                    "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    pendingValue === null && "bg-primary/10 border border-primary/20"
                  )}
                  onClick={() => setPendingValue(null)}
                >
                  <div className="h-5 w-5 flex items-center justify-center">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {labels.noneOption || "None (Top-level)"}
                  </span>
                  {pendingValue === null && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </div>
              )}
              
              {/* Filtered results or tree */}
              {filteredItems ? (
                filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {labels.emptySearch || "No results found"}
                  </div>
                ) : (
                  filteredItems.map(({ item, depth, path }) => {
                    const isSelected = pendingValue === item.id
                    const isExcluded = excludeId === item.id
                    const canSelect = config?.canSelect?.(item as TItem) ?? true
                    const isDisabled = item.disabled || isExcluded || !canSelect
                    
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
                          "hover:bg-muted/50",
                          isSelected && "bg-primary/10 border border-primary/20",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => !isDisabled && setPendingValue(item.id)}
                      >
                        {config?.renderIcon?.(item as TItem, depth) || (
                          <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FolderTree className="h-3 w-3 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {path.slice(0, -1).join(" › ")}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    )
                  })
                )
              ) : (
                <>
                  {/* Expand/Collapse controls */}
                  <div className="flex items-center gap-1 pb-2 border-b mb-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={handleExpandAll}
                    >
                      Expand All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={handleCollapseAll}
                    >
                      Collapse All
                    </Button>
                  </div>
                  
                  {/* Tree nodes */}
                  {tree.map(node => (
                    <TreeSelectNode
                      key={node.item.id}
                      node={node}
                      selectedId={pendingValue}
                      expandedIds={expandedIds}
                      excludeId={excludeId}
                      onToggle={handleToggle}
                      onSelect={handleSelect}
                      config={config}
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
          
          <DialogFooter className="gap-2 sm:gap-0">
            {allowNone && pendingValue !== null && (
              <Button variant="outline" onClick={handleClear}>
                {labels.clear || "Clear"}
              </Button>
            )}
            <Button onClick={handleConfirm}>
              Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
