import Link from "next/link"
import { ArrowRight, Building2, Key, Link2, Palette, ScrollText, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const settingsGroups = [
  {
    title: "Organization",
    items: [
      {
        title: "Organization Profile",
        description: "Company name, logo, and details",
        icon: Building2,
        href: "/settings",
      },
      {
        title: "Branding",
        description: "Colors, themes, and customization",
        icon: Palette,
        href: "/settings/branding",
      },
    ],
  },
  {
    title: "Access & Security",
    items: [
      { title: "Users & Access", description: "Manage users and permissions", icon: Users, href: "/settings/users" },
      { title: "Audit Log", description: "View system activity logs", icon: ScrollText, href: "/settings/audit-log" },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        title: "Integrations",
        description: "Connect third-party services",
        icon: Link2,
        href: "/settings/integrations",
      },
      { title: "API Keys", description: "Manage API access tokens", icon: Key, href: "/settings/api-keys" },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your organization settings and preferences." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">IdaraOS Demo</p>
              <p className="text-sm text-muted-foreground">Enterprise Plan</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">IdaraOS Demo</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Industry</p>
              <p className="font-medium">Technology</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Employees</p>
              <p className="font-medium">6</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timezone</p>
              <p className="font-medium">UTC-8 (Pacific)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {settingsGroups.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => (
              <Card key={item.href} className="hover:border-primary/50 transition-colors">
                <Link href={item.href}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
