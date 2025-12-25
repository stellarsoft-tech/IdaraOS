"use client"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings, Construction } from "lucide-react"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"

export default function WorkflowSettingsPage() {
  const canAccess = useCanAccess("workflows.settings")
  
  if (!canAccess) {
    return (
      <PageShell title="Settings">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view workflow settings." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Workflow Settings"
      description="Configure workflow module preferences and defaults."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Global Settings</CardTitle>
              <Badge variant="secondary">
                <Construction className="h-3 w-3 mr-1" />
                Coming Soon
              </Badge>
            </div>
            <CardDescription>
              Configure default workflow behaviors and notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Settings className="h-12 w-12 mb-4" />
              <h3 className="font-semibold mb-2">Settings Coming Soon</h3>
              <p className="text-sm max-w-md">
                Workflow settings will include notification preferences, default assignees, 
                automation rules, and integration configurations.
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module-Specific Workflows</CardTitle>
            <CardDescription>
              Configure which templates are used for specific activities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">People Onboarding</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure in People → Settings → Workflows
                  </p>
                </div>
                <Badge variant="outline">Configure in Module</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">People Offboarding</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure in People → Settings → Workflows
                  </p>
                </div>
                <Badge variant="outline">Configure in Module</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Asset Provisioning</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure in Assets → Settings → Workflows
                  </p>
                </div>
                <Badge variant="outline">Configure in Module</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

