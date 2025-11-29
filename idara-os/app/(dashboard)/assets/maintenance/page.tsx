import { AlertTriangle, CheckCircle, Clock, Plus, Wrench } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { assets } from "@/lib/seed-data"

const maintenanceTickets = [
  {
    id: 1,
    asset: "LAP-005",
    model: "Dell XPS 15",
    issue: "Screen flickering",
    status: "in-progress",
    priority: "high",
    created: "2024-11-25",
  },
  {
    id: 2,
    asset: "MON-003",
    model: 'Dell 24"',
    issue: "Dead pixels",
    status: "pending",
    priority: "medium",
    created: "2024-11-20",
  },
]

export default function MaintenancePage() {
  const inMaintenanceCount = assets.filter((a) => a.status === "maintenance").length

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Manage maintenance schedules and repair tickets.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="In Maintenance" value={inMaintenanceCount} icon={Wrench} />
        <StatCard title="Open Tickets" value={maintenanceTickets.length} icon={Clock} />
        <StatCard title="Resolved (Month)" value={3} icon={CheckCircle} />
        <StatCard title="Overdue" value={0} icon={AlertTriangle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Tickets</CardTitle>
          <CardDescription>Active and pending maintenance requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {maintenanceTickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {ticket.asset} - {ticket.model}
                    </p>
                    <p className="text-sm text-muted-foreground">{ticket.issue}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(ticket.created).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge variant={ticket.priority === "high" ? "danger" : "warning"}>
                    {ticket.priority}
                  </StatusBadge>
                  <StatusBadge variant={ticket.status === "in-progress" ? "info" : "default"}>
                    {ticket.status}
                  </StatusBadge>
                </div>
              </div>
            ))}

            {maintenanceTickets.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                <p className="text-sm text-muted-foreground">No active maintenance tickets.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
