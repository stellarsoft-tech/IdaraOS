import Link from "next/link"
import { AlertTriangle, ArrowRight, ClipboardList, FileCheck, Lock, Shield, Target } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { audits, controls, risks } from "@/lib/seed-data"

export default function SecurityOverviewPage() {
  const openRisks = risks.filter((r) => r.status === "open").length
  const highRisks = risks.filter((r) => r.level === "high" || r.level === "critical").length
  const effectiveControls = controls.filter((c) => c.status === "effective").length
  const activeAudits = audits.filter((a) => a.status === "in-progress").length

  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Manage your organization's security posture and compliance.">
        <Button asChild>
          <Link href="/security/risks">
            <AlertTriangle className="mr-2 h-4 w-4" />
            View Risks
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Risks"
          value={openRisks}
          description={`${highRisks} high priority`}
          icon={AlertTriangle}
        />
        <StatCard
          title="Controls"
          value={controls.length}
          description={`${effectiveControls} effective`}
          icon={Shield}
        />
        <StatCard title="Active Audits" value={activeAudits} icon={ClipboardList} />
        <StatCard title="Evidence Items" value={54} icon={FileCheck} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/frameworks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Frameworks (IMS)
              </CardTitle>
              <CardDescription>ISO 27001, SOC 2, and more</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge variant="success">ISO 27001</StatusBadge>
                  <StatusBadge variant="info">SOC 2</StatusBadge>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/risks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Register
              </CardTitle>
              <CardDescription>Identify and manage security risks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">{openRisks} open</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/controls">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Controls Library
              </CardTitle>
              <CardDescription>Security controls and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="success">
                  {effectiveControls}/{controls.length} effective
                </StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Compliance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">ISO 27001</span>
                <span className="text-sm font-medium">85%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[85%] bg-green-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">SOC 2 Type II</span>
                <span className="text-sm font-medium">72%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[72%] bg-yellow-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Control Coverage</span>
                <span className="text-sm font-medium">
                  {effectiveControls}/{controls.length}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(effectiveControls / controls.length) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Risk Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.slice(0, 4).map((risk) => (
              <div key={risk.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{risk.id}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{risk.title}</p>
                </div>
                <StatusBadge
                  variant={
                    risk.level === "critical" || risk.level === "high"
                      ? "danger"
                      : risk.level === "medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {risk.level}
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
