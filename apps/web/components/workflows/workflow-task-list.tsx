"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  AlertCircle,
  User,
  Calendar,
} from "lucide-react"
import { StepStatusBadge, type StepStatus } from "./step-status-badge"
import type { WorkflowInstanceStep } from "@/lib/api/workflows"

interface WorkflowTaskListProps {
  steps: WorkflowInstanceStep[]
  groupBy?: "status" | "assignee" | "none"
  onStepClick?: (step: WorkflowInstanceStep) => void
  onStepComplete?: (stepId: string, completed: boolean) => void
  showCompleted?: boolean
  className?: string
  readOnly?: boolean
}

function isOverdue(dueAt?: string): boolean {
  if (!dueAt) return false
  return new Date(dueAt) < new Date()
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function TaskRow({
  step,
  onClick,
  onComplete,
  depth = 0,
}: {
  step: WorkflowInstanceStep
  onClick?: () => void
  onComplete?: (completed: boolean) => void
  depth?: number
}) {
  const isCompleted = step.status === "completed"
  const overdue = !isCompleted && isOverdue(step.dueAt)
  const isInteractive = !!onClick

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-md group",
        isInteractive && "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer",
        !isInteractive && "cursor-default",
        depth > 0 && "ml-6"
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isCompleted}
          onCheckedChange={onComplete ? (checked) => onComplete(checked as boolean) : undefined}
          disabled={!onComplete || step.status === "skipped" || step.status === "blocked"}
        />
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {step.name}
          </span>
          {step.templateStep?.isRequired === false && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              Optional
            </Badge>
          )}
        </div>
        {step.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {step.description}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Status (for non-pending/in-progress/completed) */}
        {(step.status === "skipped" || step.status === "blocked") && (
          <StepStatusBadge status={step.status} size="sm" />
        )}

        {/* Due Date */}
        {step.dueAt && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    overdue
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  )}
                >
                  {overdue ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Calendar className="h-3 w-3" />
                  )}
                  {formatDate(step.dueAt)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Due: {new Date(step.dueAt).toLocaleString()}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Assignee - check assignedPerson first (from people directory), then assignee (from users) */}
        {(step.assignedPerson || step.assignee) ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {(step.assignedPerson?.name || step.assignee?.name || "?").charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{step.assignedPerson?.name || step.assignee?.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="h-6 w-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
            <User className="h-3 w-3 text-slate-400" />
          </div>
        )}
      </div>
    </div>
  )
}

interface GroupedSteps {
  label: string
  steps: WorkflowInstanceStep[]
  id: string
}

