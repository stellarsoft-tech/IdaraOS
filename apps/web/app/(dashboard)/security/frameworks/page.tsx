import Link from "next/link"
import { ArrowRight, CheckCircle, Clock, Lock, Shield } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const frameworks = [
  {
    id: "isms",
    name: "ISMS (ISO/IEC 27001)",
    description: "Information Security Management System",
    status: "active",
    coverage: 85,
    controls: 114,
    lastAudit: "2024-06-15",
  },
  {
    id: "soc-2",
    name: "SOC 2 Type II",
    description: "Service Organization Control 2",
    status: "in-progress",
    coverage: 72,
    controls: 64,
    lastAudit: null,
  },
  {
    id: "soc-1",
    name: "SOC 1 Type II",
    description: "Service Organization Control 1",
    status: "planned",
    coverage: 0,
    controls: 45,
    lastAudit: null,
  },
]

export default function FrameworksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Frameworks (IMS)"
        description="Manage your Information Management System frameworks and compliance programs."
      >
        <Button>
          <Lock className="mr-2 h-4 w-4" />
          Add Framework
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {frameworks.map((framework) => (
          <Card key={framework.id} className="hover:border-primary/50 transition-colors">
            <Link href={`/security/frameworks/${framework.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <StatusBadge
                    variant={
                      framework.status === "active"
                        ? "success"
                        : framework.status === "in-progress"
                          ? "info"
                          : "default"
                    }
                  >
                    {framework.status === "in-progress"
                      ? "In Progress"
                      : framework.status.charAt(0).toUpperCase() + framework.status.slice(1)}
                  </StatusBadge>
                </div>
                <CardTitle className="text-lg mt-4">{framework.name}</CardTitle>
                <CardDescription>{framework.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className="font-medium">{framework.coverage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          framework.coverage >= 80
                            ? "bg-green-500"
                            : framework.coverage >= 50
                              ? "bg-yellow-500"
                              : "bg-muted-foreground"
                        }`}
                        style={{ width: `${framework.coverage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      <span>{framework.controls} controls</span>
                    </div>
                    {framework.lastAudit && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Audited {new Date(framework.lastAudit).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
