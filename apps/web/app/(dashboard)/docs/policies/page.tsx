import { Edit, Eye, FileText, MoreHorizontal, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { policies } from "@/lib/seed-data"

export default function PoliciesPage() {
  const groupedPolicies = {
    draft: policies.filter((p) => p.status === "draft"),
    "in-review": policies.filter((p) => p.status === "in-review"),
    published: policies.filter((p) => p.status === "published"),
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Policy Library" description="Manage and publish organizational policies with version control.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Draft</span>
              <StatusBadge variant="default">{groupedPolicies.draft.length}</StatusBadge>
            </CardTitle>
            <CardDescription>Policies being created</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedPolicies.draft.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
            {groupedPolicies.draft.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No drafts</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>In Review</span>
              <StatusBadge variant="warning">{groupedPolicies["in-review"].length}</StatusBadge>
            </CardTitle>
            <CardDescription>Awaiting approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedPolicies["in-review"].map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
            {groupedPolicies["in-review"].length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">None in review</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Published</span>
              <StatusBadge variant="success">{groupedPolicies.published.length}</StatusBadge>
            </CardTitle>
            <CardDescription>Active policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedPolicies.published.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PolicyCard({ policy }: { policy: (typeof policies)[0] }) {
  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-sm">{policy.title}</p>
            <p className="text-xs text-muted-foreground">v{policy.version}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{policy.owner}</span>
        <span>•</span>
        <span>{policy.category}</span>
      </div>
    </div>
  )
}
