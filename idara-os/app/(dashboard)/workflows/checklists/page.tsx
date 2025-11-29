import { ListChecks, MoreHorizontal, Play, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { checklists } from "@/lib/seed-data"

const checklistInstances = [
  {
    id: "inst-1",
    checklistId: "CHK-001",
    title: "Employee Onboarding",
    subject: "Lisa Martinez",
    progress: 3,
    total: 12,
    status: "in-progress",
  },
]

export default function ChecklistsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Checklists" description="Create and manage reusable process checklists.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Checklist
        </Button>
      </PageHeader>

      {checklistInstances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Active Instances
            </CardTitle>
            <CardDescription>Checklists currently in progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklistInstances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ListChecks className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{instance.title}</p>
                    <p className="text-sm text-muted-foreground">For: {instance.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {instance.progress}/{instance.total} steps
                    </p>
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(instance.progress / instance.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <Button size="sm">Continue</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Checklist Templates</CardTitle>
          <CardDescription>Reusable checklists for common processes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklists.map((checklist) => (
            <div
              key={checklist.id}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{checklist.title}</p>
                  <p className="text-sm text-muted-foreground">{checklist.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant="default">{checklist.steps} steps</StatusBadge>
                <StatusBadge variant="info">{checklist.category}</StatusBadge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Play className="mr-2 h-4 w-4" />
                      Run Checklist
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit Template</DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
