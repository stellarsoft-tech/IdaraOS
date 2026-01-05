"use client"

import { use, useState, useMemo } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  CheckCircle,
  Download,
  ExternalLink,
  FileText,
  FolderArchive,
  Loader2,
  MoreHorizontal,
  Paperclip,
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
  Trash2,
  Upload,
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
import { Textarea } from "@/components/ui/textarea"
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
import { FileUpload, CompactFileUpload } from "@/components/primitives/file-upload"
import {
  useEntityFiles,
  useDeleteFile,
  downloadFile,
  type FileRecord,
} from "@/lib/api/files"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const [showStepDialog, setShowStepDialog] = useState<WorkflowInstanceStep | null>(null)
  const [stepNotes, setStepNotes] = useState("")
  const [stepAssigneeId, setStepAssigneeId] = useState<string | null>(null)
  
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
    setShowStepDialog(step)
    setStepNotes(step.notes || "")
    setStepAssigneeId(step.assignedPersonId || null)
  }
  
  const handleSaveStepAssignee = async () => {
    if (!showStepDialog) return
    try {
      await updateStepMutation.mutateAsync({
        id: showStepDialog.id,
        data: { 
          notes: stepNotes,
          assignedPersonId: stepAssigneeId || null,
        },
      })
      toast.success("Step updated")
      setShowStepDialog(null)
    } catch {
      toast.error("Failed to update step")
    }
  }
  
  const _handleSaveStepNotes = async () => {
    if (!showStepDialog) return
    try {
      await updateStepMutation.mutateAsync({
        id: showStepDialog.id,
        data: { notes: stepNotes },
      })
      toast.success("Notes saved")
      setShowStepDialog(null)
    } catch {
      toast.error("Failed to save notes")
    }
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
                <InstanceGraphView instance={instance} fullscreen />
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
                <InstanceGraphView instance={instance} />
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
      
      {/* Step Details Dialog */}
      <Dialog open={!!showStepDialog} onOpenChange={() => setShowStepDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showStepDialog?.name}</DialogTitle>
            {showStepDialog?.description && (
              <DialogDescription>{showStepDialog.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium capitalize">
                  {showStepDialog?.status.replace(/_/g, " ")}
                </p>
              </div>
              {showStepDialog?.dueAt && (
                <div>
                  <span className="text-muted-foreground">Due</span>
                  <p className="font-medium">
                    {format(new Date(showStepDialog.dueAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}
              {showStepDialog?.completedAt && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Completed</span>
                  <p className="font-medium">
                    {format(new Date(showStepDialog.completedAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Assignee Selection */}
            <div className="space-y-2">
              <Label htmlFor="assignee" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Assignee
              </Label>
              <Select
                value={stepAssigneeId || "__none__"}
                onValueChange={(value) => setStepAssigneeId(value === "__none__" ? null : value)}
                disabled={showStepDialog?.status === "completed" || instance.status === "completed"}
              >
                <SelectTrigger id="assignee" className="w-full">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Unassigned</span>
                  </SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {person.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={stepNotes}
                onChange={(e) => setStepNotes(e.target.value)}
                placeholder="Add notes about this step..."
                rows={3}
                disabled={showStepDialog?.status === "completed" || instance.status === "completed"}
              />
            </div>
            
            <Separator />
            
            {/* Attachments */}
            {showStepDialog && (
              <StepAttachments
                stepId={showStepDialog.id}
                stepName={showStepDialog.name}
                instanceId={instance.id}
                readOnly={showStepDialog.status === "completed" || instance.status === "completed"}
              />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowStepDialog(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveStepAssignee}
              disabled={updateStepMutation.isPending || instance.status === "completed"}
            >
              {updateStepMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
function InstanceStepNode({ data }: { data: { step: WorkflowInstanceStep } }) {
  const { step } = data
  const colors = statusColors[step.status]
  const assigneeName = step.assignedPerson?.name || step.assignee?.name
  
  return (
    <div
      className={`relative rounded-lg border-2 px-4 py-3 shadow-sm min-w-[200px] max-w-[280px] ${colors.bg} ${colors.border}`}
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

function InstanceGraphView({ instance, fullscreen = false }: InstanceGraphViewProps) {
  // Sort steps by orderIndex
  const sortedSteps = useMemo(() => 
    [...instance.steps].sort((a, b) => a.orderIndex - b.orderIndex),
    [instance.steps]
  )
  
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
        data: { step },
        draggable: false,
        selectable: false,
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
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
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

// ============================================================================
// Step Attachments Component
// ============================================================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface StepAttachmentsProps {
  stepId: string
  stepName: string
  instanceId: string
  readOnly?: boolean
}

function StepAttachments({ stepId, stepName, instanceId, readOnly }: StepAttachmentsProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileRecord | null>(null)
  
  const { data: filesData, isLoading } = useEntityFiles("workflow_step", stepId)
  const deleteMutation = useDeleteFile()
  
  const files = filesData?.data ?? []
  
  const handleDownload = async (file: FileRecord) => {
    try {
      await downloadFile(file.id, file.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download file")
    }
  }
  
  const handleViewInStorage = (file: FileRecord) => {
    if (file.webUrl) {
      window.open(file.webUrl, "_blank", "noopener,noreferrer")
    } else {
      toast.error("Storage URL not available for this file")
    }
  }
  
  const getStorageProviderLabel = (provider?: string): string => {
    switch (provider) {
      case "sharepoint": return "SharePoint"
      case "azure_blob": return "Azure Blob"
      case "local": return "Local Storage"
      default: return "Storage"
    }
  }
  
  const handleDelete = async () => {
    if (!deletingFile) return
    try {
      await deleteMutation.mutateAsync(deletingFile.id)
      toast.success("File deleted")
      setDeletingFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file")
    }
  }
  
  const handleUploadComplete = () => {
    setShowUpload(false)
    toast.success("File uploaded")
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments
          {files.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {files.length}
            </Badge>
          )}
        </Label>
        {!readOnly && !showUpload && (
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-3 w-3 mr-1.5" />
            Upload
          </Button>
        )}
      </div>
      
      {showUpload && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <CompactFileUpload
            moduleScope="workflows"
            entityType="workflow_step"
            entityId={stepId}
            multiple
            maxFiles={5}
            onUpload={handleUploadComplete}
          />
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="py-2 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : files.length === 0 && !showUpload ? (
        <div className="py-3 text-center border rounded-lg border-dashed">
          <FolderArchive className="h-6 w-6 text-muted-foreground/50 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">
            No attachments
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 rounded border bg-card"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload(file)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  {file.webUrl && (
                    <DropdownMenuItem onClick={() => handleViewInStorage(file)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View in {getStorageProviderLabel(file.storageProvider)}
                    </DropdownMenuItem>
                  )}
                  {!readOnly && (
                    <DropdownMenuItem
                      onClick={() => setDeletingFile(file)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
      
      {/* Delete Confirmation */}
      <Dialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attachment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingFile?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
