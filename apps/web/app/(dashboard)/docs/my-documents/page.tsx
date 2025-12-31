"use client"

import * as React from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  PenLine,
  ScrollText,
  Users,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { useMyDocuments } from "@/lib/api/docs"
import type { PendingDocument } from "@/lib/docs/types"

// Category labels and icons
const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  policy: { label: "Policy", icon: ScrollText },
  procedure: { label: "Procedure", icon: FileText },
  guideline: { label: "Guideline", icon: FileText },
  manual: { label: "Manual", icon: BookOpen },
  template: { label: "Template", icon: FileText },
  training: { label: "Training", icon: Users },
  general: { label: "General", icon: FileText },
}

// Requirement labels
const requirementLabels: Record<string, string> = {
  optional: "Optional",
  required: "Required",
  required_with_signature: "Signature Required",
}

// Status config
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "Pending", variant: "secondary" },
  viewed: { label: "Viewed", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  acknowledged: { label: "Acknowledged", variant: "outline", className: "border-green-500 text-green-600" },
  signed: { label: "Signed", variant: "outline", className: "border-green-500 text-green-600 bg-green-500/10" },
}

// Format date helper
function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}

// Column definitions for the table
const columns: ColumnDef<PendingDocument>[] = [
  {
    id: "document",
    accessorKey: "documentTitle",
    header: "Document",
    cell: ({ row }) => {
      const doc = row.original
      const CategoryIcon = categoryConfig[doc.documentCategory]?.icon || FileText
      
      return (
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
            doc.isOverdue
              ? "bg-red-500/20"
              : doc.acknowledgmentStatus === "pending"
              ? "bg-yellow-500/20"
              : doc.acknowledgmentStatus === "viewed"
              ? "bg-blue-500/20"
              : "bg-green-500/20"
          }`}>
            <CategoryIcon className={`h-4 w-4 ${
              doc.isOverdue
                ? "text-red-600"
                : doc.acknowledgmentStatus === "pending"
                ? "text-yellow-600"
                : doc.acknowledgmentStatus === "viewed"
                ? "text-blue-600"
                : "text-green-600"
            }`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{doc.documentTitle}</span>
              {doc.isOverdue && (
                <Badge variant="destructive" className="text-xs shrink-0">Overdue</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{categoryConfig[doc.documentCategory]?.label || doc.documentCategory}</span>
              <span>•</span>
              <span>v{doc.documentVersion}</span>
            </div>
          </div>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    id: "rollout",
    accessorKey: "rolloutName",
    header: "Rollout",
    cell: ({ row }) => {
      const doc = row.original
      const rolloutName = doc.rolloutName || `Rollout`
      
      return (
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate max-w-[150px]">{rolloutName}</span>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    id: "requirement",
    accessorKey: "requirement",
    header: "Type",
    cell: ({ row }) => {
      const requirement = row.getValue("requirement") as string
      const needsSignature = requirement === "required_with_signature"
      
      return (
        <Badge 
          variant={needsSignature ? "default" : requirement === "required" ? "secondary" : "outline"}
          className="whitespace-nowrap"
        >
          {needsSignature && <PenLine className="mr-1 h-3 w-3" />}
          {requirementLabels[requirement] || requirement}
        </Badge>
      )
    },
    enableSorting: true,
  },
  {
    id: "dueDate",
    accessorKey: "dueDate",
    header: "Due Date",
    cell: ({ row }) => {
      const doc = row.original
      const dueDate = doc.dueDate
      
      if (!dueDate) {
        return <span className="text-muted-foreground">No deadline</span>
      }
      
      return (
        <div className="flex items-center gap-2">
          <Calendar className={`h-3.5 w-3.5 ${doc.isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
          <span className={doc.isOverdue ? "text-red-500 font-medium" : ""}>
            {formatDate(dueDate)}
          </span>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    id: "status",
    accessorKey: "acknowledgmentStatus",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("acknowledgmentStatus") as string
      const config = statusConfig[status]
      
      return (
        <Badge 
          variant={config?.variant ?? "secondary"} 
          className={config?.className}
        >
          {config?.label ?? status}
        </Badge>
      )
    },
    enableSorting: true,
  },
  {
    id: "completedAt",
    accessorKey: "acknowledgedAt",
    header: "Completed",
    cell: ({ row }) => {
      const doc = row.original
      const completedAt = doc.signedAt || doc.acknowledgedAt
      
      if (!completedAt) {
        return <span className="text-muted-foreground">—</span>
      }
      
      return (
        <Tooltip>
          <TooltipTrigger>
            <span className="text-sm">{formatDate(completedAt)}</span>
          </TooltipTrigger>
          <TooltipContent>
            {doc.signedAt ? "Signed" : "Acknowledged"} on {formatDate(completedAt)}
          </TooltipContent>
        </Tooltip>
      )
    },
    enableSorting: true,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const doc = row.original
      const isPending = ["pending", "viewed"].includes(doc.acknowledgmentStatus)
      const needsSignature = doc.requirement === "required_with_signature" && doc.acknowledgmentStatus !== "signed"
      
      return (
        <div className="flex justify-end">
          <Button variant={isPending ? "default" : "outline"} size="sm" asChild>
            <Link href={`/docs/view/${doc.documentSlug}`}>
              {isPending ? (
                needsSignature ? (
                  <>
                    <PenLine className="mr-1.5 h-3.5 w-3.5" />
                    Sign
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Review
                  </>
                )
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View
                </>
              )}
            </Link>
          </Button>
        </div>
      )
    },
  },
]

