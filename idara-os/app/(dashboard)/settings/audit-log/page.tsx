import { Activity, Download, Filter, Search } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const auditEvents = [
  {
    id: 1,
    action: "user.login",
    actor: "hamza@idaraos.com",
    target: "-",
    timestamp: "2024-11-30 10:23:45",
    ip: "192.168.1.100",
  },
  {
    id: 2,
    action: "policy.update",
    actor: "michael@idaraos.com",
    target: "Information Security Policy",
    timestamp: "2024-11-30 09:15:32",
    ip: "192.168.1.101",
  },
  {
    id: 3,
    action: "risk.create",
    actor: "michael@idaraos.com",
    target: "RSK-006",
    timestamp: "2024-11-29 16:45:00",
    ip: "192.168.1.101",
  },
  {
    id: 4,
    action: "asset.assign",
    actor: "emily@idaraos.com",
    target: "LAP-003",
    timestamp: "2024-11-29 14:30:00",
    ip: "192.168.1.102",
  },
  {
    id: 5,
    action: "user.create",
    actor: "emily@idaraos.com",
    target: "lisa@idaraos.com",
    timestamp: "2024-11-28 11:00:00",
    ip: "192.168.1.102",
  },
  {
    id: 6,
    action: "control.update",
    actor: "sarah@idaraos.com",
    target: "CTL-005",
    timestamp: "2024-11-28 09:30:00",
    ip: "192.168.1.103",
  },
  {
    id: 7,
    action: "audit.schedule",
    actor: "michael@idaraos.com",
    target: "AUD-003",
    timestamp: "2024-11-27 15:00:00",
    ip: "192.168.1.101",
  },
  {
    id: 8,
    action: "user.login",
    actor: "sarah@idaraos.com",
    target: "-",
    timestamp: "2024-11-27 08:45:00",
    ip: "192.168.1.103",
  },
]

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="View and export system activity logs for compliance and security.">
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </PageHeader>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search audit log..." className="pl-8" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>System events and user actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {auditEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                <div className="flex items-center gap-4">
                  <StatusBadge
                    variant={
                      event.action.startsWith("user")
                        ? "info"
                        : event.action.startsWith("policy") || event.action.startsWith("control")
                          ? "purple"
                          : event.action.startsWith("risk")
                            ? "warning"
                            : "default"
                    }
                  >
                    {event.action}
                  </StatusBadge>
                  <div>
                    <p className="text-sm">{event.actor}</p>
                    <p className="text-xs text-muted-foreground">Target: {event.target}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                  <p className="text-xs text-muted-foreground">IP: {event.ip}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
