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
  Users,
  UserCheck,
  Pencil,
  Trash2,
  ChevronRight,
  Link,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { type Team, type TeamLead } from "@/lib/api/teams"

// Person option for lead selection
interface PersonOption {
  id: string
  name: string
}

// Node data type - index signature required for React Flow compatibility
interface TeamNodeData {
  id: string
  name: string
  description?: string
  leadId?: string | null
  leadName?: string
  memberCount: number
  childCount: number
  parentTeamId: string | null
  isDraft?: boolean // New/unsaved node
  [key: string]: unknown
}

// Custom node component for teams
function TeamNode({ data, selected }: { data: TeamNodeData; selected: boolean }) {
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
          data.parentTeamId === null ? "bg-primary text-primary-foreground" : "bg-primary/10"
        )}>
          <Users className={cn("h-5 w-5", data.parentTeamId !== null ? "text-primary" : "")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{data.name}</div>
          {data.leadName && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              <UserCheck className="h-3 w-3 inline mr-1" />
              {data.leadName}
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
            {!data.isDraft && data.memberCount > 0 && (
              <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
                <Users className="h-3 w-3 mr-1" />
                {data.memberCount}
              </Badge>
            )}
            {!data.isDraft && data.childCount > 0 && (
              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                <ChevronRight className="h-3 w-3 mr-1" />
                {data.childCount}
              </Badge>
            )}
            {/* Top-level badge */}
            {data.parentTeamId === null && !data.isDraft && (
              <Badge variant="default" className="text-xs px-1.5 py-0">
                Top
              </Badge>
            )}
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
  team: TeamNode,
}

// Extended team type with position
interface TeamWithPosition extends Team {
  positionX: number
  positionY: number
}

// Convert team to node
function teamToNode(team: TeamWithPosition): Node<TeamNodeData> {
  return {
    id: team.id,
    type: "team",
    position: { x: team.positionX, y: team.positionY },
    data: {
      id: team.id,
      name: team.name,
      description: team.description,
      leadId: team.leadId,
      leadName: team.lead?.name,
      memberCount: team.memberCount,
      childCount: team.childCount,
      parentTeamId: team.parentTeamId,
    },
  }
}

// Create edges from teams - simple smoothstep for all connections
function createEdges(teams: TeamWithPosition[]): Edge[] {
  return teams
    .filter(team => team.parentTeamId)
    .map(team => ({
      id: `${team.parentTeamId}-${team.id}`,
      source: team.parentTeamId!,
      target: team.id,
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
function autoLayout(teams: TeamWithPosition[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  
  if (teams.length === 0) return positions
  
  // Build parent-children map
  const childrenByParent = new Map<string | null, TeamWithPosition[]>()
  
  for (const team of teams) {
    const parentId = team.parentTeamId
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, [])
    }
    childrenByParent.get(parentId)!.push(team)
  }
  
  // Sort children by sortOrder
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.sortOrder - b.sortOrder)
  }
  
  // Calculate subtree width
  const subtreeWidths = new Map<string, number>()
  
  function calcSubtreeWidth(teamId: string): number {
    if (subtreeWidths.has(teamId)) return subtreeWidths.get(teamId)!
    
    const children = childrenByParent.get(teamId) || []
    if (children.length === 0) {
      subtreeWidths.set(teamId, NODE_WIDTH)
      return NODE_WIDTH
    }
    
    // Total width is sum of all children's subtree widths
    let childrenWidth = 0
    for (const child of children) {
      childrenWidth += calcSubtreeWidth(child.id)
    }
    childrenWidth += Math.max(0, children.length - 1) * HORIZONTAL_GAP
    
    const width = Math.max(NODE_WIDTH, childrenWidth)
    subtreeWidths.set(teamId, width)
    return width
  }
  
  // Position a node and all its descendants
  function positionSubtree(team: TeamWithPosition, centerX: number, depth: number) {
    positions.set(team.id, {
      x: centerX,
      y: depth * (NODE_HEIGHT + VERTICAL_GAP),
    })
    
    const children = childrenByParent.get(team.id) || []
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
  const teamIds = new Set(teams.map(t => t.id))
  const rootNodes = teams.filter(t => !t.parentTeamId || !teamIds.has(t.parentTeamId))
  rootNodes.sort((a, b) => a.sortOrder - b.sortOrder)
  
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

// Draft team type for inline creation
export interface DraftTeam {
  id: string
  name: string
  description: string
  leadId: string | null
  parentTeamId: string | null
  positionX: number
  positionY: number
}

export interface TeamChartDesignerProps {
  teams: TeamWithPosition[]
  people?: PersonOption[]
  selectedTeamId?: string | null
  onSelect?: (team: TeamWithPosition | null) => void
  onAdd?: (parentTeamId?: string | null) => void
  onEdit?: (team: TeamWithPosition) => void
  onDelete?: (team: TeamWithPosition) => void
  onSave?: (updates: Array<{ id: string; positionX: number; positionY: number }>) => void
  onUpdateParent?: (teamId: string, newParentId: string | null) => void
  onInlineUpdate?: (teamId: string, data: { name?: string; description?: string; leadId?: string | null; parentTeamId?: string | null }) => void
  /** Called when saving draft teams - receives array of new teams to create */
  onCreate?: (drafts: DraftTeam[]) => Promise<void>
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

export function TeamChartDesigner({
  teams,
  people = [],
  selectedTeamId,
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
}: TeamChartDesignerProps) {
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
  
  // Convert teams to nodes and edges
  const initialNodes = useMemo(() => teams.map(team => teamToNode(team)), [teams])
  const initialEdges = useMemo(() => createEdges(teams), [teams])
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Draft nodes state (new unsaved teams)
  const [draftNodes, setDraftNodes] = useState<Map<string, DraftTeam>>(new Map())
  
  // Pending updates for existing teams (preview before save)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, {
    name?: string
    description?: string
    leadId?: string | null
    parentTeamId?: string | null
  }>>(new Map())
  
  // Properties panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeam, setEditingTeam] = useState<{
    name: string
    description: string
    leadId: string | null
    parentTeamId: string | null
    isDraft?: boolean
  } | null>(null)
  
  // Context menu state
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  // Sync nodes from teams prop changes
  useEffect(() => {
    setNodes(prevNodes => {
      const existingNodes = teams.map(team => teamToNode(team))
      // Preserve any draft nodes that are already in the state
      const draftNodesInState = prevNodes.filter(n => n.id.startsWith("draft-"))
      return [...existingNodes, ...draftNodesInState]
    })
    
    setEdges(prevEdges => {
      const existingEdges = createEdges(teams)
      // Preserve any draft edges that are already in the state
      const draftEdgesInState = prevEdges.filter(e => e.target.startsWith("draft-"))
      return [...existingEdges, ...draftEdgesInState]
    })
  }, [teams, setNodes, setEdges])
  
  // Clear hasChanges when drafts and pending updates are cleared
  useEffect(() => {
    if (draftNodes.size === 0 && pendingUpdates.size === 0) {
      setHasChanges(false)
    }
  }, [draftNodes.size, pendingUpdates.size])
  
  // Add a draft team (inline creation)
  const addDraftTeam = useCallback((parentTeamId?: string | null) => {
    const newId = `draft-${Date.now()}`
    const parentTeam = parentTeamId ? teams.find(t => t.id === parentTeamId) : null
    
    // Calculate position
    const nodeHeight = 120
    const verticalGap = 80
    let posX = 100 + nodes.length * 50
    let posY = 0
    
    if (parentTeam) {
      // Position near parent
      posX = parentTeam.positionX + 100
      posY = parentTeam.positionY + nodeHeight + verticalGap
    }
    
    const newDraft: DraftTeam = {
      id: newId,
      name: "New Team",
      description: "",
      leadId: null,
      parentTeamId: parentTeamId || null,
      positionX: posX,
      positionY: posY,
    }
    
    // Update draft state
    setDraftNodes(prev => new Map(prev).set(newId, newDraft))
    
    // Add draft node to visual nodes directly
    const newNode = {
      id: newId,
      type: "team" as const,
      position: { x: posX, y: posY },
      data: {
        id: newId,
        name: newDraft.name,
        description: newDraft.description,
        leadId: newDraft.leadId,
        leadName: undefined,
        memberCount: 0,
        childCount: 0,
        parentTeamId: newDraft.parentTeamId,
        isDraft: true,
      } as TeamNodeData,
    }
    setNodes(prevNodes => [...prevNodes, newNode])
    
    // Add edge if parent exists
    if (parentTeamId) {
      setEdges(prevEdges => [...prevEdges, {
        id: `${parentTeamId}-${newId}`,
        source: parentTeamId,
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
    setEditingTeamId(newId)
    setEditingTeam({
      name: newDraft.name,
      description: newDraft.description,
      leadId: newDraft.leadId,
      parentTeamId: newDraft.parentTeamId,
      isDraft: true,
    })
    setIsPanelOpen(true)
    
    // Notify parent about selection change
    onSelect?.({
      id: newId,
      name: newDraft.name,
      description: newDraft.description,
      leadId: newDraft.leadId,
      lead: null,
      parentTeamId: newDraft.parentTeamId,
      parentTeam: parentTeam ? { id: parentTeam.id, name: parentTeam.name } : null,
      memberCount: 0,
      childCount: 0,
      sortOrder: 0,
      positionX: posX,
      positionY: posY,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }, [teams, nodes.length, onSelect, setNodes, setEdges])
  
  // Track position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes as NodeChange<Node<TeamNodeData>>[])
    
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
      const nodeData = selectedNode.data as TeamNodeData
      
      // Don't re-initialize editing state if we're already editing this node
      if (editingTeamId === selectedNode.id) {
        return
      }
      
      // Check if it's a draft node
      if (nodeData.isDraft) {
        const draft = draftNodes.get(selectedNode.id)
        if (draft) {
          setEditingTeamId(draft.id)
          setEditingTeam({
            name: draft.name,
            description: draft.description,
            leadId: draft.leadId,
            parentTeamId: draft.parentTeamId,
            isDraft: true,
          })
          setIsPanelOpen(true)
          // Create a fake team object for selection
          onSelect?.({
            id: draft.id,
            name: draft.name,
            description: draft.description,
            leadId: draft.leadId,
            lead: null,
            parentTeamId: draft.parentTeamId,
            parentTeam: null,
            memberCount: 0,
            childCount: 0,
            sortOrder: 0,
            positionX: draft.positionX,
            positionY: draft.positionY,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      } else {
        const team = teams.find(t => t.id === selectedNode.id)
        onSelect?.(team || null)
        
        // Open properties panel and set editing state
        if (team && canEdit) {
          setEditingTeamId(team.id)
          setEditingTeam({
            name: team.name,
            description: team.description || "",
            leadId: team.leadId,
            parentTeamId: team.parentTeamId,
            isDraft: false,
          })
          setIsPanelOpen(true)
        }
      }
    } else {
      setEditingTeamId(null)
      onSelect?.(null)
    }
  }, [teams, draftNodes, onSelect, canEdit, editingTeamId])
  
  // Handle node double-click to edit (only for existing teams, not drafts)
  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Don't open form drawer for draft nodes - they use the properties panel
    if (node.id.startsWith("draft-")) return
    if (!canEdit || !onEdit) return
    const team = teams.find(t => t.id === node.id)
    if (team) {
      onEdit(team)
    }
  }, [teams, canEdit, onEdit])
  
  // Handle connection (dragging from one node to another)
  const handleConnect: OnConnect = useCallback((connection: Connection) => {
    if (!canEdit) return
    
    // source = parent, target = child (we're connecting from parent's bottom to child's top)
    const { source, target } = connection
    if (!source || !target || source === target) return
    
    // Check if target is a draft node
    if (target.startsWith("draft-")) {
      // Update the draft's parentTeamId
      setDraftNodes(prev => {
        const d = prev.get(target)
        if (!d) return prev
        const newMap = new Map(prev)
        newMap.set(target, { ...d, parentTeamId: source })
        return newMap
      })
      
      // Update node data directly
      setNodes(prevNodes => prevNodes.map(node => {
        if (node.id !== target) return node
        const currentData = node.data as TeamNodeData
        return { ...node, data: { ...currentData, parentTeamId: source } }
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
      if (editingTeamId === target) {
        setEditingTeam(prev => {
          if (!prev) return prev
          return { ...prev, parentTeamId: source }
        })
      }
      
      setHasChanges(true)
      return
    }
    
    // For existing teams, use the onUpdateParent callback
    if (onUpdateParent) {
      onUpdateParent(target, source)
    }
  }, [canEdit, onUpdateParent, editingTeamId, setNodes, setEdges])
  
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
    const positions = autoLayout(teams)
    
    setNodes(prevNodes => prevNodes.map(node => {
      const pos = positions.get(node.id)
      if (pos) {
        return { ...node, position: pos }
      }
      return node
    }))
    
    setHasChanges(true)
  }, [teams, setNodes])
  
  // Save positions, pending updates, and create draft nodes
  const handleSave = useCallback(async () => {
    // Validate draft nodes
    const drafts = Array.from(draftNodes.values())
    const invalidDrafts = drafts.filter(d => !d.name.trim())
    
    if (invalidDrafts.length > 0) {
      // Find the first invalid draft and select it
      const firstInvalid = invalidDrafts[0]
      setEditingTeam({
        name: firstInvalid.name,
        description: firstInvalid.description,
        leadId: firstInvalid.leadId,
        parentTeamId: firstInvalid.parentTeamId,
        isDraft: true,
      })
      setIsPanelOpen(true)
      return // Don't save, let validation errors show
    }
    
    // Apply pending updates to existing teams via API
    if (pendingUpdates.size > 0 && onInlineUpdate) {
      for (const [teamId, updates] of pendingUpdates) {
        await onInlineUpdate(teamId, updates)
      }
      setPendingUpdates(new Map())
    }
    
    // Save existing team positions
    const positionUpdates = nodes
      .filter(node => !node.id.startsWith("draft-"))
      .map(node => ({
        id: node.id,
        positionX: Math.round(node.position.x),
        positionY: Math.round(node.position.y),
      }))
    
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
      setEditingTeamId(null)
      setEditingTeam(null)
    }
    
    setHasChanges(false)
  }, [nodes, draftNodes, pendingUpdates, onSave, onInlineUpdate, onCreate, setNodes, setEdges])
  
  // Handle inline update from properties panel - applies immediately as preview
  const handleInlineUpdate = useCallback((field: keyof NonNullable<typeof editingTeam>, value: string | null) => {
    if (!editingTeamId) return
    
    // Update editing team state
    setEditingTeam(prev => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
    
    const isDraft = editingTeamId.startsWith("draft-")
    
    // If editing a draft, update draft state
    if (isDraft) {
      setDraftNodes(prev => {
        const draft = prev.get(editingTeamId)
        if (!draft) return prev
        const newMap = new Map(prev)
        newMap.set(editingTeamId, { ...draft, [field]: value })
        return newMap
      })
    } else {
      // For existing teams, track pending updates for bulk save
      setPendingUpdates(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(editingTeamId) || {}
        newMap.set(editingTeamId, { ...existing, [field]: value })
        return newMap
      })
    }
    
    // Update node visual directly for immediate feedback (both drafts and existing)
    setNodes(prevNodes => prevNodes.map(node => {
      if (node.id !== editingTeamId) return node
      
      const currentData = node.data as TeamNodeData
      let updatedData = { ...currentData }
      
      if (field === "name") {
        updatedData = { ...updatedData, name: (value as string) || (isDraft ? "New Team" : currentData.name) }
      } else if (field === "description") {
        updatedData = { ...updatedData, description: value as string ?? undefined }
      } else if (field === "leadId") {
        const lead = people.find(p => p.id === value)
        updatedData = { 
          ...updatedData, 
          leadId: value,
          leadName: lead?.name 
        }
      } else if (field === "parentTeamId") {
        updatedData = { ...updatedData, parentTeamId: value as string | null }
      }
      
      return { ...node, data: updatedData }
    }))
    
    // If changing parentTeamId, update edges too
    if (field === "parentTeamId") {
      setEdges(prevEdges => {
        // Remove old edges targeting this node
        const filteredEdges = prevEdges.filter(e => e.target !== editingTeamId)
        
        // Add new edge if parent is set
        if (value) {
          return [...filteredEdges, {
            id: `${value}-${editingTeamId}`,
            source: value as string,
            target: editingTeamId,
            type: "smoothstep" as const,
            animated: isDraft,
            style: { strokeWidth: 2, ...(isDraft && { strokeDasharray: "5 5" }) },
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
  }, [editingTeamId, people, setNodes, setEdges])
  
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
    setEditingTeamId(null)
    setEditingTeam(null)
    onSelect?.(null)
    if (draftNodes.size <= 1 && pendingUpdates.size === 0) {
      setHasChanges(false)
    }
  }, [draftNodes.size, pendingUpdates.size, onSelect, setNodes, setEdges])
  
  // Close panel
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])
  
  // Get selected team
  const selectedTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || null
  }, [teams, selectedTeamId])
  
  // Get context menu team
  const contextMenuTeam = useMemo(() => {
    return contextMenuNodeId ? teams.find(t => t.id === contextMenuNodeId) || null : null
  }, [teams, contextMenuNodeId])
  
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-muted/30 rounded-lg", className)}>
        <div className="text-muted-foreground">Loading team chart...</div>
      </div>
    )
  }
  
  if (teams.length === 0 && draftNodes.size === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg", className)}>
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No teams to display</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">
          Add teams to visualize your organizational structure.
        </p>
        {canCreate && (onCreate || onAdd) && (
          <Button onClick={() => onCreate ? addDraftTeam(null) : onAdd?.(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Team
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
            const data = node.data as TeamNodeData | undefined
            if (data?.parentTeamId === null) {
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
                  onClick={() => onCreate ? addDraftTeam(null) : onAdd?.(null)}
                  className="h-8 px-2"
                  title="Add Top-Level Team"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <Users className="h-4 w-4" />
                </Button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreate ? addDraftTeam(selectedTeamId) : onAdd?.(selectedTeamId)}
                  className="h-8 px-2"
                  title="Add Sub-Team"
                  disabled={!selectedTeamId || selectedTeamId.startsWith("draft-")}
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
        
        {/* Tips panel */}
        {canEdit && !isPanelOpen && (
          <Panel position="top-right" className="max-w-xs">
            <div className="bg-card/90 backdrop-blur border rounded-lg px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <strong className="text-foreground">Tips:</strong> Click to select • Double-click to edit • Right-click for menu • Drag from ● handles to link
            </div>
          </Panel>
        )}
      </ReactFlow>
      
      {/* Properties Panel - Right side slide-in */}
      {isPanelOpen && editingTeam && editingTeamId && (selectedTeam || editingTeam.isDraft) && (
        <div 
          key={editingTeamId} 
          className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border shadow-lg overflow-y-auto z-10"
        >
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">
                {editingTeam.isDraft ? "New Team" : "Team Properties"}
              </h3>
              {editingTeam.isDraft && (
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
              <Label htmlFor="team-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                value={editingTeam.name}
                onChange={(e) => handleInlineUpdate("name", e.target.value)}
                disabled={!canEdit}
                className={cn(!editingTeam.name.trim() && editingTeam.isDraft && "border-destructive")}
                placeholder="Enter team name..."
              />
              {!editingTeam.name.trim() && editingTeam.isDraft && (
                <p className="text-xs text-destructive">Name is required</p>
              )}
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={editingTeam.description}
                onChange={(e) => handleInlineUpdate("description", e.target.value)}
                rows={3}
                disabled={!canEdit}
                placeholder="Describe the team's purpose..."
              />
            </div>
            
            {/* Lead */}
            <div className="space-y-2">
              <Label>Team Lead</Label>
              {people.length > 0 ? (
                <Select
                  key={`lead-${editingTeamId}`}
                  value={editingTeam.leadId ?? "__none__"}
                  onValueChange={(value) => handleInlineUpdate("leadId", value === "__none__" ? null : value)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select team lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">No lead assigned</span>
                    </SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedTeam?.lead?.name ?? "No lead available"}</span>
                </div>
              )}
            </div>
            
            {/* Parent Team */}
            <div className="space-y-2">
              <Label>Parent Team</Label>
              <Select
                key={`parent-${editingTeamId}`}
                value={editingTeam.parentTeamId ?? "__none__"}
                onValueChange={(value) => handleInlineUpdate("parentTeamId", value === "__none__" ? null : value)}
                disabled={!canEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select parent team..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">None (Top-level)</span>
                  </SelectItem>
                  {teams
                    .filter(t => !editingTeamId || t.id !== editingTeamId) // Exclude self
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Info badges - only for existing teams */}
            {!editingTeam.isDraft && selectedTeam && (
              <div className="flex gap-4 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Members</div>
                  <Badge variant="secondary" className="font-mono mt-1">{selectedTeam.memberCount}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sub-Teams</div>
                  <Badge variant="outline" className="font-mono mt-1">{selectedTeam.childCount}</Badge>
                </div>
              </div>
            )}
            
            {/* Draft info */}
            {editingTeam.isDraft && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This team is not saved yet. Click the <strong>Save</strong> button in the toolbar to create it.
                </p>
              </div>
            )}
            
            {/* Pending changes indicator for existing teams */}
            {!editingTeam.isDraft && pendingUpdates.has(editingTeamId!) && (
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
                  <Save className="h-4 w-4" />
                  Changes pending - click Save on toolbar to apply
                </div>
              </div>
            )}
            
            {/* Open full edit drawer - existing teams only */}
            {!editingTeam.isDraft && onEdit && canEdit && selectedTeam && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => onEdit(selectedTeam)}
                  className="w-full"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Open Full Editor
                </Button>
              </div>
            )}
            
            {/* Add Sub-Team - existing teams only */}
            {!editingTeam.isDraft && canCreate && (onCreate || onAdd) && editingTeamId && (
              <Button
                variant="outline"
                onClick={() => onCreate ? addDraftTeam(editingTeamId) : onAdd?.(editingTeamId)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Sub-Team
              </Button>
            )}
            
            {/* Delete Button */}
            <div className="pt-4 border-t">
              {editingTeam.isDraft && editingTeamId ? (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteDraft(editingTeamId)}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Draft
                </Button>
              ) : onDelete && canDelete && selectedTeam && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(selectedTeam)}
                    className="w-full"
                    disabled={selectedTeam.childCount > 0 || selectedTeam.memberCount > 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Team
                  </Button>
                  {(selectedTeam.childCount > 0 || selectedTeam.memberCount > 0) && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Cannot delete teams with members or sub-teams
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
          {contextMenuTeam ? (
            // Node context menu
            <>
              {onEdit && canEdit && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    onEdit(contextMenuTeam)
                    closeContextMenu()
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Team
                </button>
              )}
              {canCreate && (onCreate || onAdd) && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    if (onCreate) {
                      addDraftTeam(contextMenuTeam.id)
                    } else {
                      onAdd?.(contextMenuTeam.id)
                    }
                    closeContextMenu()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Sub-Team
                </button>
              )}
              {onUpdateParent && canEdit && contextMenuTeam.parentTeamId && (
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  onClick={() => {
                    onUpdateParent(contextMenuTeam.id, null)
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
                      onDelete(contextMenuTeam)
                      closeContextMenu()
                    }}
                    disabled={contextMenuTeam.childCount > 0 || contextMenuTeam.memberCount > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Team
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
                      addDraftTeam(null)
                    } else {
                      onAdd?.(null)
                    }
                    closeContextMenu()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add New Team
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