// Columns for pending table (hide completedAt)
const pendingColumns = columns.filter((col) => col.id !== "completedAt")

// Columns for completed table
const completedColumns = columns

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
  
  const pendingDocs = documents.filter((d) => ["pending", "viewed"].includes(d.acknowledgmentStatus))
  const completedDocs = documents.filter((d) => ["acknowledged", "signed"].includes(d.acknowledgmentStatus))
  const overdueDocs = documents.filter((d) => d.isOverdue)
  
  // Status options for faceted filter
  const statusOptions = [
    { label: "Pending", value: "pending" },
    { label: "Viewed", value: "viewed" },
    { label: "Acknowledged", value: "acknowledged" },
    { label: "Signed", value: "signed" },
  ]
  
  const requirementOptions = [
    { label: "Optional", value: "optional" },
    { label: "Required", value: "required" },
    { label: "Signature Required", value: "required_with_signature" },
  ]
  
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
              {overdueDocs.length} Overdue Document{overdueDocs.length > 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              These documents are past their due date and require immediate attention.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {/* Document Tables */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            Pending ({pendingDocs.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
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
              <DataTable
                columns={pendingColumns}
                data={pendingDocs}
                loading={isLoading}
                searchKey="documentTitle"
                searchPlaceholder="Search documents..."
                facetedFilters={{
                  acknowledgmentStatus: {
                    type: "enum",
                    options: statusOptions.slice(0, 2), // pending, viewed only
                  },
                  requirement: {
                    type: "enum",
                    options: requirementOptions,
                  },
                }}
                enableSorting
                enableColumnFilters
                emptyState={
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                    <p className="font-medium text-lg">All caught up!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You have no pending documents to review.
                    </p>
                  </div>
                }
              />
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
              <DataTable
                columns={completedColumns}
                data={completedDocs}
                loading={isLoading}
                searchKey="documentTitle"
                searchPlaceholder="Search documents..."
                facetedFilters={{
                  acknowledgmentStatus: {
                    type: "enum",
                    options: statusOptions.slice(2), // acknowledged, signed only
                  },
                }}
                enableSorting
                enableColumnFilters
                enableExport
                emptyState={
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-medium text-lg">No completed documents</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Documents you acknowledge will appear here.
                    </p>
                  </div>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
