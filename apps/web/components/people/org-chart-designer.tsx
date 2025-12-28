"use client"

import { useCallback, useState, useMemo, useEffect, useRef } from "react"
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
  type EdgeChange,
  type Connection,
  type OnConnect,
  Panel,
  MarkerType,
  Handle,
  Position,
  addEdge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Plus, 
  Save, 
  Layout, 
  Building2,
  Users,
  Pencil,
  Trash2,
  ChevronRight,
  Link,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { type OrganizationalRole } from "@/lib/api/org-roles"
import { type OrganizationalLevel } from "@/lib/api/org-levels"

// Team type for inline editing
interface TeamOption {
  id: string
  name: string
}

// Node data type - index signature required for React Flow compatibility
interface RoleNodeData {
  id: string
  name: string
  description?: string
  teamId?: string
  teamName?: string
  level: number
  levelCode?: string // e.g., "L0", "L1"
  levelName?: string // e.g., "Executive", "Director"
  holderCount: number
  childCount: number
  parentRoleId: string | null
  isDraft?: boolean // New/unsaved node
  [key: string]: unknown
}

// Custom node component for roles
function RoleNode({ data, selected }: { data: RoleNodeData; selected: boolean }) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-card shadow-sm min-w-[180px] max-w-[250px]",
        "transition-all duration-150",
        data.isDraft && "border-dashed border-amber-500/70 bg-amber-500/5",
        selected ? "border-primary shadow-md ring-2 ring-primary/20" : !data.isDraft && "border-border hover:border-primary/50"
      )}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !border-primary-foreground !w-3 !h-3"
      />
      
      {/* Content */}
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
          data.level === 0 ? "bg-primary text-primary-foreground" : "bg-primary/10"
        )}>
          <Building2 className={cn("h-5 w-5", data.level === 0 ? "" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{data.name}</div>
          {data.teamName && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              <Users className="h-3 w-3 inline mr-1" />
              {data.teamName}
            </div>
          )}
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
            {!data.isDraft && data.holderCount > 0 && (
              <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
                <Users className="h-3 w-3 mr-1" />
                {data.holderCount}
              </Badge>
            )}
            {!data.isDraft && data.childCount > 0 && (
              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                <ChevronRight className="h-3 w-3 mr-1" />
                {data.childCount}
              </Badge>
            )}
            {/* Level badge - show for all nodes */}
            <Badge 
              variant={data.level === 0 ? "default" : "secondary"} 
              className="text-xs font-mono px-1.5 py-0"
            >
              {data.levelCode || `L${data.level}`}
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !border-primary-foreground !w-3 !h-3"
      />
    </div>
  )
}

// Node types
const nodeTypes = {
  role: RoleNode,
}

// Convert role to node
function roleToNode(role: OrganizationalRole & { levelCode?: string; levelName?: string }): Node<RoleNodeData> {
  return {
    id: role.id,
    type: "role",
    position: { x: role.positionX, y: role.positionY },
    data: {
      id: role.id,
      name: role.name,
      description: role.description,
      teamName: role.team?.name,
      level: role.level,
      levelCode: role.levelCode || `L${role.level}`,
      levelName: role.levelName,
      holderCount: role.holderCount,
      childCount: role.childCount,
      parentRoleId: role.parentRoleId,
    },
  }
}

