"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Pencil, 
  Trash2, 
  Archive,
  ArchiveRestore,
  ArrowLeft,
  PlayCircle,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useBreadcrumbLabel } from "@/components/breadcrumb-context"
import { 
  WorkflowDesigner, 
  EditTemplateDialog,
  moduleScopeOptions,
  triggerTypeOptions,
  type EditTemplateFormData,
} from "@/components/workflows"
import { 
  useWorkflowTemplateDetail,
  useUpdateWorkflowTemplate,
  useDeleteWorkflowTemplate,
} from "@/lib/api/workflows"
import { usePeopleList } from "@/lib/api/people"

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowTemplateDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const canAccess = useCanAccess("workflows.templates")
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  
  // Queries
  const { data: template, isLoading, error } = useWorkflowTemplateDetail(id)
  const { data: people = [] } = usePeopleList()
  const updateMutation = useUpdateWorkflowTemplate()
  const deleteMutation = useDeleteWorkflowTemplate()
  
  // Set breadcrumb to template name
  useBreadcrumbLabel(template?.name)
  
  // Handlers
  const handleActivate = async () => {
    if (!template) return
    
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        data: { status: "active" },
      })
      toast.success("Template activated")
    } catch {
      toast.error("Failed to activate template")
    }
  }
  
  const handleArchive = async () => {
    if (!template) return
    
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        data: { status: "archived" },
      })
      toast.success("Template archived")
    } catch {
      toast.error("Failed to archive template")
    }
  }
  
  const handleUnarchive = async () => {
    if (!template) return
    
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        data: { status: "draft" },
      })
      toast.success("Template unarchived")
    } catch {
      toast.error("Failed to unarchive template")
    }
  }
  
  const handleDelete = async () => {
    if (!template) return
    
    try {
      await deleteMutation.mutateAsync(template.id)
      toast.success("Template deleted")
      router.push("/workflows/templates")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete template"
      toast.error(message)
    }
  }
  
  const handleEditSave = async (formData: EditTemplateFormData) => {
    if (!template) return
    
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          moduleScope: formData.moduleScope,
          triggerType: formData.triggerType,
          status: formData.status,
          defaultOwnerId: formData.defaultOwnerId,
        },
      })
      toast.success("Template updated")
      setShowEditDialog(false)
    } catch {
      toast.error("Failed to update template")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Template">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view this template." 
        />
      </PageShell>
    )
  }
  
  if (isLoading) {
    return (
      <PageShell title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-[400px] w-full" />
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
      title={template.name}
      description={template.description}
      compact
      backButton={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/workflows/templates">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Templates</TooltipContent>
        </Tooltip>
      }
      statusBadge={
        <Badge className={statusColors[template.status]}>
          {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
        </Badge>
      }
      action={
        <div className="flex items-center gap-2">
          {template.status === "draft" && (
            <Button onClick={handleActivate} disabled={updateMutation.isPending}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/workflows/templates/${id}/designer`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Designer
            </Link>
          </Button>
        </div>
      }
    >
        <div className="space-y-4">
          {/* Template Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Template Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Module</span>
                    <p className="font-medium">
                      {moduleScopeOptions.find(o => o.value === template.moduleScope)?.label || "Global"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Trigger</span>
                    <p className="font-medium">
                      {triggerTypeOptions.find(o => o.value === template.triggerType)?.label || "Manual"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Steps</span>
                    <p className="font-medium">{template.stepsCount}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Instances</span>
                    <p className="font-medium">{template.instancesCount}</p>
                  </div>
                  {template.defaultDueDays && (
                    <div>
                      <span className="text-sm text-muted-foreground">Default Duration</span>
                      <p className="font-medium">{template.defaultDueDays} days</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Default Owner</span>
                    <div className="flex items-center gap-2 mt-1">
                      {template.defaultOwner ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="font-medium">{template.defaultOwner.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              
              {template.createdBy && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Created by</span>
                    <p className="font-medium">{template.createdBy.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
              
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/workflows/templates/${id}/designer`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit in Designer
                </Link>
              </Button>
              
              {template.status !== "archived" ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleArchive}
                  disabled={updateMutation.isPending}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Template
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleUnarchive}
                  disabled={updateMutation.isPending}
                >
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive Template
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Template
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Workflow Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Preview</CardTitle>
            <CardDescription>
              Visual representation of the workflow steps
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] border-t">
              <WorkflowDesigner
                templateId={template.id}
                initialSteps={template.steps}
                initialEdges={template.edges}
                readOnly
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Steps List */}
        {template.steps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Steps ({template.steps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {template.steps
                  .filter(s => !s.parentStepId)
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((step, index) => (
                    <div 
                      key={step.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{step.name}</p>
                          {step.description && (
                            <p className="text-sm text-muted-foreground">
                              {step.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{step.stepType}</Badge>
                        {step.dueOffsetDays && (
                          <Badge variant="secondary">+{step.dueOffsetDays}d</Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{template.name}&quot;? 
              This action cannot be undone.
              {template.instancesCount > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This template has {template.instancesCount} instances.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Template Dialog */}
      <EditTemplateDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        initialData={{
          name: template.name,
          description: template.description || "",
          moduleScope: template.moduleScope || "people",
          triggerType: template.triggerType || "manual",
          status: template.status as "draft" | "active" | "archived",
          defaultOwnerId: template.defaultOwnerId ?? null,
        }}
        onSave={handleEditSave}
        isSaving={updateMutation.isPending}
        people={people}
      />
    </PageShell>
  )
}

