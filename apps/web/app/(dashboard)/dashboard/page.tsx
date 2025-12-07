import { AlertTriangle, CheckCircle2, Clock, FileText, HardDrive, RefreshCw, Shield, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"

const recentActivity = [
  { id: 1, action: "New employee onboarded", subject: "Lisa Martinez", time: "2 hours ago", type: "success" },
  { id: 2, action: "Risk assessment updated", subject: "RSK-001", time: "4 hours ago", type: "warning" },
  { id: 3, action: "Policy published", subject: "Remote Work Policy v2.0", time: "1 day ago", type: "info" },
  { id: 4, action: "Audit scheduled", subject: "Q4 Internal Security Review", time: "2 days ago", type: "info" },
  { id: 5, action: "Asset assigned", subject: "LAP-003 to Michael Brown", time: "3 days ago", type: "success" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Welcome back! Here's an overview of your organization." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total People" 
          value={6} 
          description="1 onboarding" 
          icon={Users}
          iconColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard 
          title="Active Assets" 
          value={10} 
          description="8 assigned, 1 available" 
          icon={HardDrive}
          iconColor="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
        <StatCard 
          title="Open Risks" 
          value={3} 
          description="2 high priority" 
          icon={AlertTriangle}
          iconColor="bg-red-500/10 text-red-600 dark:text-red-400"
        />
        <StatCard 
          title="Active Policies" 
          value={6} 
          description="1 pending review" 
          icon={FileText}
          iconColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Compliance Status
            </CardTitle>
            <CardDescription>Framework coverage overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">ISO 27001</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[85%] bg-green-500 rounded-full" />
                </div>
                <span className="text-sm font-medium">85%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">SOC 2</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[72%] bg-yellow-500 rounded-full" />
                </div>
                <span className="text-sm font-medium">72%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Controls Effective</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[60%] bg-blue-500 rounded-full" />
                </div>
                <span className="text-sm font-medium">6/10</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Approvals
            </CardTitle>
            <CardDescription>Items awaiting your review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Data Classification Policy</p>
                <p className="text-xs text-muted-foreground">Submitted by Michael Brown</p>
              </div>
              <StatusBadge variant="warning">Review</StatusBadge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Vendor Management Policy</p>
                <p className="text-xs text-muted-foreground">Submitted by James Wilson</p>
              </div>
              <StatusBadge variant="info">Draft</StatusBadge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Upcoming Renewals
            </CardTitle>
            <CardDescription>Next 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Dell XPS 15 Warranty</p>
                <p className="text-xs text-muted-foreground">Asset <span className="font-mono">LAP-005</span></p>
              </div>
              <StatusBadge variant="danger">Expired</StatusBadge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Data Classification Policy</p>
                <p className="text-xs text-muted-foreground">Review due Jan 1</p>
              </div>
              <StatusBadge variant="warning">30 days</StatusBadge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates across your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    item.type === "success"
                      ? "bg-green-100 text-green-600"
                      : item.type === "warning"
                        ? "bg-yellow-100 text-yellow-600"
                        : "bg-blue-100 text-blue-600"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.subject}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
