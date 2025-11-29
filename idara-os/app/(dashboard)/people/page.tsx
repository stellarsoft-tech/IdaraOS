import Link from "next/link"
import { ArrowRight, Calendar, Clock, FileText, UserCheck, UserMinus, UserPlus, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { people } from "@/lib/seed-data"

export default function PeopleOverviewPage() {
  const activeCount = people.filter((p) => p.status === "active").length
  const onboardingCount = people.filter((p) => p.status === "onboarding").length

  return (
    <div className="space-y-6">
      <PageHeader title="People & HR" description="Manage your workforce, onboarding, and HR operations.">
        <Button asChild>
          <Link href="/people/directory">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Person
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total People" value={people.length} icon={Users} />
        <StatCard title="Active" value={activeCount} icon={UserCheck} />
        <StatCard title="Onboarding" value={onboardingCount} icon={UserPlus} />
        <StatCard title="Offboarding" value={0} icon={UserMinus} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/people/directory">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Directory
              </CardTitle>
              <CardDescription>View and manage all employees</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{people.length}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/people/onboarding">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Onboarding
              </CardTitle>
              <CardDescription>New hire checklists and tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="info">{onboardingCount} in progress</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/people/time-off">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Time Off
              </CardTitle>
              <CardDescription>Leave requests and calendar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">2 pending</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Lisa Martinez started onboarding</p>
                <p className="text-xs text-muted-foreground">Software Engineer, Engineering</p>
              </div>
              <span className="text-xs text-muted-foreground">2 hours ago</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Employee handbook updated</p>
                <p className="text-xs text-muted-foreground">Version 2.1 published</p>
              </div>
              <span className="text-xs text-muted-foreground">1 day ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
