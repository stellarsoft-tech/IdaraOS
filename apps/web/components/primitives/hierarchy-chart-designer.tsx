"use client"

import { useCallback, useState, useMemo, useEffect, useRef, type ReactNode } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
  type OnConnect,
  Panel,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Save, 
  Layout, 
  FolderTree,
  Pencil,
  Trash2,
  ChevronRight,
  Link,
  Maximize2,
  Minimize2,
} from "lucide-react"

/**
 * Base interface for hierarchy items that can be displayed in the chart
 */
export interface HierarchyChartItem {
  id: string
  name: string
  parentId: string | null
  description?: string | null
  level: number
  sortOrder: number
  positionX: number
  positionY: number
}

/**
 * Draft item for inline creation
 */
export interface DraftItem {
  id: string
  name: string
  description: string
  parentId: string | null
  level: number
  positionX: number
  positionY: number
}

/**
 * Node data interface - must have index signature for React Flow
 */
export interface HierarchyNodeData {
  id: string
  name: string
  description?: string
  level: number
  parentId: string | null
  childCount: number
  isDraft?: boolean
  [key: string]: unknown
}

/**
 * Configuration for the chart designer
 */
export interface HierarchyChartConfig<TItem extends HierarchyChartItem> {
  /** Custom node rendering - receives item and whether selected */
  renderNodeContent?: (item: TItem | DraftItem, isSelected: boolean, isDraft: boolean) => ReactNode
  /** Custom labels */
  labels?: {
    itemName?: string // e.g., "Role", "Category"
    addItem?: string // e.g., "Add Role", "Add Category"
    addChild?: string // e.g., "Add Child", "Add Sub-Category"
    editItem?: string // e.g., "Edit Role", "Edit Category"
    deleteItem?: string // e.g., "Delete Role", "Delete Category"
    emptyTitle?: string
    emptyDescription?: string
    emptyActionLabel?: string
    makeTopLevel?: string // e.g., "Make Top-Level"
  }
  /** Icon for empty state */
  emptyIcon?: ReactNode
  /** Get child count for an item */
  getChildCount?: (item: TItem) => number
  /** Check if item can be deleted */
  canDeleteItem?: (item: TItem) => boolean
  /** Get node color based on item */
  getNodeColor?: (item: TItem | DraftItem, isDraft: boolean) => string
  /** Get level badge text */
  getLevelBadge?: (level: number) => string
}

export interface HierarchyChartDesignerProps<TItem extends HierarchyChartItem> {
  items: TItem[]
  selectedItemId?: string | null
  onSelect?: (item: TItem | null) => void
  onAdd?: (parentId?: string | null) => void
  onEdit?: (item: TItem) => void
  onDelete?: (item: TItem) => void
  onSave?: (updates: Array<{ id: string; positionX: number; positionY: number; level?: number }>) => void
  onUpdateParent?: (itemId: string, newParentId: string | null) => void
  /** Called when inline creation is used - receives array of new items */
  onCreate?: (drafts: DraftItem[]) => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
  canCreate?: boolean
  isLoading?: boolean
  isSaving?: boolean
  className?: string
  config?: HierarchyChartConfig<TItem>
  /** Whether fullscreen mode is enabled */
  isFullscreen?: boolean
  /** Callback when fullscreen mode changes */
  onFullscreenChange?: (isFullscreen: boolean) => void
  /** Render custom properties panel */
  renderPropertiesPanel?: (args: {
    item: TItem | null
    draft: DraftItem | null
    isOpen: boolean
    onClose: () => void
    onUpdateDraft: (updates: Partial<DraftItem>) => void
    onDeleteDraft: () => void
    onSave: () => void
    hasChanges: boolean
    isSaving: boolean
  }) => ReactNode
}

// Layout constants
const NODE_WIDTH = 220
const NODE_HEIGHT = 120
const HORIZONTAL_GAP = 50
const VERTICAL_GAP = 100

