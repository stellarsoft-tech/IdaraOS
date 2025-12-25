"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { WorkflowDesigner } from "@/components/workflows"
import { 
  useWorkflowTemplateDetail,
  useUpdateWorkflowTemplate,
  type SaveTemplateStep,
  type SaveTemplateEdge,
} from "@/lib/api/workflows"

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowDesignerPage({ params }: PageProps) {
  const { id } = use(params)
  const _router = useRouter()
  const canAccess = useCanAccess("workflows.templates")
  
  const [_hasChanges, setHasChanges] = useState(false)
  
  // Queries
  const { data: template, isLoading, error } = useWorkflowTemplateDetail(id)
  const updateMutation = useUpdateWorkflowTemplate()
  
  // Handle save
  const handleSave = async (steps: SaveTemplateStep[], edges: SaveTemplateEdge[]) => {
    if (!template) return
    
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        data: { steps, edges },
      })
      toast.success("Workflow saved successfully")
      setHasChanges(false)
    } catch {
      toast.error("Failed to save workflow")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Designer">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to edit workflow templates." 
        />
      </PageShell>
    )
  }
  
  if (isLoading) {
    return (
      <PageShell title="Loading...">
        <div className="h-[calc(100vh-200px)]">
          <Skeleton className="h-full w-full" />
        </div>
      </PageShell>
    )
  }
  
  if (error || !template) {
    return (
      <PageShell title="Template Not Found">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold mb-2">Template not found</h2>
          <p className="text-muted-foreground mb-4">
            The template you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild>
            <Link href="/workflows/templates">Back to Templates</Link>
          </Button>
        </div>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title={`Designer: ${template.name}`}
      action={
        <div className="flex items-center gap-2">
          <Badge className={statusColors[template.status]}>
            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
          </Badge>
          <Button variant="outline" asChild>
            <Link href={`/workflows/templates/${id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Back link */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/workflows/templates/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Template
          </Link>
        </Button>
        
        {/* Designer */}
        <div className="h-[calc(100vh-260px)] min-h-[500px] border rounded-lg overflow-hidden">
          <WorkflowDesigner
            templateId={template.id}
            initialSteps={template.steps}
            initialEdges={template.edges}
            onSave={handleSave}
            isLoading={updateMutation.isPending}
            readOnly={template.status === "archived"}
          />
        </div>
        
        {template.status === "archived" && (
          <p className="text-sm text-muted-foreground text-center">
            This template is archived and cannot be edited. Unarchive it to make changes.
          </p>
        )}
      </div>
    </PageShell>
  )
}

