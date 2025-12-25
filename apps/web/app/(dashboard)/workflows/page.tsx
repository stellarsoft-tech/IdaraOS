"use client"

import { useMemo } from "react"
import Link from "next/link"
import { 
  Workflow, 
  ListChecks, 
  Layers,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Settings,
  LayoutGrid,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useWorkflowTemplatesList, useWorkflowInstancesList } from "@/lib/api/workflows"

interface StatsCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  iconColor: string
  loading?: boolean
  href?: string
}

function StatsCard({ title, value, subtitle, icon, iconColor, loading, href }: StatsCardProps) {
  const iconBgColor = iconColor.replace("text-", "bg-").replace("/10", "/10")
  
  const content = (
    <Card className={`relative overflow-hidden ${href ? "hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg ${iconBgColor} flex items-center justify-center`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </>
        )}
      </CardContent>
      {/* Gradient accent */}
      <div
        className={`absolute top-0 right-0 w-24 h-24 opacity-10 ${iconBgColor}`}
        style={{
          background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
        }}
      />
    </Card>
  )
  
  if (href) {
    return <Link href={href}>{content}</Link>
  }
  
  return content
}

interface QuickLinkProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

function QuickLink({ title, description, href, icon }: QuickLinkProps) {
  return (
    <Card className="group hover:border-primary/30 hover:shadow-md transition-all duration-200 h-full">
      <Link href={href} className="block">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <span className="group-hover:text-primary transition-colors">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate">{title}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

export default function WorkflowsOverviewPage() {
  const canAccess = useCanAccess("workflows.overview")
  
  // Fetch data
  const { data: templates = [], isLoading: templatesLoading } = useWorkflowTemplatesList()
  const { data: instances = [], isLoading: instancesLoading } = useWorkflowInstancesList()
  
  const isLoading = templatesLoading || instancesLoading
  
  // Calculate stats
  const stats = useMemo(() => {
    const activeTemplates = templates.filter(t => t.status === "active").length
    const totalTemplates = templates.length
    
    const activeInstances = instances.filter(i => i.status === "in_progress").length
    const pendingInstances = instances.filter(i => i.status === "pending").length
    const completedInstances = instances.filter(i => i.status === "completed").length
    const totalInstances = instances.length
    
    // Calculate total tasks and completion rate
    const totalTasks = instances.reduce((sum, i) => sum + i.totalSteps, 0)
    const completedTasks = instances.reduce((sum, i) => sum + i.completedSteps, 0)
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    
    // Overdue instances
    const now = new Date()
    const overdue = instances.filter(
      i => i.status !== "completed" && i.status !== "cancelled" && i.dueAt && new Date(i.dueAt) < now
    ).length
    
    return { 
      activeTemplates, 
      totalTemplates,
      activeInstances,
      pendingInstances,
      completedInstances,
      totalInstances,
      totalTasks,
      completedTasks,
      completionRate,
      overdue,
    }
  }, [templates, instances])
  
  // Recent active workflows
  const recentInstances = useMemo(() => {
    return instances
      .filter(i => i.status === "in_progress" || i.status === "pending")
      .slice(0, 5)
  }, [instances])
  
  if (!canAccess) {
    return (
      <PageShell title="Workflows">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the workflows module." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Workflows"
      description="Automate and track business processes with customizable workflows."
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Active Workflows"
            value={stats.activeInstances}
            subtitle="currently running"
            icon={<Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            iconColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            loading={isLoading}
            href="/workflows/instances?status=in_progress"
          />
          <StatsCard
            title="Templates"
            value={stats.activeTemplates}
            subtitle={`of ${stats.totalTemplates} total`}
            icon={<Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
            iconColor="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            loading={isLoading}
            href="/workflows/templates"
          />
          <StatsCard
            title="Completed"
            value={stats.completedInstances}
            subtitle="workflows finished"
            icon={<CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
            iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
            loading={isLoading}
            href="/workflows/instances?status=completed"
          />
          <StatsCard
            title="Overdue"
            value={stats.overdue}
            subtitle="need attention"
            icon={<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
            iconColor="bg-red-500/10 text-red-600 dark:text-red-400"
            loading={isLoading}
          />
        </div>
        
        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            title="Templates"
            description="Create and manage workflow templates"
            href="/workflows/templates"
            icon={<Layers className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Active Workflows"
            description={`${stats.activeInstances + stats.pendingInstances} workflows in progress`}
            href="/workflows/instances"
            icon={<Workflow className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Board View"
            description="Kanban board for visual tracking"
            href="/workflows/board"
            icon={<LayoutGrid className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="My Tasks"
            description="View tasks assigned to you"
            href="/workflows/tasks"
            icon={<ListChecks className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Settings"
            description="Configure workflow preferences"
            href="/workflows/settings"
            icon={<Settings className="h-5 w-5 text-primary" />}
          />
        </div>
        
        {/* Recent Workflows & Task Progress */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Active Workflows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Workflows</CardTitle>
              <CardDescription>Active and pending workflows</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentInstances.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Workflow className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No active workflows</p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/workflows/templates">Create from template</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentInstances.map((instance) => (
                    <Link 
                      key={instance.id} 
                      href={`/workflows/instances/${instance.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{instance.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {instance.entity?.name || instance.entityType}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {instance.completedSteps}/{instance.totalSteps}
                          </span>
                          <Progress 
                            value={instance.progress} 
                            className="w-16 h-1.5" 
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                  {instances.length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <Link href="/workflows/instances">View all workflows</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Task Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Progress</CardTitle>
              <CardDescription>Overall completion across all workflows</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : stats.totalTasks === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <ListChecks className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No tasks yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {stats.completedTasks} of {stats.totalTasks} tasks completed
                    </span>
                    <span className="font-medium">{stats.completionRate}%</span>
                  </div>
                  <Progress value={stats.completionRate} className="h-3" />
                  
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.activeInstances}
                      </div>
                      <div className="text-xs text-muted-foreground">In Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.pendingInstances}
                      </div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.completedInstances}
                      </div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
