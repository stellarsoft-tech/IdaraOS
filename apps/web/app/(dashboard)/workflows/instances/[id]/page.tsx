"use client"

import { use, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
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

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowInstanceDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const canAccess = useCanAccess("workflows.instances")
  
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showStepDialog, setShowStepDialog] = useState<WorkflowInstanceStep | null>(null)
  const [stepNotes, setStepNotes] = useState("")
  
  // Queries
  const { data: instance, isLoading, error } = useWorkflowInstanceDetail(id)
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
  
  const handleStepClick = (step: WorkflowInstanceStep) => {
    setShowStepDialog(step)
    setStepNotes(step.notes || "")
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
  const isOverdue = isActive && instance.dueAt && new Date(instance.dueAt) < new Date()
  
  return (
    <PageShell
      title={instance.name}
      description={instance.template?.name}
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
      <div className="space-y-6">
        {/* Back link */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/workflows/instances">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Link>
        </Button>
        
        {/* Status and Progress */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Progress</CardTitle>
                <InstanceStatusBadge status={instance.status as InstanceStatus} />
              </div>
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Steps</CardTitle>
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === "kanban" ? (
              <WorkflowKanban
                instance={instance}
                onStepClick={handleStepClick}
                onCompleteStep={handleCompleteStep}
                onStartStep={handleStartStep}
              />
            ) : (
              <WorkflowTaskList
                steps={instance.steps}
                onStepClick={handleStepClick}
                onStepComplete={(stepId, completed) => {
                  if (completed) {
                    handleCompleteStep(stepId)
                  }
                }}
              />
            )}
          </CardContent>
        </Card>
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
        <DialogContent>
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
              <div>
                <span className="text-muted-foreground">Assignee</span>
                <p className="font-medium">
                  {showStepDialog?.assignee?.name || "Unassigned"}
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
                <div>
                  <span className="text-muted-foreground">Completed</span>
                  <p className="font-medium">
                    {format(new Date(showStepDialog.completedAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={stepNotes}
                onChange={(e) => setStepNotes(e.target.value)}
                placeholder="Add notes about this step..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepDialog(null)}>
              Close
            </Button>
            {showStepDialog?.status !== "completed" && instance.status !== "completed" && (
              <Button 
                onClick={() => {
                  if (showStepDialog) {
                    handleCompleteStep(showStepDialog.id)
                    setShowStepDialog(null)
                  }
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Step
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

