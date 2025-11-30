import Link from "next/link"
import { ArrowRight, CheckCircle, Clock, FileCheck, FileText, Pen, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { policies } from "@/lib/seed-data"

export default function DocsOverviewPage() {
  const publishedCount = policies.filter((p) => p.status === "published").length
  const inReviewCount = policies.filter((p) => p.status === "in-review").length
  const draftCount = policies.filter((p) => p.status === "draft").length

  return (
    <div className="space-y-6">
      <PageHeader title="Docs & Policies" description="Manage organizational policies, procedures, and documentation.">
        <Button asChild>
          <Link href="/docs/policies">
            <Plus className="mr-2 h-4 w-4" />
            New Policy
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Policies" value={policies.length} icon={FileText} />
        <StatCard title="Published" value={publishedCount} icon={CheckCircle} />
        <StatCard title="In Review" value={inReviewCount} icon={Clock} />
        <StatCard title="Drafts" value={draftCount} icon={Pen} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/docs/policies">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Policy Library
              </CardTitle>
              <CardDescription>Versioned policy documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="success">{publishedCount} published</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/docs/procedures">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Procedures / SOPs
              </CardTitle>
              <CardDescription>Standard operating procedures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">8 procedures</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/docs/attestations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Attestations
              </CardTitle>
              <CardDescription>Policy acknowledgements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">3 pending</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Upcoming Reviews
          </CardTitle>
          <CardDescription>Policies due for review in the next 90 days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {policies
            .filter((p) => new Date(p.nextReview) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
            .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime())
            .slice(0, 4)
            .map((policy) => (
              <div key={policy.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{policy.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Version {policy.version} • Owner: {policy.owner}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Review: {new Date(policy.nextReview).toLocaleDateString()}
                  </span>
                  <Button variant="outline" size="sm">
                    Review
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