// Auto-layout algorithm
function autoLayout<TItem extends HierarchyChartItem>(items: TItem[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  
  if (items.length === 0) return positions
  
  const childrenByParent = new Map<string | null, TItem[]>()
  
  for (const item of items) {
    const parentId = item.parentId
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, [])
    }
    childrenByParent.get(parentId)!.push(item)
  }
  
  // Sort children by level then sortOrder
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
  }
  
  // Calculate subtree widths
  const subtreeWidths = new Map<string, number>()
  
  function calcSubtreeWidth(itemId: string): number {
    if (subtreeWidths.has(itemId)) return subtreeWidths.get(itemId)!
    
    const children = childrenByParent.get(itemId) || []
    if (children.length === 0) {
      subtreeWidths.set(itemId, NODE_WIDTH)
      return NODE_WIDTH
    }
    
    let childrenWidth = 0
    for (const child of children) {
      childrenWidth += calcSubtreeWidth(child.id)
    }
    childrenWidth += Math.max(0, children.length - 1) * HORIZONTAL_GAP
    
    const width = Math.max(NODE_WIDTH, childrenWidth)
    subtreeWidths.set(itemId, width)
    return width
  }
  
  // Position subtree
  function positionSubtree(item: TItem, centerX: number, depth: number) {
    positions.set(item.id, {
      x: centerX,
      y: depth * (NODE_HEIGHT + VERTICAL_GAP),
    })
    
    const children = childrenByParent.get(item.id) || []
    if (children.length === 0) return
    
    let totalWidth = 0
    for (const child of children) {
      totalWidth += subtreeWidths.get(child.id) || NODE_WIDTH
    }
    totalWidth += Math.max(0, children.length - 1) * HORIZONTAL_GAP
    
    let currentX = centerX - totalWidth / 2
    
    for (const child of children) {
      const childWidth = subtreeWidths.get(child.id) || NODE_WIDTH
      positionSubtree(child, currentX + childWidth / 2, depth + 1)
      currentX += childWidth + HORIZONTAL_GAP
    }
  }
  
  // Find and position root nodes
  const itemIds = new Set(items.map(i => i.id))
  const rootNodes = items.filter(i => !i.parentId || !itemIds.has(i.parentId))
  rootNodes.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
  
  for (const root of rootNodes) {
    calcSubtreeWidth(root.id)
  }
  
  let totalRootsWidth = 0
  for (const root of rootNodes) {
    totalRootsWidth += subtreeWidths.get(root.id) || NODE_WIDTH
  }
  totalRootsWidth += Math.max(0, rootNodes.length - 1) * HORIZONTAL_GAP
  
  let currentX = -totalRootsWidth / 2
  for (const root of rootNodes) {
    const rootWidth = subtreeWidths.get(root.id) || NODE_WIDTH
    positionSubtree(root, currentX + rootWidth / 2, 0)
    currentX += rootWidth + HORIZONTAL_GAP
  }
  
  return positions
}

// Convert item to node
function itemToNode<TItem extends HierarchyChartItem>(
  item: TItem,
  config?: HierarchyChartConfig<TItem>
): Node<HierarchyNodeData> {
  return {
    id: item.id,
    type: "hierarchy",
    position: { x: item.positionX, y: item.positionY },
    data: {
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      level: item.level,
      parentId: item.parentId,
      childCount: config?.getChildCount?.(item) ?? 0,
    },
  }
}

