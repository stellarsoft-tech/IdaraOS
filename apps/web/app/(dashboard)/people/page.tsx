"use client"

import Link from "next/link"
import { ArrowRight, Calendar, Clock, UserCheck, UserPlus, Users, Building2, Workflow } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { usePeopleList } from "@/lib/api/people"
import { useWorkflowInstancesList } from "@/lib/api/workflows"
import { useMemo } from "react"

// Quick link card for navigation
interface QuickLinkCardProps {
  readonly href: string
  readonly icon: React.ReactNode
  readonly title: string
  readonly description: string
  readonly badge?: React.ReactNode
  readonly count?: number | string
  readonly loading?: boolean
}

function QuickLinkCard({ href, icon, title, description, badge, count, loading }: QuickLinkCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-40 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group hover:border-primary/30 hover:shadow-md transition-all duration-200">
      <Link href={href} className="block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {badge || <span className="text-2xl font-bold">{count ?? 0}</span>}
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

// Stats card component with gradient accent
interface StatsCardProps {
  readonly title: string
  readonly value: number | string
  readonly icon: React.ReactNode
  readonly color: string
  readonly trend?: { readonly value: number; readonly label: string }
  readonly loading?: boolean
}

function StatsCard({ title, value, icon, color, trend, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          {trend && <Skeleton className="h-3 w-24" />}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className={`text-xs ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
      {/* Gradient accent */}
      <div
        className={`absolute top-0 right-0 w-24 h-24 opacity-10 ${color.replace("text-", "bg-").replace("/10 ", " ")}`}
        style={{
          background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
        }}
      />
    </Card>
  )
}

// Activity item component
interface ActivityItemProps {
  readonly icon: React.ReactNode
  readonly iconBg: string
  readonly title: string
  readonly subtitle: string
  readonly time: string
}

function ActivityItem({ icon, iconBg, title, subtitle, time }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-4">
      <div className={`h-9 w-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  )
}

// Activity type for recent activity
interface RecentActivityItem {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly team: string | null | undefined
  readonly status: string
  readonly timeAgo: string
}

// Recent activity content component
function RecentActivityContent({ 
  isLoading, 
  recentActivity 
}: { 
  readonly isLoading: boolean
  readonly recentActivity: RecentActivityItem[]
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <div key={key} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (recentActivity.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p>No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {recentActivity.map((activity) => {
        const isOnboarding = activity.status === "onboarding"
        const activityTitle = activity.name + (isOnboarding ? " started onboarding" : " joined")
        const activitySubtitle = activity.team ? activity.role + ", " + String(activity.team) : activity.role

        return (
          <ActivityItem
            key={activity.id}
            icon={
              isOnboarding ? (
                <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              )
            }
            iconBg={isOnboarding ? "bg-blue-100 dark:bg-blue-900/30" : "bg-green-100 dark:bg-green-900/30"}
            title={activityTitle}
            subtitle={activitySubtitle}
            time={activity.timeAgo}
          />
        )
      })}
    </div>
  )
}

export default function PeopleOverviewPage() {
  const canAccess = useCanAccess("people.overview")
  const { data: people = [], isLoading: isPeopleLoading } = usePeopleList()
  
  // Fetch real workflow instances for people
  const { data: workflowInstances = [], isLoading: isWorkflowsLoading } = useWorkflowInstancesList({
    entityType: "person",
  })
  
  const isLoading = isPeopleLoading || isWorkflowsLoading

  // Calculate stats from real data
  const stats = useMemo(() => {
    const total = people.length
    const active = people.filter((p) => p.status === "active").length
    const onboarding = people.filter((p) => p.status === "onboarding").length
    const offboarding = people.filter((p) => p.status === "offboarding").length
    const teams = new Set(people.map(p => p.team).filter(Boolean)).size

    return { total, active, onboarding, offboarding, teams }
  }, [people])
  
  // Calculate workflow stats from real workflow instances
  const workflowStats = useMemo(() => {
    const activeWorkflows = workflowInstances.filter(
      w => w.status === "pending" || w.status === "in_progress"
    )
    return {
      active: activeWorkflows.length,
      total: workflowInstances.length,
    }
  }, [workflowInstances])

  // Get recent activity based on start dates
  const recentActivity = useMemo(() => {
    const peopleWithDates = people.filter((p): p is typeof p & { startDate: string } => Boolean(p.startDate))
    const sortedByDate = [...peopleWithDates]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 3)

    return sortedByDate.map(person => {
      const startDate = new Date(person.startDate)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      
      let timeAgo = "Just now"
      if (diffDays === 1) {
        timeAgo = "1 day ago"
      } else if (diffDays > 1 && diffDays < 7) {
        timeAgo = diffDays + " days ago"
      } else if (diffDays >= 7 && diffDays < 30) {
        timeAgo = Math.floor(diffDays / 7) + " weeks ago"
      } else if (diffDays >= 30) {
        timeAgo = Math.floor(diffDays / 30) + " months ago"
      }

      return {
        id: person.id,
        name: person.name,
        role: person.role,
        team: person.team,
        status: person.status,
        timeAgo,
      }
    })
  }, [people])

  if (!canAccess) {
    return (
      <PageShell title="People & HR">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the People & HR module." 
        />
      </PageShell>
    )
  }

  return (
    <PageShell 
      title="People & HR" 
      description="Manage your workforce, onboarding, and HR operations."
      action={
        <Protected module="people.directory" action="create">
          <Button asChild>
            <Link href="/people/directory?create=true">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Person
            </Link>
          </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard 
            title="Total People" 
            value={stats.total} 
            icon={<Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            loading={isLoading}
          />
          <StatsCard 
            title="Active Employees" 
            value={stats.active} 
            icon={<UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />}
            color="bg-green-500/10 text-green-600 dark:text-green-400"
            loading={isLoading}
          />
          <StatsCard 
            title="Onboarding" 
            value={stats.onboarding} 
            icon={<UserPlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            loading={isLoading}
          />
          <StatsCard 
            title="Teams" 
            value={stats.teams} 
            icon={<Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
            color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            loading={isLoading}
          />
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            href="/people/directory"
            icon={<Users className="h-4 w-4" />}
            title="Directory"
            description="View and manage all employees"
            count={stats.total}
            loading={isLoading}
          />
          <QuickLinkCard
            href="/people/workflows"
            icon={<Workflow className="h-4 w-4" />}
            title="Workflows"
            description="Onboarding, offboarding & more"
            badge={
              workflowStats.active > 0 ? (
                <StatusBadge variant="info">{workflowStats.active} active</StatusBadge>
              ) : (
                <span className="text-sm text-muted-foreground">No active workflows</span>
              )
            }
            loading={isLoading}
          />
          <QuickLinkCard
            href="/people/settings"
            icon={<Calendar className="h-4 w-4" />}
            title="Settings"
            description="Entra sync & workflow automation"
            badge={<span className="text-sm text-muted-foreground">Configure</span>}
            loading={isLoading}
          />
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest changes and updates in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivityContent 
              isLoading={isLoading} 
              recentActivity={recentActivity} 
            />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
