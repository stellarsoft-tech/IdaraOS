"use client"

import * as React from "react"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDocuments } from "@/lib/api/docs"
import type { DocumentWithRelations } from "@/lib/docs/types"

const statusConfig = {
  draft: { label: "Draft", variant: "default" as const },
  in_review: { label: "In Review", variant: "warning" as const },
  published: { label: "Published", variant: "success" as const },
  archived: { label: "Archived", variant: "danger" as const },
}

export default function ProceduresPage() {
  const { data, isLoading } = useDocuments({ category: "procedure" })
  
  const procedures = data?.data || []
  
  const groupedByStatus = {
    published: procedures.filter((d) => d.status === "published"),
    in_review: procedures.filter((d) => d.status === "in_review"),
    draft: procedures.filter((d) => d.status === "draft"),
  }
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Procedures / SOPs"
        description="Standard operating procedures and process documentation."
      >
        <Button asChild>
          <Link href="/docs/documents/new?category=procedure">
            <Plus className="mr-2 h-4 w-4" />
            New Procedure
          </Link>
        </Button>
      </PageHeader>
      
      {/* Published Procedures */}
      {groupedByStatus.published.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Published Procedures</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedByStatus.published.map((procedure) => (
              <ProcedureCard key={procedure.id} procedure={procedure} />
            ))}
          </div>
        </section>
      )}
      
      {/* In Review */}
      {groupedByStatus.in_review.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">In Review</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedByStatus.in_review.map((procedure) => (
              <ProcedureCard key={procedure.id} procedure={procedure} />
            ))}
          </div>
        </section>
      )}
      
      {/* Drafts */}
      {groupedByStatus.draft.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Drafts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedByStatus.draft.map((procedure) => (
              <ProcedureCard key={procedure.id} procedure={procedure} />
            ))}
          </div>
        </section>
      )}
      
      {/* Empty State */}
      {procedures.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No procedures yet</p>
            <p className="text-muted-foreground text-center mb-4">
              Create your first SOP to document organizational processes.
            </p>
            <Button asChild>
              <Link href="/docs/documents/new?category=procedure">
                <Plus className="mr-2 h-4 w-4" />
                Create Procedure
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProcedureCard({ procedure }: { procedure: DocumentWithRelations }) {
  const config = statusConfig[procedure.status]
  
  return (
    <Link href={`/docs/documents/${procedure.slug}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{procedure.title}</CardTitle>
            <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
          </div>
          <CardDescription className="text-xs">
            v{procedure.currentVersion}
            {procedure.owner && ` • ${procedure.owner.name}`}
          </CardDescription>
        </CardHeader>
        {procedure.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {procedure.description}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

