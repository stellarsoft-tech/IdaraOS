import { Calendar, CheckCircle, Clock, ClipboardList, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { audits } from "@/lib/seed-data"

export default function AuditsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audits" description="Manage internal and external audits for compliance programs.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Audit
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{audits.filter((a) => a.status === "completed").length}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">In Progress</span>
          </div>
          <p className="text-2xl font-bold mt-1">{audits.filter((a) => a.status === "in-progress").length}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Planned</span>
          </div>
          <p className="text-2xl font-bold mt-1">{audits.filter((a) => a.status === "planned").length}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Audits</CardTitle>
          <CardDescription>Internal and external audit schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {audits.map((audit) => (
            <div
              key={audit.id}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{audit.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {audit.type.charAt(0).toUpperCase() + audit.type.slice(1)} Audit • {audit.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(audit.startDate).toLocaleDateString()} - {new Date(audit.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {audit.findings > 0 && <span className="text-sm text-muted-foreground">{audit.findings} findings</span>}
                <StatusBadge
                  variant={
                    audit.status === "completed" ? "success" : audit.status === "in-progress" ? "info" : "default"
                  }
                >
                  {audit.status === "in-progress"
                    ? "In Progress"
                    : audit.status.charAt(0).toUpperCase() + audit.status.slice(1)}
                </StatusBadge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