// Create edges from items
function createEdges<TItem extends HierarchyChartItem>(items: TItem[]): Edge[] {
  return items
    .filter(item => item.parentId)
    .map(item => ({
      id: `${item.parentId}-${item.id}`,
      source: item.parentId!,
      target: item.id,
      type: "smoothstep",
      animated: false,
      style: { strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
    }))
}

// Default node component
function DefaultHierarchyNode({ 
  data, 
  selected,
  config,
}: { 
  data: HierarchyNodeData
  selected: boolean
  config?: HierarchyChartConfig<HierarchyChartItem>
}) {
  const levelBadge = config?.getLevelBadge?.(data.level) ?? `L${data.level}`
  
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-card shadow-sm min-w-[180px] max-w-[250px]",
        "transition-all duration-150",
        data.isDraft && "border-dashed border-amber-500/70 bg-amber-500/5",
        selected ? "border-primary shadow-md ring-2 ring-primary/20" : !data.isDraft && "border-border hover:border-primary/50"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !border-primary-foreground !w-3 !h-3"
      />
      
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
          data.level === 0 ? "bg-primary text-primary-foreground" : "bg-primary/10"
        )}>
          <FolderTree className={cn("h-5 w-5", data.level === 0 ? "" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{data.name}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {data.description}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {data.isDraft && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                Draft
              </Badge>
            )}
            {!data.isDraft && data.childCount > 0 && (
              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                <ChevronRight className="h-3 w-3 mr-1" />
                {data.childCount}
              </Badge>
            )}
            <Badge 
              variant={data.level === 0 ? "default" : "secondary"} 
              className="text-xs font-mono px-1.5 py-0"
            >
              {levelBadge}
            </Badge>
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !border-primary-foreground !w-3 !h-3"
      />
    </div>
  )
}

