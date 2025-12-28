"use client"

import { useMemo } from "react"
import Link from "next/link"
import { 
  AlertCircle,
  Workflow,
  CheckCircle2,
  Clock,
  PlayCircle,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { WorkflowInstancesTable } from "@/components/workflows"
import { 
  useWorkflowInstancesList,
  useWorkflowTemplatesList,
} from "@/lib/api/workflows"

// Stats card component
interface StatsCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  color: string
  loading?: boolean
}

function StatsCard({ title, value, subtitle, icon, color, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function WorkflowInstancesPage() {
  const canAccess = useCanAccess("workflows.instances")
  
  // Queries - fetch all instances for client-side filtering
  const { data: instances = [], isLoading } = useWorkflowInstancesList()
  const { data: templates = [] } = useWorkflowTemplatesList({ activeOnly: true })
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = instances.length
    const inProgress = instances.filter(i => i.status === "in_progress").length
    const pending = instances.filter(i => i.status === "pending").length
    const completed = instances.filter(i => i.status === "completed").length
    const onHold = instances.filter(i => i.status === "on_hold").length
    const cancelled = instances.filter(i => i.status === "cancelled").length
    
    // Count by type
    const onboarding = instances.filter(i => i.template?.triggerType === "onboarding").length
    const offboarding = instances.filter(i => i.template?.triggerType === "offboarding").length
    
    // Overdue count
    const now = new Date()
    const overdue = instances.filter(i => 
      i.status !== "completed" && 
      i.status !== "cancelled" && 
      i.dueAt && 
      new Date(i.dueAt) < now
    ).length
    
    return { total, inProgress, pending, completed, onHold, cancelled, onboarding, offboarding, overdue }
  }, [instances])
  
  if (!canAccess) {
    return (
      <PageShell title="Workflows">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view workflow instances." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Active Workflows"
      description="View and manage running workflow instances."
    >
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <StatsCard
          title="Total Workflows"
          value={stats.total}
          subtitle="All instances"
          icon={<Workflow className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
          color="bg-blue-500/10"
          loading={isLoading}
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgress}
          subtitle="Currently active"
          icon={<PlayCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          color="bg-amber-500/10"
          loading={isLoading}
        />
        <StatsCard
          title="Pending"
          value={stats.pending}
          subtitle="Waiting to start"
          icon={<Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
          color="bg-slate-500/10"
          loading={isLoading}
        />
        <StatsCard
          title="Completed"
          value={stats.completed}
          subtitle="Successfully finished"
          icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
          color="bg-green-500/10"
          loading={isLoading}
        />
        <StatsCard
          title="Overdue"
          value={stats.overdue}
          subtitle="Past due date"
          icon={<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
          color="bg-red-500/10"
          loading={isLoading}
        />
      </div>
      
      {/* Shared Workflow Instances Table - global scope (all types) */}
      {instances.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No workflow instances have been created yet
          </p>
          <Button asChild>
            <Link href="/workflows/templates">View Templates</Link>
          </Button>
        </div>
      ) : (
        <WorkflowInstancesTable
          instances={instances}
          isLoading={isLoading}
          moduleScope="global"
          searchPlaceholder="Search workflows..."
        />
      )}
    </PageShell>
  )
}
