import { Check, Link2, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const integrations = [
  { name: "Slack", description: "Team messaging and notifications", connected: true, category: "Communication" },
  { name: "Google Workspace", description: "SSO and directory sync", connected: true, category: "Identity" },
  { name: "Jira", description: "Issue and project tracking", connected: false, category: "Productivity" },
  { name: "GitHub", description: "Code repository integration", connected: true, category: "Development" },
  { name: "Okta", description: "Identity and access management", connected: false, category: "Identity" },
  { name: "AWS", description: "Cloud infrastructure", connected: false, category: "Infrastructure" },
]

export default function IntegrationsPage() {
  const connectedCount = integrations.filter((i) => i.connected).length

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect third-party services to enhance your workflow.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{connectedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrations.length - connectedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrations.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Integrations</CardTitle>
          <CardDescription>Available integrations and their connection status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <div key={integration.name} className="p-4 rounded-lg border">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {integration.connected && (
                    <StatusBadge variant="success">
                      <Check className="h-3 w-3 mr-1" />
                      Connected
                    </StatusBadge>
                  )}
                </div>
                <div className="mt-3">
                  <p className="font-medium">{integration.name}</p>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{integration.category}</span>
                  <Button variant={integration.connected ? "outline" : "default"} size="sm">
                    {integration.connected ? "Configure" : "Connect"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
