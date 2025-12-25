"use client"

import { useCallback, useState, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  Panel,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { 
  Plus, 
  Save, 
  Trash2, 
  CheckSquare,
  Bell,
  GitBranch,
  Layers,
  X
} from "lucide-react"
import { workflowNodeTypes, type StepNodeData, defaultStepNodeData } from "./step-node"
import type { 
  WorkflowTemplateStep, 
  WorkflowTemplateEdge,
  SaveTemplateStep,
  SaveTemplateEdge,
} from "@/lib/api/workflows"

interface WorkflowDesignerProps {
  templateId?: string
  initialSteps?: WorkflowTemplateStep[]
  initialEdges?: WorkflowTemplateEdge[]
  onSave?: (steps: SaveTemplateStep[], edges: SaveTemplateEdge[]) => void
  isLoading?: boolean
  readOnly?: boolean
  className?: string
}

type WorkflowNode = Node<StepNodeData>

// Convert API step to React Flow node
function stepToNode(step: WorkflowTemplateStep): WorkflowNode {
  return {
    id: step.id,
    type: "step",
    position: { x: step.positionX, y: step.positionY },
    data: {
      id: step.id,
      name: step.name,
      description: step.description,
      stepType: step.stepType,
      assigneeType: step.assigneeType,
      assigneeConfig: step.assigneeConfig,
      dueOffsetDays: step.dueOffsetDays,
      isRequired: step.isRequired,
      metadata: step.metadata,
    },
  }
}

// Convert API edge to React Flow edge
function apiEdgeToFlowEdge(edge: WorkflowTemplateEdge): Edge {
  return {
    id: edge.id,
    source: edge.sourceStepId,
    target: edge.targetStepId,
    type: "smoothstep",
    animated: edge.conditionType !== "always",
    label: edge.label,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
    },
    data: {
      conditionType: edge.conditionType,
      conditionConfig: edge.conditionConfig,
    },
  }
}

// Convert React Flow node to API step
function nodeToStep(node: WorkflowNode): SaveTemplateStep {
  return {
    id: node.id,
    name: node.data.name,
    description: node.data.description,
    stepType: node.data.stepType,
    orderIndex: 0, // Will be calculated on save
    positionX: node.position.x,
    positionY: node.position.y,
    assigneeType: node.data.assigneeType,
    assigneeConfig: node.data.assigneeConfig,
    dueOffsetDays: node.data.dueOffsetDays,
    isRequired: node.data.isRequired,
    metadata: node.data.metadata,
  }
}

// Convert React Flow edge to API edge
function flowEdgeToApiEdge(edge: Edge): SaveTemplateEdge {
  return {
    id: edge.id,
    sourceStepId: edge.source,
    targetStepId: edge.target,
    conditionType: (edge.data?.conditionType as SaveTemplateEdge["conditionType"]) ?? "always",
    conditionConfig: edge.data?.conditionConfig as Record<string, unknown> | undefined,
    label: edge.label as string | undefined,
  }
}

const stepTypeOptions = [
  { value: "task", label: "Task", icon: CheckSquare },
  { value: "notification", label: "Notification", icon: Bell },
  { value: "gateway", label: "Gateway", icon: GitBranch },
  { value: "group", label: "Group", icon: Layers },
] as const

const assigneeTypeOptions = [
  { value: "unassigned", label: "Unassigned" },
  { value: "specific_user", label: "Specific User" },
  { value: "role", label: "Role" },
  { value: "dynamic_manager", label: "Entity Manager" },
  { value: "dynamic_creator", label: "Workflow Creator" },
] as const

