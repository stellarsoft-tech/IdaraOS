"use client"

import Link from "next/link"
import { ArrowRight, BookOpen, CheckCircle, Clock, FileCheck, FileText, Plus, ScrollText, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useDocuments, useMyDocuments, useRolloutStats } from "@/lib/api/docs"

export default function DocsOverviewPage() {
  const { data: documentsData, isLoading: docsLoading } = useDocuments()
  const { data: myDocsData, isLoading: myDocsLoading } = useMyDocuments()
  const { data: rolloutStatsData, isLoading: statsLoading } = useRolloutStats()
  
  const documents = documentsData?.data || []
  const myDocs = myDocsData?.data || []
  const myDocsStats = myDocsData?.stats || { total: 0, pending: 0, overdue: 0 }
  const rolloutStats = rolloutStatsData?.data
  
  const publishedCount = documents.filter((d) => d.status === "published").length
  const inReviewCount = documents.filter((d) => d.status === "in_review").length
  const draftCount = documents.filter((d) => d.status === "draft").length
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentation"
        description="Manage organizational policies, procedures, and documentation."
      >
        <Button asChild>
          <Link href="/docs/documents/new">
            <Plus className="mr-2 h-4 w-4" />
            New Document
          </Link>
        </Button>
      </PageHeader>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={docsLoading ? "-" : documents.length}
          icon={FileText}
        />
        <StatCard
          title="Published"
          value={docsLoading ? "-" : publishedCount}
          icon={CheckCircle}
        />
        <StatCard
          title="In Review"
          value={docsLoading ? "-" : inReviewCount}
          icon={Clock}
        />
        <StatCard
          title="My Pending"
          value={myDocsLoading ? "-" : myDocsStats.pending}
          icon={BookOpen}
          trend={myDocsStats.overdue > 0 ? { value: -myDocsStats.overdue, label: "overdue" } : undefined}
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/docs/documents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document Library
              </CardTitle>
              <CardDescription>All organizational documents</CardDescription>
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
          <Link href="/docs/policies">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Policies
              </CardTitle>
              <CardDescription>Organizational policies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {documents.filter((d) => d.category === "policy").length} policies
                </span>
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
                <span className="text-sm text-muted-foreground">
                  {documents.filter((d) => d.category === "procedure").length} procedures
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/docs/my-documents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                My Documents
              </CardTitle>
              <CardDescription>Documents assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {myDocsStats.pending > 0 ? (
                  <StatusBadge variant="warning">{myDocsStats.pending} pending</StatusBadge>
                ) : (
                  <StatusBadge variant="success">All caught up</StatusBadge>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        {/* Rollout Progress Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Rollout Progress
            </CardTitle>
            <CardDescription>Organization-wide acknowledgment status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            ) : rolloutStats && rolloutStats.totalAcknowledgments > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {rolloutStats.activeRollouts} active rollouts
                  </span>
                  <span className="font-medium">
                    {rolloutStats.completionPercentage}% complete
                  </span>
                </div>
                <Progress value={rolloutStats.completionPercentage} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rolloutStats.completed} / {rolloutStats.totalAcknowledgments} acknowledged</span>
                  {rolloutStats.overdue > 0 && (
                    <StatusBadge variant="danger">{rolloutStats.overdue} overdue</StatusBadge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active rollouts</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Pending Documents */}
      {myDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Documents Requiring Your Attention
            </CardTitle>
            <CardDescription>
              Documents you need to review or acknowledge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myDocs.slice(0, 5).map((doc) => (
              <div
                key={doc.acknowledgmentId}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{doc.documentTitle}</p>
                    {doc.isOverdue && (
                      <StatusBadge variant="danger">Overdue</StatusBadge>
                    )}
                    {doc.requirement === "required_with_signature" && (
                      <StatusBadge variant="warning">Signature Required</StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.documentCategory} • v{doc.documentVersion}
                    {doc.dueDate && ` • Due: ${new Date(doc.dueDate).toLocaleDateString()}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/docs/view/${doc.documentSlug}`}>
                    Review
                  </Link>
                </Button>
              </div>
            ))}
            {myDocs.length > 5 && (
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/docs/my-documents">
                  View all {myDocs.length} documents
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recently Updated
          </CardTitle>
          <CardDescription>Latest document changes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.slice(0, 5).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  v{doc.currentVersion} • {doc.category}
                  {doc.owner && ` • ${doc.owner.name}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge
                  variant={
                    doc.status === "published"
                      ? "success"
                      : doc.status === "in_review"
                      ? "warning"
                      : "default"
                  }
                >
                  {doc.status.replace("_", " ")}
                </StatusBadge>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/docs/documents/${doc.slug}`}>View</Link>
                </Button>
              </div>
            </div>
          ))}
          {documents.length === 0 && !docsLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents yet. Create your first document to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
