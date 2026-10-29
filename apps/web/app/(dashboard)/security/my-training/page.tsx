"use client"

import Link from "next/link"
import { format } from "date-fns"
import { AlertTriangle, CheckCircle, Clock, GraduationCap, PlayCircle, RotateCcw } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyTraining, type MyTrainingItem } from "@/lib/api/security-training"
import {
  trainingAssignmentStatusClassNames,
  trainingAssignmentStatusLabels,
  trainingCategoryLabels,
} from "@/lib/security/training"

function actionLabel(item: MyTrainingItem): string {
  switch (item.status) {
    case "passed":
      return "Review"
    case "retake_required":
      return "Retake Course"
    case "in_progress":
      return item.videoCompletedAt ? "Take Quiz" : "Continue"
    default:
      return "Start Course"
  }
}

export default function MyTrainingPage() {
  const { data, isLoading } = useMyTraining()
  const items = data?.data ?? []
  const stats = data?.stats

  return (
    <PageShell
      title="My Training"
      description="Security awareness courses assigned to you. Watch the lesson, then pass the 10-question quiz."
      icon={GraduationCap}
    >
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">To Complete</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{stats?.outstanding ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Passed</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-300">{stats?.passed ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">Retake Required</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-900 dark:text-red-300">{stats?.retakeRequired ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Overdue</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-300">{stats?.overdue ?? 0}</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">You have no training assigned right now.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{item.course.title}</h3>
                <Badge variant="outline">{trainingCategoryLabels[item.course.category]}</Badge>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${trainingAssignmentStatusClassNames[item.status]}`}
                >
                  {trainingAssignmentStatusLabels[item.status]}
                </span>
                {item.isOverdue && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Overdue</span>
                )}
              </div>
              {item.course.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{item.course.description}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.course.videoDurationMinutes && <span>~{item.course.videoDurationMinutes} min lesson</span>}
                <span>Pass mark {item.course.passingScore}%</span>
                {item.dueDate && <span>Due {format(new Date(`${item.dueDate}T00:00:00`), "MMM d, yyyy")}</span>}
                {item.lastScore !== null && <span>Last score {item.lastScore}%</span>}
                {item.attemptCount > 0 && <span>{item.attemptCount} attempt{item.attemptCount === 1 ? "" : "s"}</span>}
              </div>
            </div>
            <Button asChild variant={item.status === "passed" ? "outline" : "default"}>
              <Link href={`/security/my-training/${item.id}`}>
                {item.status === "retake_required" ? (
                  <RotateCcw className="mr-2 h-4 w-4" />
                ) : item.status === "passed" ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {actionLabel(item)}
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