export function WorkflowDesigner({
  templateId: _templateId,
  initialSteps = [],
  initialEdges = [],
  onSave,
  isLoading = false,
  readOnly = false,
  className,
}: WorkflowDesignerProps) {
  // Convert initial data
  const initialNodes = useMemo(
    () => initialSteps.map(stepToNode),
    [initialSteps]
  )
  const initialFlowEdges = useMemo(
    () => initialEdges.map(apiEdgeToFlowEdge),
    [initialEdges]
  )

  // React Flow state - use generic Node type for compatibility
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges)
  
  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as WorkflowNode | undefined
  
  // Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Handle connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
          },
          eds
        )
      )
    },
    [setEdges, readOnly]
  )

  // Handle node selection
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      setIsPanelOpen(true)
    },
    []
  )

  // Handle pane click (deselect)
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  // Add new step
  const addStep = useCallback(
    (type: StepNodeData["stepType"] = "task") => {
      if (readOnly) return

      const newId = `step-${Date.now()}`
      const newNode: WorkflowNode = {
        id: newId,
        type: "step",
        position: {
          x: 100 + nodes.length * 50,
          y: 100 + nodes.length * 50,
        },
        data: {
          ...defaultStepNodeData,
          id: newId,
          name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          stepType: type,
        } as StepNodeData,
      }

      setNodes((nds) => [...nds, newNode])
      setSelectedNodeId(newId)
      setIsPanelOpen(true)
    },
    [nodes.length, setNodes, readOnly]
  )

  // Delete selected node
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId || readOnly) return

    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    )
    setSelectedNodeId(null)
    setIsPanelOpen(false)
  }, [selectedNodeId, setNodes, setEdges, readOnly])

  // Update selected node data
  const updateNodeData = useCallback(
    (updates: Partial<StepNodeData>) => {
      if (!selectedNodeId || readOnly) return

      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      )
    },
    [selectedNodeId, setNodes, readOnly]
  )

  // Handle save
  const handleSave = useCallback(() => {
    if (!onSave) return

    const steps = (nodes as WorkflowNode[]).map((node, index) => ({
      ...nodeToStep(node),
      orderIndex: index,
    }))
    const apiEdges = edges.map(flowEdgeToApiEdge)

    onSave(steps, apiEdges)
  }, [nodes, edges, onSave])

  // Handle node changes with read-only check
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) {
        // Only allow selection changes in read-only mode
        const allowedChanges = changes.filter((c) => c.type === "select")
        if (allowedChanges.length > 0) {
          onNodesChange(allowedChanges as NodeChange<WorkflowNode>[])
        }
        return
      }
      onNodesChange(changes as NodeChange<WorkflowNode>[])
    },
    [onNodesChange, readOnly]
  )

  // Handle edge changes with read-only check
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) {
        const allowedChanges = changes.filter((c) => c.type === "select")
        if (allowedChanges.length > 0) {
          onEdgesChange(allowedChanges)
        }
        return
      }
      onEdgesChange(changes)
    },
    [onEdgesChange, readOnly]
  )

  return (
    <div className={cn("relative h-full w-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={workflowNodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
        className="bg-slate-50 dark:bg-slate-900"
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap
          className="!bg-white dark:!bg-slate-800"
          nodeColor={(node) => {
            const data = node.data as StepNodeData | undefined
            switch (data?.stepType) {
              case "task":
                return "#3b82f6"
              case "notification":
                return "#f59e0b"
              case "gateway":
                return "#8b5cf6"
              case "group":
                return "#64748b"
              default:
                return "#94a3b8"
            }
          }}
        />

        {/* Toolbar Panel */}
        {!readOnly && (
          <Panel position="top-left" className="flex gap-2">
            <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border p-1">
              {stepTypeOptions.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant="ghost"
                  size="sm"
                  onClick={() => addStep(value)}
                  className="h-8 px-2"
                  title={`Add ${label}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
            
            {onSave && (
              <Button
                onClick={handleSave}
                disabled={isLoading}
                size="sm"
                className="h-8"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </Panel>
        )}
      </ReactFlow>

      {/* Properties Panel */}
      {isPanelOpen && selectedNode && (
        <div className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-slate-800 border-l shadow-lg overflow-y-auto">
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-slate-800">
            <h3 className="font-semibold text-sm">Step Properties</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPanelOpen(false)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="step-name">Name</Label>
              <Input
                id="step-name"
                value={selectedNode.data.name}
                onChange={(e) => updateNodeData({ name: e.target.value })}
                disabled={readOnly}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="step-description">Description</Label>
              <Textarea
                id="step-description"
                value={selectedNode.data.description ?? ""}
                onChange={(e) => updateNodeData({ description: e.target.value })}
                rows={3}
                disabled={readOnly}
              />
            </div>

            {/* Step Type */}
            <div className="space-y-2">
              <Label>Step Type</Label>
              <Select
                value={selectedNode.data.stepType}
                onValueChange={(value) =>
                  updateNodeData({ stepType: value as StepNodeData["stepType"] })
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stepTypeOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Type */}
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={selectedNode.data.assigneeType}
                onValueChange={(value) =>
                  updateNodeData({ assigneeType: value as StepNodeData["assigneeType"] })
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assigneeTypeOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Offset */}
            <div className="space-y-2">
              <Label htmlFor="due-offset">Due After (days)</Label>
              <Input
                id="due-offset"
                type="number"
                min={0}
                value={selectedNode.data.dueOffsetDays ?? ""}
                onChange={(e) =>
                  updateNodeData({
                    dueOffsetDays: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                placeholder="No deadline"
                disabled={readOnly}
              />
            </div>

            {/* Required */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is-required">Required Step</Label>
              <Switch
                id="is-required"
                checked={selectedNode.data.isRequired}
                onCheckedChange={(checked) => updateNodeData({ isRequired: checked })}
                disabled={readOnly}
              />
            </div>

            {/* Delete Button */}
            {!readOnly && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={deleteSelectedNode}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Step
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
