"use client"

import { use, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  LayoutGrid,
  ListChecks,
  User,
  Calendar,
  AlertCircle,
  GitBranch,
  UserPlus,
  Maximize2,
  Minimize2,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow, format } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useBreadcrumbLabel } from "@/components/breadcrumb-context"
import { 
  WorkflowKanban, 
  WorkflowTaskList, 
  InstanceStatusBadge,
  TaskDetailSheet,
  type InstanceStatus,
} from "@/components/workflows"
import { 
  useWorkflowInstanceDetail,
  useUpdateWorkflowInstance,
  useCancelWorkflowInstance,
  useUpdateWorkflowStep,
  type WorkflowInstanceStep,
} from "@/lib/api/workflows"
import { usePeopleList } from "@/lib/api/people"
import { Badge } from "@/components/ui/badge"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowInstanceDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const canAccess = useCanAccess("workflows.instances")
  
  const [view, setView] = useState<"kanban" | "list" | "graph">("kanban")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedStep, setSelectedStep] = useState<WorkflowInstanceStep | null>(null)
  
  // Queries
  const { data: instance, isLoading, error } = useWorkflowInstanceDetail(id)
  const { data: people = [] } = usePeopleList()
  
  // Set breadcrumb to show instance name (e.g. "Onboarding - Bob Wilson")
  useBreadcrumbLabel(instance?.name)
  const updateInstanceMutation = useUpdateWorkflowInstance()
  const cancelMutation = useCancelWorkflowInstance()
  const updateStepMutation = useUpdateWorkflowStep()
  
  // Handlers
  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(id)
      toast.success("Workflow cancelled")
      setShowCancelDialog(false)
    } catch {
      toast.error("Failed to cancel workflow")
    }
  }
  
  const handlePause = async () => {
    if (!instance) return
    try {
      await updateInstanceMutation.mutateAsync({
        id: instance.id,
        data: { status: "on_hold" },
      })
      toast.success("Workflow paused")
    } catch {
      toast.error("Failed to pause workflow")
    }
  }
  
  const handleResume = async () => {
    if (!instance) return
    try {
      await updateInstanceMutation.mutateAsync({
        id: instance.id,
        data: { status: "in_progress" },
      })
      toast.success("Workflow resumed")
    } catch {
      toast.error("Failed to resume workflow")
    }
  }
  
  const handleCompleteStep = async (stepId: string) => {
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        data: { status: "completed" },
      })
      toast.success("Step completed")
    } catch {
      toast.error("Failed to complete step")
    }
  }
  
  const handleStartStep = async (stepId: string) => {
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        data: { status: "in_progress" },
      })
      toast.success("Step started")
    } catch {
      toast.error("Failed to start step")
    }
  }
  
  const handleStatusChange = async (stepId: string, newStatus: WorkflowInstanceStep["status"]) => {
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        data: { status: newStatus },
      })
      toast.success(`Step moved to ${newStatus.replace(/_/g, " ")}`)
    } catch {
      toast.error("Failed to update step status")
    }
  }
  
  const handleStepClick = (step: WorkflowInstanceStep) => {
    setSelectedStep(step)
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Workflow">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view this workflow." 
        />
      </PageShell>
    )
  }
  
  if (isLoading) {
    return (
      <PageShell title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </PageShell>
    )
  }
  
  if (error || !instance) {
    return (
      <PageShell title="Workflow Not Found">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold mb-2">Workflow not found</h2>
          <p className="text-muted-foreground mb-4">
            The workflow you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild>
            <Link href="/workflows/instances">Back to Workflows</Link>
          </Button>
        </div>
      </PageShell>
    )
  }
  
  const isActive = instance.status === "in_progress" || instance.status === "pending"
  const isReadOnly = instance.status === "cancelled" || instance.status === "completed"
  const isOverdue = isActive && instance.dueAt && new Date(instance.dueAt) < new Date()
  
  return (
    <PageShell
      title={instance.name}
      description={instance.template?.name}
      compact
      backButton={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/workflows/instances">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Instances</TooltipContent>
        </Tooltip>
      }
      statusBadge={<InstanceStatusBadge status={instance.status as InstanceStatus} />}
      action={
        <div className="flex items-center gap-2">
          {instance.status === "in_progress" && (
            <Button variant="outline" onClick={handlePause}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {instance.status === "on_hold" && (
            <Button onClick={handleResume}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}
          {isActive && (
            <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Status and Progress */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {instance.completedSteps} of {instance.totalSteps} steps completed
                </span>
                <span className="font-medium">{instance.progress}%</span>
              </div>
              <Progress value={instance.progress} className="h-3" />
              
              {isOverdue && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>This workflow is overdue</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {instance.entity && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{instance.entity.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Owner:</span>
                {instance.owner ? (
                  <span>{instance.owner.name}</span>
                ) : (
                  <span className="text-muted-foreground italic">Not assigned</span>
                )}
                {!isReadOnly && (
                  <OwnerEditButton 
                    currentOwnerId={instance.ownerId ?? null}
                    people={people}
                    instanceId={instance.id}
                    onUpdate={updateInstanceMutation}
                  />
                )}
              </div>
              {instance.startedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Started {formatDistanceToNow(new Date(instance.startedAt), { addSuffix: true })}</span>
                </div>
              )}
              {instance.dueAt && (
                <div className={`flex items-center gap-2 ${isOverdue ? "text-red-600" : ""}`}>
                  {isOverdue ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>
                    Due {format(new Date(instance.dueAt), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {instance.completedAt && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Completed {formatDistanceToNow(new Date(instance.completedAt), { addSuffix: true })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Steps View */}
        {isFullscreen ? (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* Slim Fullscreen Header */}
            <div className="border-b bg-card px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm truncate">{instance.name}</h2>
                  <p className="text-xs text-muted-foreground truncate">{instance.template?.name}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex items-center gap-3 text-sm">
                  <InstanceStatusBadge status={instance.status as InstanceStatus} />
                  <div className="flex items-center gap-2">
                    <Progress value={instance.progress} className="h-2 w-24" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {instance.completedSteps}/{instance.totalSteps}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  <Button
                    variant={view === "kanban" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setView("kanban")}
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Board
                  </Button>
                  <Button
                    variant={view === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setView("list")}
                  >
                    <ListChecks className="h-4 w-4 mr-1" />
                    List
                  </Button>
                  <Button
                    variant={view === "graph" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setView("graph")}
                  >
                    <GitBranch className="h-4 w-4 mr-1" />
                    Graph
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setIsFullscreen(false)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Fullscreen Content */}
            <div className="flex-1 overflow-auto p-4">
              {view === "kanban" ? (
                <WorkflowKanban
                  instance={instance}
                  onStepClick={isReadOnly ? undefined : handleStepClick}
                  onCompleteStep={isReadOnly ? undefined : handleCompleteStep}
                  onStartStep={isReadOnly ? undefined : handleStartStep}
                  onStatusChange={isReadOnly ? undefined : handleStatusChange}
                  readOnly={isReadOnly}
                />
              ) : view === "list" ? (
                <WorkflowTaskList
                  steps={instance.steps}
                  onStepClick={isReadOnly ? undefined : handleStepClick}
                  onStepComplete={isReadOnly ? undefined : (stepId, completed) => {
                    if (completed) {
                      handleCompleteStep(stepId)
                    }
                  }}
                  readOnly={isReadOnly}
                />
              ) : (
                <InstanceGraphView instance={instance} fullscreen onStepClick={isReadOnly ? undefined : handleStepClick} />
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Steps</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 border rounded-lg p-1">
                    <Button
                      variant={view === "kanban" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setView("kanban")}
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Board
                    </Button>
                    <Button
                      variant={view === "list" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setView("list")}
                    >
                      <ListChecks className="h-4 w-4 mr-1" />
                      List
                    </Button>
                    <Button
                      variant={view === "graph" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setView("graph")}
                    >
                      <GitBranch className="h-4 w-4 mr-1" />
                      Graph
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {view === "kanban" ? (
                <WorkflowKanban
                  instance={instance}
                  onStepClick={isReadOnly ? undefined : handleStepClick}
                  onCompleteStep={isReadOnly ? undefined : handleCompleteStep}
                  onStartStep={isReadOnly ? undefined : handleStartStep}
                  onStatusChange={isReadOnly ? undefined : handleStatusChange}
                  readOnly={isReadOnly}
                />
              ) : view === "list" ? (
                <WorkflowTaskList
                  steps={instance.steps}
                  onStepClick={isReadOnly ? undefined : handleStepClick}
                  onStepComplete={isReadOnly ? undefined : (stepId, completed) => {
                    if (completed) {
                      handleCompleteStep(stepId)
                    }
                  }}
                  readOnly={isReadOnly}
                />
              ) : (
                <InstanceGraphView instance={instance} onStepClick={isReadOnly ? undefined : handleStepClick} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this workflow? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Workflow
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Task Detail Sheet */}
      <TaskDetailSheet
        step={selectedStep}
        open={!!selectedStep}
        onOpenChange={(open) => !open && setSelectedStep(null)}
        instanceStatus={instance.status}
        people={people}
        readOnly={isReadOnly}
      />
    </PageShell>
  )
}

/**
 * Owner Edit Button - inline edit for workflow owner
 */
interface OwnerEditButtonProps {
  currentOwnerId: string | null
  people: { id: string; name: string }[]
  instanceId: string
  onUpdate: ReturnType<typeof useUpdateWorkflowInstance>
}

function OwnerEditButton({ currentOwnerId, people, instanceId, onUpdate }: OwnerEditButtonProps) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(currentOwnerId)
  
  const handleSave = async () => {
    try {
      await onUpdate.mutateAsync({
        id: instanceId,
        data: { ownerId: selectedId },
      })
      toast.success("Owner updated")
      setOpen(false)
    } catch {
      toast.error("Failed to update owner")
    }
  }
  
  return (
    <>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-5 w-5 p-0 ml-1"
        onClick={() => {
          setSelectedId(currentOwnerId)
          setOpen(true)
        }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Owner</DialogTitle>
            <DialogDescription>
              Select a new owner for this workflow instance.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="instance-owner">Owner</Label>
            <Select
              value={selectedId ?? "__none__"}
              onValueChange={(v) => setSelectedId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="instance-owner" className="w-full mt-2">
                <SelectValue placeholder="Select owner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No owner</SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={onUpdate.isPending}
            >
              {onUpdate.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Read-only graph view of workflow instance steps
 */
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { WorkflowInstanceDetail } from "@/lib/api/workflows"

interface InstanceGraphViewProps {
  instance: WorkflowInstanceDetail
  fullscreen?: boolean
  onStepClick?: (step: WorkflowInstanceStep) => void
}

// Step status to color mapping
const statusColors: Record<WorkflowInstanceStep["status"], { bg: string; border: string; text: string }> = {
  pending: {
    bg: "bg-muted",
    border: "border-muted-foreground/30",
    text: "text-muted-foreground",
  },
  in_progress: {
    bg: "bg-blue-50 dark:bg-blue-950/50",
    border: "border-blue-500",
    text: "text-blue-700 dark:text-blue-400",
  },
  completed: {
    bg: "bg-green-50 dark:bg-green-950/50",
    border: "border-green-500",
    text: "text-green-700 dark:text-green-400",
  },
  skipped: {
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  blocked: {
    bg: "bg-red-50 dark:bg-red-950/50",
    border: "border-red-500",
    text: "text-red-700 dark:text-red-400",
  },
}

// Custom node component for instance steps
function InstanceStepNode({ data }: { data: { step: WorkflowInstanceStep; onClick?: boolean } }) {
  const { step, onClick } = data
  const colors = statusColors[step.status]
  const assigneeName = step.assignedPerson?.name || step.assignee?.name
  
  return (
    <div
      className={`relative rounded-lg border-2 px-4 py-3 shadow-sm min-w-[200px] max-w-[280px] ${colors.bg} ${colors.border} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      {/* Input Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-border !border-0"
      />
      
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-sm font-medium truncate ${colors.text}`}>
          {step.name}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${colors.bg} ${colors.text} border ${colors.border}`}>
          {step.status.replace(/_/g, " ")}
        </span>
      </div>
      {assigneeName && (
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <User className="h-3 w-3" />
          {assigneeName}
        </div>
      )}
      
      {/* Output Handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-border !border-0"
      />
    </div>
  )
}

const instanceNodeTypes = {
  instanceStep: InstanceStepNode,
}

function InstanceGraphView({ instance, fullscreen = false, onStepClick }: InstanceGraphViewProps) {
  // Sort steps by orderIndex
  const sortedSteps = useMemo(() => 
    [...instance.steps].sort((a, b) => a.orderIndex - b.orderIndex),
    [instance.steps]
  )
  
  // Handle node click to open step details
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const step = instance.steps.find(s => s.id === node.id)
    if (step && onStepClick) {
      onStepClick(step)
    }
  }, [instance.steps, onStepClick])
  
  // Convert instance steps to React Flow nodes
  // Use a vertical centered layout
  const nodes: Node[] = useMemo(() => {
    const nodeHeight = 70
    const verticalSpacing = 80
    const centerX = 250 // Center X position
    
    return sortedSteps.map((step, index) => {
      return {
        id: step.id,
        type: "instanceStep",
        position: { 
          x: centerX, 
          y: index * (nodeHeight + verticalSpacing) 
        },
        data: { step, onClick: !!onStepClick },
        draggable: false,
        selectable: !!onStepClick,
      }
    })
  }, [sortedSteps])
  
  // Create edges - always use sequential flow based on orderIndex for cleaner display
  const edges: Edge[] = useMemo(() => {
    // Create sequential edges based on order (top to bottom flow)
    return sortedSteps.slice(0, -1).map((step, index) => {
      const nextStep = sortedSteps[index + 1]
      const isNextCompleted = nextStep.status === "completed"
      const isNextInProgress = nextStep.status === "in_progress"
      
      return {
        id: `edge-${step.id}-${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        type: "smoothstep",
        animated: isNextInProgress,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: isNextCompleted 
            ? "hsl(142.1 76.2% 36.3%)" 
            : isNextInProgress 
            ? "hsl(217.2 91.2% 59.8%)" 
            : "hsl(var(--muted-foreground))",
        },
        style: {
          stroke: isNextCompleted 
            ? "hsl(142.1 76.2% 36.3%)" // green-600
            : isNextInProgress 
            ? "hsl(217.2 91.2% 59.8%)" // blue-500
            : "hsl(var(--muted-foreground))",
          strokeWidth: 2,
        },
      }
    })
  }, [sortedSteps])
  
  return (
    <div className={`w-full rounded-lg border bg-background ${fullscreen ? "h-full" : "h-[400px]"}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={instanceNodeTypes}
        onNodeClick={onStepClick ? handleNodeClick : undefined}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!!onStepClick}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        minZoom={0.5}
        maxZoom={1.5}
        className="workflow-designer"
      >
        <Background 
          gap={20} 
          size={1.5}
          className="[&>pattern>circle]:fill-muted-foreground/30"
        />
        <Controls 
          showInteractive={false}
          className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent"
        />
      </ReactFlow>
    </div>
  )
}
