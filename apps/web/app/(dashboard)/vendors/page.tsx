import Link from "next/link"
import { ArrowRight, Building, ClipboardCheck, FileText, Plus, ShoppingCart } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const vendors = [
  {
    id: 1,
    name: "AWS",
    type: "Cloud Infrastructure",
    status: "active",
    riskLevel: "low",
    lastAssessment: "2024-10-15",
  },
  { id: 2, name: "Slack", type: "Communication", status: "active", riskLevel: "low", lastAssessment: "2024-09-20" },
  { id: 3, name: "Salesforce", type: "CRM", status: "active", riskLevel: "medium", lastAssessment: "2024-08-01" },
  { id: 4, name: "Stripe", type: "Payments", status: "pending", riskLevel: "high", lastAssessment: null },
]

export default function VendorsOverviewPage() {
  const activeVendors = vendors.filter((v) => v.status === "active").length
  const pendingAssessments = vendors.filter((v) => !v.lastAssessment).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors & Procurement"
        description="Manage vendor relationships, contracts, and security assessments."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Vendor
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Vendors" value={vendors.length} icon={Building} />
        <StatCard title="Active" value={activeVendors} icon={ShoppingCart} />
        <StatCard title="Pending Assessment" value={pendingAssessments} icon={ClipboardCheck} />
        <StatCard title="Active Contracts" value={8} icon={FileText} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/vendors/directory">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Vendor Directory
              </CardTitle>
              <CardDescription>All vendors and suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{vendors.length}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/vendors/contracts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Contracts
              </CardTitle>
              <CardDescription>Agreements and renewals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">2 expiring soon</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/vendors/assessments">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Assessments
              </CardTitle>
              <CardDescription>Security and compliance reviews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="info">{pendingAssessments} pending</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Vendors</CardTitle>
          <CardDescription>Recently added or updated vendors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Building className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{vendor.name}</p>
                  <p className="text-sm text-muted-foreground">{vendor.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge
                  variant={
                    vendor.riskLevel === "low" ? "success" : vendor.riskLevel === "medium" ? "warning" : "danger"
                  }
                >
                  {vendor.riskLevel} risk
                </StatusBadge>
                <StatusBadge variant={vendor.status === "active" ? "success" : "info"}>{vendor.status}</StatusBadge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
