"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Clock, 
  CheckCircle2,
  MoreHorizontal,
  User,
  Calendar,
  AlertCircle
} from "lucide-react"
import { StepStatusBadge, type StepStatus } from "./step-status-badge"
import type { WorkflowInstanceStep, WorkflowInstanceDetail } from "@/lib/api/workflows"

interface WorkflowKanbanProps {
  instance: WorkflowInstanceDetail
  onStepClick?: (step: WorkflowInstanceStep) => void
  onCompleteStep?: (stepId: string) => void
  onStartStep?: (stepId: string) => void
  className?: string
}

// Column configuration
const columns: { status: StepStatus; title: string }[] = [
  { status: "pending", title: "To Do" },
  { status: "in_progress", title: "In Progress" },
  { status: "completed", title: "Done" },
]

function isOverdue(dueAt?: string): boolean {
  if (!dueAt) return false
  return new Date(dueAt) < new Date()
}

function formatDueDate(dueAt?: string): string {
  if (!dueAt) return ""
  const date = new Date(dueAt)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `Due in ${days}d`
}

function StepCard({
  step,
  onClick,
  onComplete,
  onStart,
}: {
  step: WorkflowInstanceStep
  onClick?: () => void
  onComplete?: () => void
  onStart?: () => void
}) {
  const overdue = step.status !== "completed" && isOverdue(step.dueAt)

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        overdue && "border-red-300 dark:border-red-700"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{step.name}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {step.status === "pending" && onStart && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onStart()
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Start Task
                </DropdownMenuItem>
              )}
              {step.status !== "completed" && onComplete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onComplete()
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {step.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {step.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Assignee */}
          {step.assignee ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {step.assignee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                {step.assignee.name}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="text-xs">Unassigned</span>
            </div>
          )}

          {/* Due date */}
          {step.dueAt && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              )}
            >
              {overdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Calendar className="h-3 w-3" />
              )}
              {formatDueDate(step.dueAt)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function WorkflowKanban({
  instance,
  onStepClick,
  onCompleteStep,
  onStartStep,
  className,
}: WorkflowKanbanProps) {
  // Group steps by status
  const stepsByStatus = useMemo(() => {
    const grouped: Record<StepStatus, WorkflowInstanceStep[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      skipped: [],
      blocked: [],
    }

    // Only show root-level steps (no parentStepId)
    const rootSteps = instance.steps.filter((s) => !s.parentStepId)

    for (const step of rootSteps) {
      grouped[step.status].push(step)
    }

    // Sort by orderIndex within each group
    for (const status of Object.keys(grouped) as StepStatus[]) {
      grouped[status].sort((a, b) => a.orderIndex - b.orderIndex)
    }

    return grouped
  }, [instance.steps])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Instance Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{instance.name}</h2>
          {instance.entity && (
            <p className="text-sm text-muted-foreground">
              {instance.entity.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">
              {instance.completedSteps} / {instance.totalSteps} steps
            </div>
            <Progress value={instance.progress} className="w-24 h-2 mt-1" />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-4">
        {columns.map(({ status, title }) => (
          <div key={status} className="space-y-3">
            {/* Column Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{title}</h3>
                <Badge variant="secondary" className="text-xs">
                  {stepsByStatus[status].length}
                </Badge>
              </div>
            </div>

            {/* Column Content */}
            <div className="space-y-2 min-h-[200px] bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
              {stepsByStatus[status].length === 0 ? (
                <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                  No tasks
                </div>
              ) : (
                stepsByStatus[status].map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    onClick={() => onStepClick?.(step)}
                    onComplete={() => onCompleteStep?.(step.id)}
                    onStart={() => onStartStep?.(step.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Skipped/Blocked Steps (if any) */}
      {(stepsByStatus.skipped.length > 0 || stepsByStatus.blocked.length > 0) && (
        <div className="pt-4 border-t">
          <h3 className="font-medium text-sm mb-3">Other Steps</h3>
          <div className="grid grid-cols-2 gap-4">
            {stepsByStatus.skipped.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StepStatusBadge status="skipped" size="sm" />
                  <span className="text-sm text-muted-foreground">
                    ({stepsByStatus.skipped.length})
                  </span>
                </div>
                {stepsByStatus.skipped.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    onClick={() => onStepClick?.(step)}
                  />
                ))}
              </div>
            )}
            {stepsByStatus.blocked.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StepStatusBadge status="blocked" size="sm" />
                  <span className="text-sm text-muted-foreground">
                    ({stepsByStatus.blocked.length})
                  </span>
                </div>
                {stepsByStatus.blocked.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    onClick={() => onStepClick?.(step)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