export function HierarchyChartDesigner<TItem extends HierarchyChartItem>({
  items,
  selectedItemId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onUpdateParent,
  onCreate,
  canEdit = true,
  canDelete = true,
  canCreate = true,
  isLoading,
  isSaving,
  className,
  config,
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
  renderPropertiesPanel,
}: HierarchyChartDesignerProps<TItem>) {
  const labels = config?.labels || {}
  const itemName = labels.itemName || "item"
  
  // Fullscreen state
  const [internalFullscreen, setInternalFullscreen] = useState(false)
  const isFullscreen = controlledFullscreen ?? internalFullscreen
  
  const toggleFullscreen = useCallback(() => {
    const newValue = !isFullscreen
    setInternalFullscreen(newValue)
    onFullscreenChange?.(newValue)
  }, [isFullscreen, onFullscreenChange])
  
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, toggleFullscreen])
  
  // Convert items to nodes - apply auto-layout if all positions are 0,0
  const initialNodes = useMemo(() => {
    const needsAutoLayout = items.length > 0 && items.every(item => 
      item.positionX === 0 && item.positionY === 0
    )
    
    if (needsAutoLayout) {
      const positions = autoLayout(items)
      return items.map(item => {
        const pos = positions.get(item.id)
        const node = itemToNode(item, config)
        if (pos) {
          return { ...node, position: pos }
        }
        return node
      })
    }
    
    return items.map(item => itemToNode(item, config))
  }, [items, config])
  const initialEdges = useMemo(() => createEdges(items), [items])
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Draft items state
  const [draftItems, setDraftItems] = useState<Map<string, DraftItem>>(new Map())
  
  // Properties panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  // Context menu state
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  // Create node types with config
  const nodeTypes = useMemo(() => ({
    hierarchy: (props: { data: HierarchyNodeData; selected: boolean }) => (
      <DefaultHierarchyNode {...props} config={config as HierarchyChartConfig<HierarchyChartItem>} />
    ),
  }), [config])
  
  // Sync nodes from items
  useEffect(() => {
    // Check if all items have default positions (0,0) - need auto-layout
    const needsAutoLayout = items.length > 0 && items.every(item => 
      item.positionX === 0 && item.positionY === 0
    )
    
    if (needsAutoLayout) {
      // Apply auto-layout when positions haven't been set
      const positions = autoLayout(items)
      
      setNodes(prevNodes => {
        const existingNodes = items.map(item => {
          const pos = positions.get(item.id)
          const node = itemToNode(item, config)
          if (pos) {
            return { ...node, position: pos }
          }
          return node
        })
        const draftNodesInState = prevNodes.filter(n => n.id.startsWith("draft-"))
        return [...existingNodes, ...draftNodesInState]
      })
    } else {
      setNodes(prevNodes => {
        const existingNodes = items.map(item => itemToNode(item, config))
        const draftNodesInState = prevNodes.filter(n => n.id.startsWith("draft-"))
        return [...existingNodes, ...draftNodesInState]
      })
    }
    
    setEdges(prevEdges => {
      const existingEdges = createEdges(items)
      const draftEdgesInState = prevEdges.filter(e => e.target.startsWith("draft-"))
      return [...existingEdges, ...draftEdgesInState]
    })
  }, [items, config, setNodes, setEdges])
  
  // Clear hasChanges when drafts are cleared
  useEffect(() => {
    if (draftItems.size === 0) {
      setHasChanges(false)
    }
  }, [draftItems.size])
  
  // Add draft item
  const addDraftItem = useCallback((parentId?: string | null) => {
    const newId = `draft-${Date.now()}`
    const parentItem = parentId ? items.find(i => i.id === parentId) : null
    
    const inferredLevel = parentItem ? parentItem.level + 1 : 0
    
    const nodeHeight = 120
    const verticalGap = 80
    let posX = 100 + nodes.length * 50
    const posY = inferredLevel * (nodeHeight + verticalGap)
    
    if (parentItem) {
      posX = parentItem.positionX + 100
    }
    
    const newDraft: DraftItem = {
      id: newId,
      name: `New ${itemName}`,
      description: "",
      parentId: parentId || null,
      level: inferredLevel,
      positionX: posX,
      positionY: posY,
    }
    
    setDraftItems(prev => new Map(prev).set(newId, newDraft))
    
    const newNode: Node<HierarchyNodeData> = {
      id: newId,
      type: "hierarchy",
      position: { x: posX, y: posY },
      data: {
        id: newId,
        name: newDraft.name,
        description: newDraft.description,
        level: inferredLevel,
        parentId: newDraft.parentId,
        childCount: 0,
        isDraft: true,
      },
    }
    setNodes(prevNodes => [...prevNodes, newNode])
    
    if (parentId) {
      setEdges(prevEdges => [...prevEdges, {
        id: `${parentId}-${newId}`,
        source: parentId,
        target: newId,
        type: "smoothstep",
        animated: true,
        style: { strokeWidth: 2, strokeDasharray: "5 5" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
      }])
    }
    
    setHasChanges(true)
    setEditingItemId(newId)
    setIsPanelOpen(true)
  }, [items, nodes.length, itemName, setNodes, setEdges])
  
  // Handle node position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes as NodeChange<Node<HierarchyNodeData>>[])
    
    const hasPositionChange = changes.some(
      change => change.type === "position" && "dragging" in change && change.dragging === false
    )
    if (hasPositionChange) {
      setHasChanges(true)
    }
  }, [onNodesChange])
  
  // Handle node selection
  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (selectedNodes.length === 1) {
      const selectedNode = selectedNodes[0]
      const nodeData = selectedNode.data as HierarchyNodeData
      
      if (editingItemId === selectedNode.id) return
      
      if (nodeData.isDraft) {
        setEditingItemId(selectedNode.id)
        setIsPanelOpen(true)
        onSelect?.(null)
      } else {
        const item = items.find(i => i.id === selectedNode.id)
        onSelect?.(item || null)
        
        if (item && canEdit) {
          setEditingItemId(item.id)
          setIsPanelOpen(true)
        }
      }
    } else {
      setEditingItemId(null)
      onSelect?.(null)
    }
  }, [items, onSelect, canEdit, editingItemId])
  
  // Handle double-click to edit
  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("draft-")) return
    if (!canEdit || !onEdit) return
    const item = items.find(i => i.id === node.id)
    if (item) {
      onEdit(item)
    }
  }, [items, canEdit, onEdit])
  
  // Handle connection
  const handleConnect: OnConnect = useCallback((connection: Connection) => {
    if (!canEdit) return
    
    const { source, target } = connection
    if (!source || !target || source === target) return
    
    if (target.startsWith("draft-")) {
      setDraftItems(prev => {
        const d = prev.get(target)
        if (!d) return prev
        const newMap = new Map(prev)
        const parentItem = items.find(i => i.id === source)
        const inferredLevel = parentItem ? parentItem.level + 1 : 0
        newMap.set(target, { ...d, parentId: source, level: inferredLevel })
        return newMap
      })
      
      setNodes(prevNodes => prevNodes.map(node => {
        if (node.id !== target) return node
        const currentData = node.data as HierarchyNodeData
        const parentItem = items.find(i => i.id === source)
        const inferredLevel = parentItem ? parentItem.level + 1 : 0
        return { ...node, data: { ...currentData, parentId: source, level: inferredLevel } }
      }))
      
      setEdges(prevEdges => {
        const filteredEdges = prevEdges.filter(e => e.target !== target)
        return [...filteredEdges, {
          id: `${source}-${target}`,
          source: source,
          target: target,
          type: "smoothstep",
          animated: true,
          style: { strokeWidth: 2, strokeDasharray: "5 5" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
        }]
      })
      
      setHasChanges(true)
      return
    }
    
    if (onUpdateParent) {
      onUpdateParent(target, source)
    }
  }, [canEdit, items, onUpdateParent, setNodes, setEdges])
  
  // Context menu handlers
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
    setContextMenuNodeId(node.id)
  }, [])
  
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
    setContextMenuNodeId(null)
  }, [])
  
  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null)
    setContextMenuNodeId(null)
  }, [])
  
  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    const positions = autoLayout(items)
    
    setNodes(prevNodes => prevNodes.map(node => {
      const pos = positions.get(node.id)
      if (pos) {
        return { ...node, position: pos }
      }
      return node
    }))
    
    setHasChanges(true)
  }, [items, setNodes])
  
  // Save handler
  const handleSave = useCallback(async () => {
    const drafts = Array.from(draftItems.values())
    const invalidDrafts = drafts.filter(d => !d.name.trim())
    
    if (invalidDrafts.length > 0) {
      return
    }
    
    // Save existing item positions
    const positionUpdates = nodes
      .filter(node => !node.id.startsWith("draft-"))
      .map(node => {
        const nodeData = node.data as HierarchyNodeData
        return {
          id: node.id,
          positionX: Math.round(node.position.x),
          positionY: Math.round(node.position.y),
          level: nodeData.level,
        }
      })
    
    if (positionUpdates.length > 0) {
      onSave?.(positionUpdates)
    }
    
    // Create draft items
    if (drafts.length > 0 && onCreate) {
      const draftsWithPositions = drafts.map(draft => {
        const node = nodes.find(n => n.id === draft.id)
        return {
          ...draft,
          positionX: node ? Math.round(node.position.x) : draft.positionX,
          positionY: node ? Math.round(node.position.y) : draft.positionY,
        }
      })
      
      await onCreate(draftsWithPositions)
      
      setDraftItems(new Map())
      setNodes(prevNodes => prevNodes.filter(n => !n.id.startsWith("draft-")))
      setEdges(prevEdges => prevEdges.filter(e => !e.target.startsWith("draft-")))
      setIsPanelOpen(false)
      setEditingItemId(null)
    }
    
    setHasChanges(false)
  }, [nodes, draftItems, onSave, onCreate, setNodes, setEdges])
  
  // Update draft handler
  const handleUpdateDraft = useCallback((updates: Partial<DraftItem>) => {
    if (!editingItemId || !editingItemId.startsWith("draft-")) return
    
    setDraftItems(prev => {
      const draft = prev.get(editingItemId)
      if (!draft) return prev
      const newMap = new Map(prev)
      newMap.set(editingItemId, { ...draft, ...updates })
      return newMap
    })
    
    // Update node visual
    setNodes(prevNodes => prevNodes.map(node => {
      if (node.id !== editingItemId) return node
      const currentData = node.data as HierarchyNodeData
      return {
        ...node,
        data: {
          ...currentData,
          name: updates.name ?? currentData.name,
          description: updates.description ?? currentData.description,
          level: updates.level ?? currentData.level,
          parentId: updates.parentId !== undefined ? updates.parentId : currentData.parentId,
        },
      }
    }))
    
    // Update edges if parent changed
    if (updates.parentId !== undefined) {
      setEdges(prevEdges => {
        const filteredEdges = prevEdges.filter(e => e.target !== editingItemId)
        if (updates.parentId) {
          return [...filteredEdges, {
            id: `${updates.parentId}-${editingItemId}`,
            source: updates.parentId,
            target: editingItemId,
            type: "smoothstep",
            animated: true,
            style: { strokeWidth: 2, strokeDasharray: "5 5" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
          }]
        }
        return filteredEdges
      })
    }
    
    setHasChanges(true)
  }, [editingItemId, setNodes, setEdges])
  
  // Delete draft handler
  const handleDeleteDraft = useCallback(() => {
    if (!editingItemId || !editingItemId.startsWith("draft-")) return
    
    setDraftItems(prev => {
      const newMap = new Map(prev)
      newMap.delete(editingItemId)
      return newMap
    })
    
    setNodes(prevNodes => prevNodes.filter(node => node.id !== editingItemId))
    setEdges(prevEdges => prevEdges.filter(e => e.source !== editingItemId && e.target !== editingItemId))
    
    setIsPanelOpen(false)
    setEditingItemId(null)
    onSelect?.(null)
  }, [editingItemId, onSelect, setNodes, setEdges])
  
  // Close panel
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])
  
  // Get selected/editing item
  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId) || null, [items, selectedItemId])
  const editingItem = useMemo(() => items.find(i => i.id === editingItemId) || null, [items, editingItemId])
  const editingDraft = useMemo(() => 
    editingItemId?.startsWith("draft-") ? draftItems.get(editingItemId) || null : null
  , [editingItemId, draftItems])
  
  // Context menu item
  const contextMenuItem = useMemo(() => 
    contextMenuNodeId ? items.find(i => i.id === contextMenuNodeId) || null : null
  , [items, contextMenuNodeId])
  
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-muted/30 rounded-lg", className)}>
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    )
  }
  
  if (items.length === 0 && draftItems.size === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg", className)}>
        {config?.emptyIcon || <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />}
        <h3 className="text-lg font-semibold mb-2">{labels.emptyTitle || `No ${itemName}s to display`}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">
          {labels.emptyDescription || `Add ${itemName}s to visualize your hierarchy.`}
        </p>
        {canCreate && (onCreate || onAdd) && (
          <Button onClick={() => onCreate ? addDraftItem(null) : onAdd?.(null)}>
            <Plus className="h-4 w-4 mr-2" />
            {labels.emptyActionLabel || `Add First ${itemName}`}
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <div 
      className={cn(
        "relative h-full",
        isFullscreen && "fixed inset-0 z-50 bg-background",
        className
      )} 
      onClick={closeContextMenu}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit && (!!onUpdateParent || !!onCreate)}
        selectNodesOnDrag={false}
        className="bg-background"
      >
        <Background 
          gap={20} 
          size={1} 
          className="[&>pattern>circle]:fill-muted-foreground/20" 
        />
        <Controls 
          showInteractive={false} 
          className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent"
        />
        <MiniMap 
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-card !border-border"
          maskColor="hsl(var(--background) / 0.8)"
          nodeColor={() => "hsl(var(--primary))"}
        />
        
        {/* Toolbar Panel */}
        {canEdit && (
          <Panel position="top-left" className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-card rounded-lg shadow-sm border border-border p-1">
              {canCreate && (onCreate || onAdd) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreate ? addDraftItem(null) : onAdd?.(null)}
                  className="h-8 px-2"
                  title={`Add Top-Level ${itemName}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <FolderTree className="h-4 w-4" />
                </Button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreate ? addDraftItem(selectedItemId) : onAdd?.(selectedItemId)}
                  className="h-8 px-2"
                  title={labels.addChild || `Add Child ${itemName}`}
                  disabled={!selectedItemId || selectedItemId.startsWith("draft-")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <span className="h-6 w-px bg-border mx-1 self-center" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAutoLayout}
                className="h-8 px-2"
                title="Auto Layout"
              >
                <Layout className="h-4 w-4" />
              </Button>
              <span className="h-6 w-px bg-border mx-1 self-center" />
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 px-2"
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
            
            {(onSave || onCreate) && (
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                size="sm"
                className="h-8 shadow-sm"
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
          </Panel>
        )}
        
        {/* Read-only fullscreen button */}
        {!canEdit && (
          <Panel position="top-left" className="flex items-center gap-2">
            <div className="flex gap-1 bg-card rounded-lg shadow-sm border border-border p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 px-2"
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </Panel>
        )}
        
        {/* Tips panel */}
        {canEdit && !isPanelOpen && (
          <Panel position="top-right" className="max-w-xs">
            <div className="bg-card/90 backdrop-blur border rounded-lg px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <strong className="text-foreground">Tips:</strong> Click to select • Double-click to edit • Right-click for menu • Drag from ● handles to link
            </div>
          </Panel>
        )}
      </ReactFlow>
      
      {/* Properties Panel - Render prop or default */}
      {renderPropertiesPanel?.({
        item: editingItem,
        draft: editingDraft,
        isOpen: isPanelOpen,
        onClose: handleClosePanel,
        onUpdateDraft: handleUpdateDraft,
        onDeleteDraft: handleDeleteDraft,
        onSave: handleSave,
        hasChanges,
        isSaving: isSaving || false,
      })}
      
      {/* Context Menu */}
      {contextMenuPos && (
        <div 
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] bg-popover border rounded-md shadow-lg p-1"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenuItem ? (
            <>
              {onEdit && canEdit && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    onEdit(contextMenuItem)
                    closeContextMenu()
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  {labels.editItem || `Edit ${itemName}`}
                </button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    if (onCreate) {
                      addDraftItem(contextMenuItem.id)
                    } else {
                      onAdd?.(contextMenuItem.id)
                    }
                    closeContextMenu()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {labels.addChild || `Add Child ${itemName}`}
                </button>
              )}
              {onUpdateParent && canEdit && contextMenuItem.parentId && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    onUpdateParent(contextMenuItem.id, null)
                    closeContextMenu()
                  }}
                >
                  <Link className="h-4 w-4" />
                  {labels.makeTopLevel || "Make Top-Level"}
                </button>
              )}
              {onDelete && canDelete && (
                <>
                  <div className="h-px bg-border my-1" />
                  <button
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left text-destructive"
                    onClick={() => {
                      onDelete(contextMenuItem)
                      closeContextMenu()
                    }}
                    disabled={config?.canDeleteItem ? !config.canDeleteItem(contextMenuItem) : false}
                  >
                    <Trash2 className="h-4 w-4" />
                    {labels.deleteItem || `Delete ${itemName}`}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {canCreate && (onCreate || onAdd) && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    if (onCreate) {
                      addDraftItem(null)
                    } else {
                      onAdd?.(null)
                    }
                    closeContextMenu()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {labels.addItem || `Add New ${itemName}`}
                </button>
              )}
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                onClick={() => {
                  handleAutoLayout()
                  closeContextMenu()
                }}
                disabled={!canEdit}
              >
                <Layout className="h-4 w-4" />
                Auto Layout
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