// Create edges from roles - simple smoothstep for all connections
function createEdges(roles: OrganizationalRole[]): Edge[] {
  return roles
    .filter(role => role.parentRoleId)
    .map(role => ({
      id: `${role.parentRoleId}-${role.id}`,
      source: role.parentRoleId!,
      target: role.id,
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

// Layout constants
const NODE_WIDTH = 220
const NODE_HEIGHT = 120
const HORIZONTAL_GAP = 50
const VERTICAL_GAP = 100

// Auto-layout algorithm - tree based on parent hierarchy
// Level field only affects horizontal sibling ordering (L1 before L2, etc.)
// Vertical position is based on depth in hierarchy, not level field
function autoLayout(roles: OrganizationalRole[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  
  if (roles.length === 0) return positions
  
  // Build parent-children map
  const childrenByParent = new Map<string | null, OrganizationalRole[]>()
  
  for (const role of roles) {
    const parentId = role.parentRoleId
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, [])
    }
    childrenByParent.get(parentId)!.push(role)
  }
  
  // Sort children by level (ascending) for horizontal ordering, then by sortOrder
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
  }
  
  // Calculate subtree width
  const subtreeWidths = new Map<string, number>()
  
  function calcSubtreeWidth(roleId: string): number {
    if (subtreeWidths.has(roleId)) return subtreeWidths.get(roleId)!
    
    const children = childrenByParent.get(roleId) || []
    if (children.length === 0) {
      subtreeWidths.set(roleId, NODE_WIDTH)
      return NODE_WIDTH
    }
    
    // Total width is sum of all children's subtree widths
    let childrenWidth = 0
    for (const child of children) {
      childrenWidth += calcSubtreeWidth(child.id)
    }
    childrenWidth += Math.max(0, children.length - 1) * HORIZONTAL_GAP
    
    const width = Math.max(NODE_WIDTH, childrenWidth)
    subtreeWidths.set(roleId, width)
    return width
  }
  
  // Position a node and all its descendants
  // depth = hierarchy depth (0 for root, 1 for root's children, etc.)
  function positionSubtree(role: OrganizationalRole, centerX: number, depth: number) {
    // Position based on hierarchy depth, not level field
    positions.set(role.id, {
      x: centerX,
      y: depth * (NODE_HEIGHT + VERTICAL_GAP),
    })
    
    const children = childrenByParent.get(role.id) || []
    if (children.length === 0) return
    
    // Calculate total width for children
    let totalWidth = 0
    for (const child of children) {
      totalWidth += subtreeWidths.get(child.id) || NODE_WIDTH
    }
    totalWidth += Math.max(0, children.length - 1) * HORIZONTAL_GAP
    
    // Position children centered under parent, at depth + 1
    let currentX = centerX - totalWidth / 2
    
    for (const child of children) {
      const childWidth = subtreeWidths.get(child.id) || NODE_WIDTH
      positionSubtree(child, currentX + childWidth / 2, depth + 1)
      currentX += childWidth + HORIZONTAL_GAP
    }
  }
  
  // Find root nodes (no parent or parent not in list)
  const roleIds = new Set(roles.map(r => r.id))
  const rootNodes = roles.filter(r => !r.parentRoleId || !roleIds.has(r.parentRoleId))
  rootNodes.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
  
  // Calculate subtree widths
  for (const root of rootNodes) {
    calcSubtreeWidth(root.id)
  }
  
  // Calculate total width
  let totalRootsWidth = 0
  for (const root of rootNodes) {
    totalRootsWidth += subtreeWidths.get(root.id) || NODE_WIDTH
  }
  totalRootsWidth += Math.max(0, rootNodes.length - 1) * HORIZONTAL_GAP
  
  // Position all roots centered at depth 0
  let currentX = -totalRootsWidth / 2
  for (const root of rootNodes) {
    const rootWidth = subtreeWidths.get(root.id) || NODE_WIDTH
    positionSubtree(root, currentX + rootWidth / 2, 0)
    currentX += rootWidth + HORIZONTAL_GAP
  }
  
  return positions
}

// Draft role type for inline creation
export interface DraftRole {
  id: string
  name: string
  description: string
  teamId: string
  parentRoleId: string | null
  level: number
  positionX: number
  positionY: number
}

export interface OrgChartDesignerProps {
  roles: OrganizationalRole[]
  teams?: TeamOption[]
  levels?: OrganizationalLevel[]
  selectedRoleId?: string | null
  onSelect?: (role: OrganizationalRole | null) => void
  onAdd?: (parentRoleId?: string | null) => void
  onEdit?: (role: OrganizationalRole) => void
  onDelete?: (role: OrganizationalRole) => void
  onSave?: (updates: Array<{ id: string; positionX: number; positionY: number; level?: number }>) => void
  onUpdateParent?: (roleId: string, newParentId: string | null) => void
  onInlineUpdate?: (roleId: string, data: { name?: string; description?: string; teamId?: string; parentRoleId?: string | null; level?: number }) => void
  /** Called when saving draft roles - receives array of new roles to create */
  onCreate?: (drafts: DraftRole[]) => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
  canCreate?: boolean
  isLoading?: boolean
  isSaving?: boolean
  className?: string
  /** Whether fullscreen mode is enabled */
  isFullscreen?: boolean
  /** Callback when fullscreen mode changes */
  onFullscreenChange?: (isFullscreen: boolean) => void
}

export function OrgChartDesigner({
  roles,
  teams = [],
  levels = [],
  selectedRoleId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onUpdateParent,
  onInlineUpdate,
  onCreate,
  canEdit = true,
  canDelete = true,
  canCreate = true,
  isLoading,
  isSaving,
  className,
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
}: OrgChartDesignerProps) {
  // Fullscreen state - can be controlled or uncontrolled
  const [internalFullscreen, setInternalFullscreen] = useState(false)
  const isFullscreen = controlledFullscreen ?? internalFullscreen
  
  const toggleFullscreen = useCallback(() => {
    const newValue = !isFullscreen
    setInternalFullscreen(newValue)
    onFullscreenChange?.(newValue)
  }, [isFullscreen, onFullscreenChange])
  
  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, toggleFullscreen])
  // Helper function to get level info from sortOrder
  const getLevelInfo = useCallback((levelSortOrder: number) => {
    const level = levels.find(l => l.sortOrder === levelSortOrder)
    return level ? { code: level.code, name: level.name } : null
  }, [levels])
  
  // Convert roles to nodes and edges (with level info enrichment)
  const initialNodes = useMemo(() => roles.map(role => {
    const levelInfo = getLevelInfo(role.level)
    return roleToNode({
      ...role,
      levelCode: levelInfo?.code,
      levelName: levelInfo?.name,
    })
  }), [roles, getLevelInfo])
  const initialEdges = useMemo(() => createEdges(roles), [roles])
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Draft nodes state (new unsaved roles)
  const [draftNodes, setDraftNodes] = useState<Map<string, DraftRole>>(new Map())
  
  // Pending updates for existing roles (preview before save)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, {
    name?: string
    description?: string
    teamId?: string
    parentRoleId?: string | null
    level?: number
  }>>(new Map())
  
  // Properties panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null) // Track which role/draft we're editing
  const [editingRole, setEditingRole] = useState<{
    name: string
    description: string
    teamId: string
    parentRoleId: string | null
    level: number
    isDraft?: boolean
  } | null>(null)
  
  // Context menu state
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  // Sync nodes from roles prop changes only (not draft updates - those are handled directly)
  useEffect(() => {
    setNodes(prevNodes => {
      const existingNodes = roles.map(role => {
        const levelInfo = getLevelInfo(role.level)
        return roleToNode({
          ...role,
          levelCode: levelInfo?.code,
          levelName: levelInfo?.name,
        })
      })
      // Preserve any draft nodes that are already in the state
      const draftNodesInState = prevNodes.filter(n => n.id.startsWith("draft-"))
      return [...existingNodes, ...draftNodesInState]
    })
    
    setEdges(prevEdges => {
      const existingEdges = createEdges(roles)
      // Preserve any draft edges that are already in the state
      const draftEdgesInState = prevEdges.filter(e => e.target.startsWith("draft-"))
      return [...existingEdges, ...draftEdgesInState]
    })
  }, [roles, getLevelInfo, setNodes, setEdges])
  
  // Clear hasChanges when drafts and pending updates are cleared
  useEffect(() => {
    if (draftNodes.size === 0 && pendingUpdates.size === 0) {
    setHasChanges(false)
    }
  }, [draftNodes.size, pendingUpdates.size])
  
  // Add a draft role (inline creation)
  const addDraftRole = useCallback((parentRoleId?: string | null) => {
    const newId = `draft-${Date.now()}`
    const parentRole = parentRoleId ? roles.find(r => r.id === parentRoleId) : null
    
    // Auto-infer level from parent (can be overridden by user)
    const inferredLevel = parentRole ? parentRole.level + 1 : 0
    
    // Calculate position based on level
    const nodeHeight = 120
    const verticalGap = 80
    let posX = 100 + nodes.length * 50
    const posY = inferredLevel * (nodeHeight + verticalGap)
    
    if (parentRole) {
      // Position near parent horizontally
      posX = parentRole.positionX + 100
    }
    
    const newDraft: DraftRole = {
      id: newId,
      name: "New Role",
      description: "",
      teamId: teams[0]?.id || "",
      parentRoleId: parentRoleId || null,
      level: inferredLevel,
      positionX: posX,
      positionY: posY,
    }
    
    // Update draft state
    setDraftNodes(prev => new Map(prev).set(newId, newDraft))
    
    // Add draft node to visual nodes directly
    const newNode = {
      id: newId,
      type: "role" as const,
      position: { x: posX, y: posY },
      data: {
        id: newId,
        name: newDraft.name,
        description: newDraft.description,
        teamId: newDraft.teamId,
        teamName: teams.find(t => t.id === newDraft.teamId)?.name,
        level: inferredLevel,
        holderCount: 0,
        childCount: 0,
        parentRoleId: newDraft.parentRoleId,
        isDraft: true,
      } as RoleNodeData,
    }
    setNodes(prevNodes => [...prevNodes, newNode])
    
    // Add edge if parent exists
    if (parentRoleId) {
      setEdges(prevEdges => [...prevEdges, {
        id: `${parentRoleId}-${newId}`,
        source: parentRoleId,
        target: newId,
        type: "smoothstep" as const,
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
    
    // Select the new draft and open panel
    setEditingRoleId(newId)
    setEditingRole({
      name: newDraft.name,
      description: newDraft.description,
      teamId: newDraft.teamId,
      parentRoleId: newDraft.parentRoleId,
      level: inferredLevel,
      isDraft: true,
    })
    setIsPanelOpen(true)
    
    // Notify parent about selection change
    onSelect?.({
      id: newId,
      name: newDraft.name,
      description: newDraft.description,
      teamId: newDraft.teamId,
      parentRoleId: newDraft.parentRoleId,
      level: inferredLevel,
      holderCount: 0,
      childCount: 0,
      sortOrder: 0,
      positionX: posX,
      positionY: posY,
      team: teams.find(t => t.id === newDraft.teamId) ? { id: newDraft.teamId, name: teams.find(t => t.id === newDraft.teamId)!.name } : null,
      parentRole: parentRole ? { id: parentRole.id, name: parentRole.name, level: parentRole.level } : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }, [roles, nodes.length, teams, onSelect, setNodes, setEdges])
  
  // Track position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes as NodeChange<Node<RoleNodeData>>[])
    
    // Check if any position changed
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
      const nodeData = selectedNode.data as RoleNodeData
      
      // Don't re-initialize editing state if we're already editing this node
      if (editingRoleId === selectedNode.id) {
        return
      }
      
      // Check if it's a draft node
      if (nodeData.isDraft) {
        const draft = draftNodes.get(selectedNode.id)
        if (draft) {
          // Set local editing state FIRST (before notifying parent)
          setEditingRoleId(draft.id)
          setEditingRole({
            name: draft.name,
            description: draft.description,
            teamId: draft.teamId,
            parentRoleId: draft.parentRoleId,
            level: draft.level,
            isDraft: true,
          })
          setIsPanelOpen(true)
          // Create a fake role object for selection
          onSelect?.({
            id: draft.id,
            name: draft.name,
            description: draft.description,
            teamId: draft.teamId,
            parentRoleId: draft.parentRoleId,
            level: 0,
            holderCount: 0,
            childCount: 0,
            sortOrder: 0,
            positionX: draft.positionX,
            positionY: draft.positionY,
            team: teams.find(t => t.id === draft.teamId) ? { id: draft.teamId, name: teams.find(t => t.id === draft.teamId)!.name } : null,
            parentRole: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      } else {
      const role = roles.find(r => r.id === selectedNode.id)
      onSelect?.(role || null)
        
        // Open properties panel and set editing state
        if (role && canEdit) {
          setEditingRoleId(role.id)
          setEditingRole({
            name: role.name,
            description: role.description || "",
            teamId: role.teamId,
            parentRoleId: role.parentRoleId,
            level: role.level,
            isDraft: false,
          })
          setIsPanelOpen(true)
        }
      }
    } else {
      setEditingRoleId(null)
      onSelect?.(null)
    }
  }, [roles, draftNodes, teams, onSelect, canEdit, editingRoleId])
  
  // Handle node double-click to edit (only for existing roles, not drafts)
  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Don't open form drawer for draft nodes - they use the properties panel
    if (node.id.startsWith("draft-")) return
    if (!canEdit || !onEdit) return
    const role = roles.find(r => r.id === node.id)
    if (role) {
      onEdit(role)
    }
  }, [roles, canEdit, onEdit])
  
  // Handle connection (dragging from one node to another)
  const handleConnect: OnConnect = useCallback((connection: Connection) => {
    if (!canEdit) return
    
    // source = parent, target = child (we're connecting from parent's bottom to child's top)
    const { source, target } = connection
    if (!source || !target || source === target) return
    
    // Check if target is a draft node
    if (target.startsWith("draft-")) {
      // Update the draft's parentRoleId
      setDraftNodes(prev => {
        const d = prev.get(target)
        if (!d) return prev
        const newMap = new Map(prev)
        newMap.set(target, { ...d, parentRoleId: source })
        return newMap
      })
      
      // Update node data directly
      setNodes(prevNodes => prevNodes.map(node => {
        if (node.id !== target) return node
        const currentData = node.data as RoleNodeData
        return { ...node, data: { ...currentData, parentRoleId: source } }
      }))
      
      // Update edges directly - remove old edge, add new one
      setEdges(prevEdges => {
        const filteredEdges = prevEdges.filter(e => e.target !== target)
        return [...filteredEdges, {
          id: `${source}-${target}`,
          source: source,
          target: target,
          type: "smoothstep" as const,
          animated: true,
          style: { strokeWidth: 2, strokeDasharray: "5 5" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
        }]
      })
      
      // Also update the editing state if this draft is being edited
      if (editingRoleId === target) {
        setEditingRole(prev => {
          if (!prev) return prev
          return { ...prev, parentRoleId: source }
        })
      }
      
      setHasChanges(true)
      return
    }
    
    // For existing roles, use the onUpdateParent callback
    if (onUpdateParent) {
    onUpdateParent(target, source)
    }
  }, [canEdit, onUpdateParent, editingRoleId, setNodes, setEdges])
  
  // Handle right-click on node for context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
    setContextMenuNodeId(node.id)
  }, [])
  
  // Handle right-click on canvas for context menu
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
    setContextMenuNodeId(null)
  }, [])
  
  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null)
    setContextMenuNodeId(null)
  }, [])
  
  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    const positions = autoLayout(roles)
    
    setNodes(prevNodes => prevNodes.map(node => {
      const pos = positions.get(node.id)
      if (pos) {
        return { ...node, position: pos }
      }
      return node
    }))
    
    setHasChanges(true)
  }, [roles, setNodes])
  
  // Save positions, pending updates, and create draft nodes
  const handleSave = useCallback(async () => {
    // Validate draft nodes
    const drafts = Array.from(draftNodes.values())
    const invalidDrafts = drafts.filter(d => !d.name.trim() || !d.teamId)
    
    if (invalidDrafts.length > 0) {
      // Find the first invalid draft and select it
      const firstInvalid = invalidDrafts[0]
      setEditingRole({
        name: firstInvalid.name,
        description: firstInvalid.description,
        teamId: firstInvalid.teamId,
        parentRoleId: firstInvalid.parentRoleId,
        level: firstInvalid.level,
        isDraft: true,
      })
      setIsPanelOpen(true)
      return // Don't save, let validation errors show
    }
    
    // Apply pending updates to existing roles via API
    if (pendingUpdates.size > 0 && onInlineUpdate) {
      for (const [roleId, updates] of pendingUpdates) {
        await onInlineUpdate(roleId, updates)
      }
      setPendingUpdates(new Map())
    }
    
    // Save existing role positions and levels
    const positionUpdates = nodes
      .filter(node => !node.id.startsWith("draft-"))
      .map(node => {
        const nodeData = node.data as RoleNodeData
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
    
    // Create draft nodes if there are any
    if (drafts.length > 0 && onCreate) {
      // Update draft positions from nodes
      const draftsWithPositions = drafts.map(draft => {
        const node = nodes.find(n => n.id === draft.id)
        return {
          ...draft,
          positionX: node ? Math.round(node.position.x) : draft.positionX,
          positionY: node ? Math.round(node.position.y) : draft.positionY,
        }
      })
      
      await onCreate(draftsWithPositions)
      
      // Clear drafts from both state and visual
      setDraftNodes(new Map())
      setNodes(prevNodes => prevNodes.filter(n => !n.id.startsWith("draft-")))
      setEdges(prevEdges => prevEdges.filter(e => !e.target.startsWith("draft-")))
      setIsPanelOpen(false)
      setEditingRoleId(null)
      setEditingRole(null)
    }
    
    setHasChanges(false)
  }, [nodes, draftNodes, pendingUpdates, onSave, onInlineUpdate, onCreate, setNodes, setEdges])
  
  // Handle inline update from properties panel - applies immediately as preview
  const handleInlineUpdate = useCallback((field: keyof NonNullable<typeof editingRole>, value: string | number | null) => {
    if (!editingRoleId) return
    
    // Calculate inferred level when parentRoleId changes
    let inferredLevel: number | undefined
    if (field === "parentRoleId") {
      if (value) {
        const newParent = roles.find(r => r.id === value) || 
                          Array.from(draftNodes.values()).find(d => d.id === value)
        inferredLevel = newParent ? (newParent.level ?? 0) + 1 : 0
      } else {
        inferredLevel = 0 // Top-level role
      }
    }
    
    // Update editing role state
    setEditingRole(prev => {
      if (!prev) return prev
      const updates: Partial<NonNullable<typeof editingRole>> = { [field]: value }
      // Auto-update level when parentRoleId changes (user can override later)
      if (inferredLevel !== undefined) {
        updates.level = inferredLevel
      }
      return { ...prev, ...updates }
    })
    
    const isDraft = editingRoleId.startsWith("draft-")
    
    // If editing a draft, update draft state
    if (isDraft) {
      setDraftNodes(prev => {
        const draft = prev.get(editingRoleId)
        if (!draft) return prev
        const newMap = new Map(prev)
        const updates: Partial<DraftRole> = { [field]: value }
        if (inferredLevel !== undefined) {
          updates.level = inferredLevel
        }
        newMap.set(editingRoleId, { ...draft, ...updates })
        return newMap
      })
    } else {
      // For existing roles, track pending updates for bulk save
      setPendingUpdates(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(editingRoleId) || {}
        const updates: typeof existing = { ...existing, [field]: value }
        if (inferredLevel !== undefined) {
          updates.level = inferredLevel
        }
        newMap.set(editingRoleId, updates)
        return newMap
      })
    }
    
    // Update node visual directly for immediate feedback (both drafts and existing)
    setNodes(prevNodes => prevNodes.map(node => {
      if (node.id !== editingRoleId) return node
      
      const currentData = node.data as RoleNodeData
      let updatedData = { ...currentData }
      
      if (field === "name") {
        updatedData = { ...updatedData, name: (value as string) || (isDraft ? "New Role" : currentData.name) }
      } else if (field === "description") {
        updatedData = { ...updatedData, description: value as string ?? undefined }
      } else if (field === "teamId") {
        updatedData = { 
          ...updatedData, 
          teamId: value as string ?? undefined,
          teamName: teams.find(t => t.id === value)?.name 
        }
      } else if (field === "parentRoleId") {
        updatedData = { ...updatedData, parentRoleId: value as string | null }
        if (inferredLevel !== undefined) {
          updatedData.level = inferredLevel
        }
      } else if (field === "level") {
        updatedData = { ...updatedData, level: value as number }
      }
      // Note: isDraft is internal and not changed via handleInlineUpdate
      
      // Only auto-reposition Y when parentRoleId changes (based on hierarchy depth)
      // Level field only affects horizontal ordering, not vertical position
      if (field === "parentRoleId" && inferredLevel !== undefined) {
        const newY = inferredLevel * (NODE_HEIGHT + VERTICAL_GAP)
        return { ...node, data: updatedData, position: { ...node.position, y: newY } }
      }
      
      return { ...node, data: updatedData }
    }))
    
    // If changing parentRoleId, update edges too
    if (field === "parentRoleId") {
      // Determine if this is a skip-level connection
      const newParent = roles.find(r => r.id === value)
      const newParentLevel = newParent?.level ?? 0
      const childLevel = inferredLevel ?? editingRole?.level ?? 0
      const isSkipLevel = value && (newParentLevel + 1) !== childLevel
      
      setEdges(prevEdges => {
        // Remove old edges targeting this node
        const filteredEdges = prevEdges.filter(e => e.target !== editingRoleId)
        
        // Add new edge if parent is set
        if (value) {
          const edgeStyle = isDraft 
            ? { strokeWidth: 2, strokeDasharray: "5 5" }
            : { strokeWidth: 2, ...(isSkipLevel && { strokeDasharray: "5 5" }) }
          return [...filteredEdges, {
            id: `${value}-${editingRoleId}`,
            source: value as string,
            target: editingRoleId,
            type: "smoothstep" as const,
            animated: isDraft,
            style: edgeStyle,
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
  }, [editingRoleId, teams, roles, draftNodes, setNodes, setEdges])
  
  // Delete draft node
  const handleDeleteDraft = useCallback((draftId: string) => {
    // Remove from draft state
    setDraftNodes(prev => {
      const newMap = new Map(prev)
      newMap.delete(draftId)
      return newMap
    })
    
    // Remove from visual nodes
    setNodes(prevNodes => prevNodes.filter(node => node.id !== draftId))
    
    // Remove any edges connected to this draft
    setEdges(prevEdges => prevEdges.filter(e => e.source !== draftId && e.target !== draftId))
    
    setIsPanelOpen(false)
    setEditingRoleId(null)
    setEditingRole(null)
    onSelect?.(null)
    if (draftNodes.size <= 1 && pendingUpdates.size === 0) {
    setHasChanges(false)
    }
  }, [draftNodes.size, pendingUpdates.size, onSelect, setNodes, setEdges])
  
  // Close panel
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
    // Don't clear editingRoleId/editingRole so we can reopen with same state
  }, [])
  
  // Get selected role
  const selectedRole = useMemo(() => {
    return roles.find(r => r.id === selectedRoleId) || null
  }, [roles, selectedRoleId])
  
  // Get context menu role
  const contextMenuRole = useMemo(() => {
    return contextMenuNodeId ? roles.find(r => r.id === contextMenuNodeId) || null : null
  }, [roles, contextMenuNodeId])
  
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-muted/30 rounded-lg", className)}>
        <div className="text-muted-foreground">Loading org chart...</div>
      </div>
    )
  }
  
  if (roles.length === 0 && draftNodes.size === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg", className)}>
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No roles to display</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">
          Add organizational roles to visualize your company structure.
        </p>
        {canCreate && (onCreate || onAdd) && (
          <Button onClick={() => onCreate ? addDraftRole(null) : onAdd?.(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Role
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
          nodeColor={(node) => {
            const data = node.data as RoleNodeData | undefined
            if (data?.level === 0) {
              return "hsl(217 91% 60%)" // Blue for top-level
            }
            return "hsl(var(--primary))"
          }}
        />
        
        {/* Toolbar Panel - Left side */}
        {canEdit && (
          <Panel position="top-left" className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-card rounded-lg shadow-sm border border-border p-1">
              {canCreate && (onCreate || onAdd) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreate ? addDraftRole(null) : onAdd?.(null)}
                  className="h-8 px-2"
                  title="Add Top-Level Role"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <Building2 className="h-4 w-4" />
                </Button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreate ? addDraftRole(selectedRoleId) : onAdd?.(selectedRoleId)}
                  className="h-8 px-2"
                  title="Add Child Role"
                  disabled={!selectedRoleId || selectedRoleId.startsWith("draft-")}
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
        
        {/* Fullscreen button for read-only mode */}
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
        
        {/* Tips panel - moved to accommodate properties panel */}
        {canEdit && !isPanelOpen && (
          <Panel position="top-right" className="max-w-xs">
            <div className="bg-card/90 backdrop-blur border rounded-lg px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <strong className="text-foreground">Tips:</strong> Click to select • Double-click to edit • Right-click for menu • Drag from ● handles to link
            </div>
          </Panel>
        )}
      </ReactFlow>
      
      {/* Properties Panel - Right side slide-in */}
      {isPanelOpen && editingRole && editingRoleId && (selectedRole || editingRole.isDraft) && (
        <div 
          key={editingRoleId} 
          className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border shadow-lg overflow-y-auto z-10"
        >
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">
                {editingRole.isDraft ? "New Role" : "Role Properties"}
              </h3>
              {editingRole.isDraft && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
                  Draft
                </Badge>
              )}
            </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
              onClick={handleClosePanel}
              className="h-6 w-6"
                    >
              <X className="h-4 w-4" />
                    </Button>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="role-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-name"
                value={editingRole.name}
                onChange={(e) => handleInlineUpdate("name", e.target.value)}
                disabled={!canEdit}
                className={cn(!editingRole.name.trim() && editingRole.isDraft && "border-destructive")}
                placeholder="Enter role name..."
              />
              {!editingRole.name.trim() && editingRole.isDraft && (
                <p className="text-xs text-destructive">Name is required</p>
              )}
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={editingRole.description}
                onChange={(e) => handleInlineUpdate("description", e.target.value)}
                rows={3}
                disabled={!canEdit}
                placeholder="Describe the role's responsibilities..."
              />
            </div>
            
            {/* Team */}
            <div className="space-y-2">
              <Label>
                Team <span className="text-destructive">*</span>
              </Label>
              {teams.length > 0 ? (
                <>
                  <Select
                    key={`team-${editingRoleId}`}
                    value={editingRole.teamId ? editingRole.teamId : undefined}
                    onValueChange={(value) => handleInlineUpdate("teamId", value)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className={cn("w-full", !editingRole.teamId && editingRole.isDraft && "border-destructive")}>
                      <SelectValue placeholder="Select team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!editingRole.teamId && editingRole.isDraft && (
                    <p className="text-xs text-destructive">Team is required</p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedRole?.team?.name ?? "No team available"}</span>
                </div>
              )}
            </div>
            
            {/* Parent Role */}
            <div className="space-y-2">
              <Label>Reports To</Label>
              <Select
                key={`parent-${editingRoleId}`}
                value={editingRole.parentRoleId ?? "__none__"}
                onValueChange={(value) => handleInlineUpdate("parentRoleId", value === "__none__" ? null : value)}
                disabled={!canEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select parent role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">None (Top-level)</span>
                  </SelectItem>
                  {roles
                    .filter(r => !editingRoleId || r.id !== editingRoleId) // Exclude self
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name} <span className="text-muted-foreground text-xs ml-1">L{role.level}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Level - editable, auto-inferred from parent but can be overridden */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Level</Label>
                {(() => {
                  // Calculate what level would be auto-inferred
                  const parent = editingRole.parentRoleId 
                    ? roles.find(r => r.id === editingRole.parentRoleId) 
                    : null
                  const inferredLevel = parent ? parent.level + 1 : 0
                  const isCustomLevel = editingRole.level !== inferredLevel
                  return isCustomLevel ? (
                    <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500">
                      Custom
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Auto
                    </Badge>
                  )
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  key={`level-${editingRoleId}`}
                  value={String(editingRole.level)}
                  onValueChange={(value) => handleInlineUpdate("level", parseInt(value, 10))}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.length > 0 ? (
                      // Use levels from database
                      levels.map((lvl) => (
                        <SelectItem key={lvl.sortOrder} value={String(lvl.sortOrder)}>
                          {lvl.code} - {lvl.name}
                        </SelectItem>
                      ))
                    ) : (
                      // No levels defined - show message
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                        No levels defined.<br />
                        Go to Levels tab to add levels.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {/* Reset to auto-inferred level button */}
                {(() => {
                  const parent = editingRole.parentRoleId 
                    ? roles.find(r => r.id === editingRole.parentRoleId) 
                    : null
                  const inferredLevel = parent ? parent.level + 1 : 0
                  const isCustomLevel = editingRole.level !== inferredLevel
                  return isCustomLevel && canEdit ? (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleInlineUpdate("level", inferredLevel)}
                      title="Reset to auto-inferred level"
                      className="h-9 px-2"
                    >
                      <Layout className="h-4 w-4" />
                    </Button>
                  ) : null
                })()}
                </div>
              <p className="text-xs text-muted-foreground">
                Controls vertical positioning. Auto-inferred from parent level, but can be customized for skip-level reporting.
              </p>
              </div>
            
            {/* Info badges - only for existing roles */}
            {!editingRole.isDraft && selectedRole && (
              <div className="flex gap-4 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Holders</div>
                  <Badge variant="secondary" className="font-mono mt-1">{selectedRole.holderCount}</Badge>
                </div>
                  <div>
                  <div className="text-xs text-muted-foreground">Direct Reports</div>
                  <Badge variant="outline" className="font-mono mt-1">{selectedRole.childCount}</Badge>
                </div>
                  </div>
                )}
            
            {/* Draft info */}
            {editingRole.isDraft && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This role is not saved yet. Click the <strong>Save</strong> button in the toolbar to create it.
                </p>
                  </div>
                )}
            
            {/* Pending changes indicator for existing roles */}
            {!editingRole.isDraft && pendingUpdates.has(editingRoleId!) && (
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
                  <Save className="h-4 w-4" />
                  Changes pending - click Save on toolbar to apply
                  </div>
                  </div>
            )}
            
            {/* Open full edit drawer - existing roles only */}
            {!editingRole.isDraft && onEdit && canEdit && selectedRole && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => onEdit(selectedRole)}
                  className="w-full"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Open Full Editor
                </Button>
                  </div>
            )}
            
            {/* Add Child Role - existing roles only */}
            {!editingRole.isDraft && canCreate && (onCreate || onAdd) && editingRoleId && (
              <Button
                variant="outline"
                onClick={() => onCreate ? addDraftRole(editingRoleId) : onAdd?.(editingRoleId)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Child Role
              </Button>
            )}
            
            {/* Delete Button */}
            <div className="pt-4 border-t">
              {editingRole.isDraft && editingRoleId ? (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteDraft(editingRoleId)}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Draft
                </Button>
              ) : onDelete && canDelete && selectedRole && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(selectedRole)}
                    className="w-full"
                    disabled={selectedRole.childCount > 0 || selectedRole.holderCount > 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Role
                  </Button>
                  {(selectedRole.childCount > 0 || selectedRole.holderCount > 0) && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Cannot delete roles with holders or sub-roles
                    </p>
                  )}
                </>
              )}
                </div>
              </div>
            </div>
        )}
      
      {/* Context Menu */}
      {contextMenuPos && (
        <div 
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] bg-popover border rounded-md shadow-lg p-1"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenuRole ? (
            // Node context menu
            <>
              {onEdit && canEdit && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    onEdit(contextMenuRole)
                    closeContextMenu()
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Role
                </button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    if (onCreate) {
                      addDraftRole(contextMenuRole.id)
                    } else {
                      onAdd?.(contextMenuRole.id)
                    }
                    closeContextMenu()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Child Role
                </button>
              )}
              {onUpdateParent && canEdit && contextMenuRole.parentRoleId && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    onUpdateParent(contextMenuRole.id, null)
                    closeContextMenu()
                  }}
                >
                  <Link className="h-4 w-4" />
                  Make Top-Level
                </button>
              )}
              {onDelete && canDelete && (
                <>
                  <div className="h-px bg-border my-1" />
                  <button
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left text-destructive"
                    onClick={() => {
                      onDelete(contextMenuRole)
                      closeContextMenu()
                    }}
                    disabled={contextMenuRole.childCount > 0 || contextMenuRole.holderCount > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Role
                  </button>
                </>
              )}
            </>
          ) : (
            // Canvas context menu
            <>
              {canCreate && (onCreate || onAdd) && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    if (onCreate) {
                      addDraftRole(null)
                    } else {
                      onAdd?.(null)
                    }
                    closeContextMenu()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add New Role
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

