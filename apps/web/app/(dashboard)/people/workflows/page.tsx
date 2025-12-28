"use client"

import { useMemo } from "react"
import Link from "next/link"
import { 
  Workflow,
  CheckCircle2,
  PlayCircle,
  Users,
  UserPlus,
  UserMinus,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { WorkflowInstancesTable } from "@/components/workflows"
import { 
  useWorkflowInstancesList,
  useWorkflowTemplatesList,
} from "@/lib/api/workflows"

// Stats Card Component
interface StatsCardProps {
  readonly title: string
  readonly value: number
  readonly icon: React.ReactNode
  readonly color: string
  readonly loading?: boolean
}

function StatsCard({ title, value, icon, color, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
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
      </CardContent>
    </Card>
  )
}

export default function PeopleWorkflowsPage() {
  const canAccess = useCanAccess("people.directory")
  
  // Query instances for "person" entity type
  const { data: instances = [], isLoading } = useWorkflowInstancesList({
    entityType: "person",
  })
  
  // Query templates for people module (for reference)
  const { data: templates = [] } = useWorkflowTemplatesList({ 
    moduleScope: "people",
    activeOnly: true,
  })
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = instances.length
    const inProgress = instances.filter(i => i.status === "in_progress" || i.status === "pending").length
    const completed = instances.filter(i => i.status === "completed").length
    const onboarding = instances.filter(i => 
      i.template?.triggerType === "onboarding" && 
      i.status !== "completed" && 
      i.status !== "cancelled"
    ).length
    const offboarding = instances.filter(i => 
      i.template?.triggerType === "offboarding" && 
      i.status !== "completed" && 
      i.status !== "cancelled"
    ).length
    return { total, inProgress, completed, onboarding, offboarding }
  }, [instances])
  
  if (!canAccess) {
    return (
      <PageShell title="People Workflows">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view people workflows." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="People Workflows"
      description="View and manage workflows related to employees."
      action={
        <Button asChild variant="outline">
          <Link href="/workflows/templates?moduleScope=people">
            <Workflow className="h-4 w-4 mr-2" />
            View Templates
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatsCard 
            title="Total Workflows" 
            value={stats.total}
            icon={<Workflow className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            color="bg-blue-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="In Progress" 
            value={stats.inProgress}
            icon={<PlayCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            color="bg-amber-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="Completed" 
            value={stats.completed}
            icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
            color="bg-green-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="Onboarding" 
            value={stats.onboarding}
            icon={<UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            color="bg-emerald-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="Offboarding" 
            value={stats.offboarding}
            icon={<UserMinus className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
            color="bg-rose-500/10"
            loading={isLoading}
          />
        </div>

        {/* Shared Workflow Instances Table - scoped to people module */}
        {instances.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No people workflows</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Workflows will appear here when onboarding or offboarding is triggered for employees.
              Configure automatic workflows in People Settings.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/people/settings">
                  Configure Workflows
                </Link>
              </Button>
              <Button asChild>
                <Link href="/workflows/templates?moduleScope=people">
                  Create Template
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <WorkflowInstancesTable
            instances={instances}
            isLoading={isLoading}
            moduleScope="people"
            searchPlaceholder="Search people workflows..."
          />
        )}
      </div>
    </PageShell>
  )
}
