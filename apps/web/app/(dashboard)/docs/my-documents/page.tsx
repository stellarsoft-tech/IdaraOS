"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  PenLine,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useMyDocuments } from "@/lib/api/docs"
import type { PendingDocument } from "@/lib/docs/types"

const categoryLabels: Record<string, string> = {
  policy: "Policy",
  procedure: "Procedure",
  guideline: "Guideline",
  manual: "Manual",
  template: "Template",
  training: "Training",
  general: "General",
}

export default function MyDocumentsPage() {
  const { data, isLoading } = useMyDocuments({ includeOptional: true, status: "all" })
  
  const documents = data?.data || []
  const stats = data?.stats || {
    total: 0,
    pending: 0,
    viewed: 0,
    acknowledged: 0,
    signed: 0,
    overdue: 0,
  }
  
  const pendingDocs = documents.filter((d) => d.acknowledgmentStatus === "pending")
  const viewedDocs = documents.filter((d) => d.acknowledgmentStatus === "viewed")
  const completedDocs = documents.filter((d) => ["acknowledged", "signed"].includes(d.acknowledgmentStatus))
  const overdueDocs = documents.filter((d) => d.isOverdue)
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Documents"
        description="Documents assigned to you for review and acknowledgment."
      />
      
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Assigned"
          value={isLoading ? "-" : stats.total}
          icon={BookOpen}
        />
        <StatCard
          title="Pending Review"
          value={isLoading ? "-" : stats.pending + stats.viewed}
          icon={Clock}
          trend={stats.overdue > 0 ? { value: -stats.overdue, label: "overdue" } : undefined}
        />
        <StatCard
          title="Completed"
          value={isLoading ? "-" : stats.acknowledged + stats.signed}
          icon={CheckCircle}
        />
        <StatCard
          title="Overdue"
          value={isLoading ? "-" : stats.overdue}
          icon={AlertCircle}
        />
      </div>
      
      {/* Overdue Alert */}
      {overdueDocs.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              Overdue Documents
            </CardTitle>
            <CardDescription>
              These documents are past their due date and require immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueDocs.map((doc) => (
              <DocumentRow key={doc.acknowledgmentId} document={doc} />
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Document Lists */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-1 h-3 w-3" />
            Pending ({pendingDocs.length + viewedDocs.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed ({completedDocs.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Review</CardTitle>
              <CardDescription>
                Documents waiting for your acknowledgment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingDocs.length === 0 && viewedDocs.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title="All caught up!"
                  description="You have no pending documents to review."
                />
              ) : (
                <div className="space-y-2">
                  {/* Not yet viewed */}
                  {pendingDocs.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Not yet viewed
                      </p>
                      {pendingDocs.map((doc) => (
                        <DocumentRow key={doc.acknowledgmentId} document={doc} />
                      ))}
                    </div>
                  )}
                  
                  {/* Viewed but not acknowledged */}
                  {viewedDocs.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Viewed - awaiting acknowledgment
                      </p>
                      {viewedDocs.map((doc) => (
                        <DocumentRow key={doc.acknowledgmentId} document={doc} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed</CardTitle>
              <CardDescription>
                Documents you have acknowledged or signed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedDocs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No completed documents"
                  description="Documents you acknowledge will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {completedDocs.map((doc) => (
                    <DocumentRow key={doc.acknowledgmentId} document={doc} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DocumentRow({ document: doc }: { document: PendingDocument }) {
  const isPending = ["pending", "viewed"].includes(doc.acknowledgmentStatus)
  const needsSignature = doc.requirement === "required_with_signature" && doc.acknowledgmentStatus !== "signed"
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
          doc.isOverdue
            ? "bg-red-500/20"
            : isPending
            ? "bg-yellow-500/20"
            : "bg-green-500/20"
        }`}>
          <FileText className={`h-4 w-4 ${
            doc.isOverdue
              ? "text-red-600"
              : isPending
              ? "text-yellow-600"
              : "text-green-600"
          }`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{doc.documentTitle}</p>
            {doc.isOverdue && (
              <Badge variant="destructive" className="text-xs">Overdue</Badge>
            )}
            {needsSignature && (
              <Badge variant="outline" className="text-xs">Signature Required</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {categoryLabels[doc.documentCategory] || doc.documentCategory} • v{doc.documentVersion}
            {doc.dueDate && ` • Due: ${new Date(doc.dueDate).toLocaleDateString()}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge
          variant={
            doc.acknowledgmentStatus === "signed"
              ? "success"
              : doc.acknowledgmentStatus === "acknowledged"
              ? "success"
              : doc.acknowledgmentStatus === "viewed"
              ? "warning"
              : "default"
          }
        >
          {doc.acknowledgmentStatus}
        </StatusBadge>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/docs/view/${doc.documentSlug}`}>
            {isPending ? (
              needsSignature ? (
                <>
                  <PenLine className="mr-1 h-3 w-3" />
                  Sign
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-3 w-3" />
                  Review
                </>
              )
            ) : (
              <>
                <Eye className="mr-1 h-3 w-3" />
                View
              </>
            )}
          </Link>
        </Button>
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

