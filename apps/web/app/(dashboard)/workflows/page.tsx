import Link from "next/link"
import { ArrowRight, CheckSquare, Clock, ListChecks, Play, Plus, Workflow, Zap } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { checklists } from "@/lib/seed-data"

export default function WorkflowsOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Workflows" description="Manage tasks, automations, and reusable checklists.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Workflows" value={3} icon={Play} />
        <StatCard title="Checklists" value={checklists.length} icon={ListChecks} />
        <StatCard title="Automations" value={5} icon={Zap} />
        <StatCard title="Tasks Due" value={8} icon={Clock} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/workflows/tasks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Tasks & Automations
              </CardTitle>
              <CardDescription>Rules, triggers, and automated workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge variant="success">5 active</StatusBadge>
                  <StatusBadge variant="info">8 tasks</StatusBadge>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/workflows/checklists">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Checklists
              </CardTitle>
              <CardDescription>Reusable process checklists</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{checklists.length} templates</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckSquare className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Employee Onboarding checklist completed</p>
              <p className="text-xs text-muted-foreground">Lisa Martinez • All 12 steps done</p>
            </div>
            <span className="text-xs text-muted-foreground">2 hours ago</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Access Review automation triggered</p>
              <p className="text-xs text-muted-foreground">Quarterly review started</p>
            </div>
            <span className="text-xs text-muted-foreground">1 day ago</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