export function WorkflowTaskList({
  steps,
  groupBy = "none",
  onStepClick,
  onStepComplete,
  showCompleted = true,
  className,
  readOnly = false,
}: WorkflowTaskListProps) {
  // Filter and group steps
  const groups = useMemo(() => {
    // Filter out completed if needed, and only root-level steps
    let filtered = steps.filter((s) => !s.parentStepId)
    if (!showCompleted) {
      filtered = filtered.filter((s) => s.status !== "completed")
    }

    // Sort by orderIndex
    filtered.sort((a, b) => a.orderIndex - b.orderIndex)

    if (groupBy === "none") {
      return [{ label: "", steps: filtered, id: "all" }] as GroupedSteps[]
    }

    if (groupBy === "status") {
      const statusOrder: StepStatus[] = [
        "in_progress",
        "pending",
        "blocked",
        "skipped",
        "completed",
      ]
      const statusLabels: Record<StepStatus, string> = {
        in_progress: "In Progress",
        pending: "To Do",
        completed: "Completed",
        skipped: "Skipped",
        blocked: "Blocked",
      }

      const groups: GroupedSteps[] = []
      for (const status of statusOrder) {
        const stepsInStatus = filtered.filter((s) => s.status === status)
        if (stepsInStatus.length > 0) {
          groups.push({
            label: statusLabels[status],
            steps: stepsInStatus,
            id: status,
          })
        }
      }
      return groups
    }

    if (groupBy === "assignee") {
      const byAssignee = new Map<string, WorkflowInstanceStep[]>()
      const unassigned: WorkflowInstanceStep[] = []

      for (const step of filtered) {
        // Check assignedPerson first (from people directory), then assignee (from users)
        const assigneeInfo = step.assignedPerson || step.assignee
        if (assigneeInfo) {
          const key = assigneeInfo.id
          if (!byAssignee.has(key)) {
            byAssignee.set(key, [])
          }
          byAssignee.get(key)!.push(step)
        } else {
          unassigned.push(step)
        }
      }

      const groups: GroupedSteps[] = []

      // Sort assignees alphabetically
      const sortedAssignees = [...byAssignee.entries()].sort((a, b) => {
        const stepA = a[1][0]
        const stepB = b[1][0]
        const nameA = stepA.assignedPerson?.name || stepA.assignee?.name || ""
        const nameB = stepB.assignedPerson?.name || stepB.assignee?.name || ""
        return nameA.localeCompare(nameB)
      })

      for (const [assigneeId, assigneeSteps] of sortedAssignees) {
        const firstStep = assigneeSteps[0]
        groups.push({
          label: firstStep.assignedPerson?.name || firstStep.assignee?.name || "Unknown",
          steps: assigneeSteps,
          id: assigneeId,
        })
      }

      if (unassigned.length > 0) {
        groups.push({
          label: "Unassigned",
          steps: unassigned,
          id: "unassigned",
        })
      }

      return groups
    }

    return [{ label: "", steps: filtered, id: "all" }] as GroupedSteps[]
  }, [steps, groupBy, showCompleted])

  // Calculate stats
  const stats = useMemo(() => {
    const rootSteps = steps.filter((s) => !s.parentStepId)
    const total = rootSteps.length
    const completed = rootSteps.filter((s) => s.status === "completed").length
    const overdue = rootSteps.filter(
      (s) => s.status !== "completed" && isOverdue(s.dueAt)
    ).length

    return { total, completed, overdue }
  }, [steps])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <span>
          <span className="font-medium">{stats.completed}</span>
          <span className="text-muted-foreground"> / {stats.total} completed</span>
        </span>
        {stats.overdue > 0 && (
          <span className="text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            {stats.overdue} overdue
          </span>
        )}
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            {/* Group Header */}
            {group.label && (
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {group.label}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {group.steps.length}
                </Badge>
              </div>
            )}

            {/* Tasks */}
            <div className="border rounded-lg divide-y">
              {group.steps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No tasks
                </div>
              ) : (
                group.steps.map((step) => (
                  <TaskRow
                    key={step.id}
                    step={step}
                    onClick={readOnly ? undefined : () => onStepClick?.(step)}
                    onComplete={readOnly ? undefined : (completed) =>
                      onStepComplete?.(step.id, completed)
                    }
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Compact task list for embedding in other views
 */
export function CompactTaskList({
  steps,
  onStepClick,
  onStepComplete,
  maxVisible = 5,
  className,
}: {
  steps: WorkflowInstanceStep[]
  onStepClick?: (step: WorkflowInstanceStep) => void
  onStepComplete?: (stepId: string, completed: boolean) => void
  maxVisible?: number
  className?: string
}) {
  // Filter to incomplete root steps
  const incompleteTasks = useMemo(() => {
    return steps
      .filter((s) => !s.parentStepId && s.status !== "completed")
      .sort((a, b) => a.orderIndex - b.orderIndex)
  }, [steps])

  const visibleTasks = incompleteTasks.slice(0, maxVisible)
  const remainingCount = incompleteTasks.length - maxVisible

  return (
    <div className={cn("space-y-1", className)}>
      {visibleTasks.map((step) => (
        <TaskRow
          key={step.id}
          step={step}
          onClick={() => onStepClick?.(step)}
          onComplete={(completed) =>
            onStepComplete?.(step.id, completed)
          }
        />
      ))}
      {remainingCount > 0 && (
        <div className="text-xs text-muted-foreground text-center py-2">
          +{remainingCount} more tasks
        </div>
      )}
      {incompleteTasks.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          All tasks completed! 🎉
        </div>
      )}
    </div>
  )
}

