import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  FileCheck,
  FileText,
  Shield,
  Target,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { controls, risks } from "@/lib/seed-data"

export default function ISMSPage() {
  const ismsRisks = risks.filter((r) => r.framework === "ISMS")
  const openRisks = ismsRisks.filter((r) => r.status === "open").length
  const effectiveControls = controls.filter((c) => c.status === "effective").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="ISMS (ISO/IEC 27001)"
        description="Information Security Management System overview and management."
      >
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Open Risks" value={openRisks} icon={AlertTriangle} />
        <StatCard title="Control Coverage" value="85%" icon={Shield} />
        <StatCard title="Audit Findings" value={3} icon={ClipboardList} />
        <StatCard title="Evidence Items" value={54} icon={FileCheck} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/risks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Register
              </CardTitle>
              <CardDescription>ISMS-specific risks and treatments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">{openRisks} open risks</StatusBadge>
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
                Controls
              </CardTitle>
              <CardDescription>Annex A controls implementation</CardDescription>
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

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/soa">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Statement of Applicability
              </CardTitle>
              <CardDescription>SoA document and justifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="info">114 controls</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/evidence">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Evidence Store
              </CardTitle>
              <CardDescription>Audit evidence and documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">54 items</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/audits">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Audits
              </CardTitle>
              <CardDescription>Internal and external audits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="info">1 in progress</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/objectives">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Objectives & Plan
              </CardTitle>
              <CardDescription>Yearly ISMS objectives</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">5 objectives</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Recent ISMS Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">ISO 27001 Certification Audit completed</p>
                <p className="text-xs text-muted-foreground">3 findings identified</p>
              </div>
              <span className="text-xs text-muted-foreground">Jun 15, 2024</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Information Security Policy updated</p>
                <p className="text-xs text-muted-foreground">Version 3.0 published</p>
              </div>
              <span className="text-xs text-muted-foreground">Jun 1, 2024</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">New risk identified: Third-party vendor breach</p>
                <p className="text-xs text-muted-foreground">Risk level: High</p>
              </div>
              <span className="text-xs text-muted-foreground">May 20, 2024</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
