"use client"

import { useMemo } from "react"
import Link from "next/link"
import { format, formatDistanceToNow, isPast } from "date-fns"
import { ListChecks, AlertCircle, Clock, CheckCircle2, ArrowRight } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useMyWorkflowTasks, type MyWorkflowTask } from "@/lib/api/workflows"

const OPEN_STATUSES: MyWorkflowTask["status"][] = ["pending", "in_progress", "blocked"]

const statusConfig: Record<
  MyWorkflowTask["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  skipped: { label: "Skipped", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
}

export default function WorkflowTasksPage() {
  const canAccess = useCanAccess("workflows.tasks")

  const { data: tasks = [], isLoading } = useMyWorkflowTasks()

  const openTasks = useMemo(
    () => tasks.filter((task) => OPEN_STATUSES.includes(task.status)),
    [tasks]
  )

  const stats = useMemo(() => {
    const now = new Date()
    const pending = openTasks.length
    const completed = tasks.filter((task) => task.status === "completed").length
    const overdue = openTasks.filter(
      (task) => task.dueAt && isPast(new Date(task.dueAt)) && new Date(task.dueAt) < now
    ).length
    return { pending, completed, overdue }
  }, [tasks, openTasks])

  // Group open tasks by their parent instance for a tidy layout.
  const groupedByInstance = useMemo(() => {
    const groups = new Map<
      string,
      { instanceId: string; instanceName: string; entityName?: string | null; tasks: MyWorkflowTask[] }
    >()

    for (const task of openTasks) {
      const existing = groups.get(task.instanceId)
      if (existing) {
        existing.tasks.push(task)
      } else {
        groups.set(task.instanceId, {
          instanceId: task.instanceId,
          instanceName: task.instanceName,
          entityName: task.entityName,
          tasks: [task],
        })
      }
    }

    return Array.from(groups.values())
  }, [openTasks])

  if (!canAccess) {
    return (
      <PageShell title="My Tasks">
        <AccessDenied
          title="Access Denied"
          description="You don't have permission to view tasks."
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="My Tasks"
      description="Workflow tasks assigned to you across all active workflows."
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <p className="text-sm text-muted-foreground">Open Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.completed}</div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task list grouped by instance */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groupedByInstance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No open tasks</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You don&apos;t have any workflow tasks assigned to you right now.
            </p>
            <Button asChild>
              <Link href="/workflows/instances">View All Workflows</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByInstance.map((group) => (
              <Card key={group.instanceId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/workflows/instances/${group.instanceId}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {group.instanceName}
                      </Link>
                      {group.entityName && (
                        <p className="text-sm text-muted-foreground">{group.entityName}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y rounded-md border">
                    {group.tasks.map((task) => {
                      const overdue =
                        task.dueAt && isPast(new Date(task.dueAt)) && task.status !== "completed"
                      return (
                        <Link
                          key={task.id}
                          href={`/workflows/instances/${task.instanceId}?step=${task.id}`}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{task.name}</p>
                            {task.dueAt && (
                              <p
                                className={`text-xs ${overdue ? "text-red-600" : "text-muted-foreground"}`}
                              >
                                {overdue ? "Overdue · " : "Due "}
                                {format(new Date(task.dueAt), "MMM d, yyyy")}
                                {!overdue && (
                                  <> · {formatDistanceToNow(new Date(task.dueAt), { addSuffix: true })}</>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={statusConfig[task.status]?.className}>
                              {statusConfig[task.status]?.label ?? task.status}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
