"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ListChecks, AlertCircle } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { 
  useWorkflowInstancesList,
  type WorkflowInstanceStep,
} from "@/lib/api/workflows"

export default function WorkflowTasksPage() {
  const canAccess = useCanAccess("workflows.tasks")
  
  // Fetch all active instances
  const { data: instances = [], isLoading } = useWorkflowInstancesList({
    status: "in_progress,pending",
  })
  
  // Flatten all steps from all instances
  const _allSteps = useMemo(() => {
    const steps: (WorkflowInstanceStep & { instanceName?: string })[] = []
    
    for (const _instance of instances) {
      // We need instance detail for steps, but for now aggregate from instance list
      // This would need the detail endpoint or a dedicated tasks endpoint
    }
    
    return steps
  }, [instances])
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = instances.reduce((sum, i) => sum + i.totalSteps, 0)
    const completed = instances.reduce((sum, i) => sum + i.completedSteps, 0)
    const pending = total - completed
    
    // Count overdue instances (we'd need step-level data for accurate overdue tasks)
    const now = new Date()
    const overdueInstances = instances.filter(
      i => i.dueAt && new Date(i.dueAt) < now
    ).length
    
    return { total, completed, pending, overdueInstances }
  }, [instances])
  
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
      description="View all tasks assigned to you across workflows."
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-sm text-muted-foreground">Pending Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-sm text-muted-foreground">Completed Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.overdueInstances}</div>
              <p className="text-sm text-muted-foreground">Overdue Workflows</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Task List - Grouped by Instance */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No active tasks</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You don&apos;t have any tasks assigned to you right now.
            </p>
            <Button asChild>
              <Link href="/workflows/instances">View All Workflows</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {instances.map((instance) => {
              const isOverdue = instance.dueAt && new Date(instance.dueAt) < new Date()
              
              return (
                <Card key={instance.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link 
                          href={`/workflows/instances/${instance.id}`}
                          className="font-semibold hover:text-primary hover:underline"
                        >
                          {instance.name}
                        </Link>
                        {instance.entity && (
                          <CardDescription>{instance.entity.name}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <div className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            Overdue
                          </div>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {instance.completedSteps}/{instance.totalSteps} completed
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm text-muted-foreground">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/workflows/instances/${instance.id}`}>
                          View Tasks
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}

