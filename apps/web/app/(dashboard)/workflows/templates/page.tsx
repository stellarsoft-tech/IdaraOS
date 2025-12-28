"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  Plus, 
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  Eye,
  Layers,
  User,
  PlayCircle,
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { 
  EditTemplateDialog,
  CreateInstanceDialog,
  moduleScopeOptions,
  triggerTypeOptions,
  type EditTemplateFormData,
} from "@/components/workflows"
import { 
  useWorkflowTemplatesList, 
  useCreateWorkflowTemplate,
  useUpdateWorkflowTemplate,
  useDeleteWorkflowTemplate,
  type WorkflowTemplate,
} from "@/lib/api/workflows"
import { usePeopleList } from "@/lib/api/people"

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
}

interface TemplateCardProps {
  template: WorkflowTemplate
  onEdit: (template: WorkflowTemplate) => void
  onDelete: (template: WorkflowTemplate) => void
  onArchive: (template: WorkflowTemplate) => void
  onCreateInstance: (template: WorkflowTemplate) => void
}

function TemplateCard({ template, onEdit, onDelete, onArchive, onCreateInstance }: TemplateCardProps) {
  const router = useRouter()
  
  return (
    <Card className="group hover:border-primary/30 hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
            {template.description && (
              <CardDescription className="line-clamp-2">
                {template.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/workflows/templates/${template.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              {template.status === "active" && (
                <DropdownMenuItem onClick={() => onCreateInstance(template)}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Create Instance
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/workflows/templates/${template.id}/designer`)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Designer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {template.status !== "archived" && (
                <DropdownMenuItem onClick={() => onArchive(template)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(template)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={statusColors[template.status]}>
            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
          </Badge>
          {template.moduleScope && (
            <Badge variant="outline">
              {moduleScopeOptions.find(o => o.value === template.moduleScope)?.label || template.moduleScope}
            </Badge>
          )}
          {template.triggerType && (
            <Badge variant="secondary">
              {triggerTypeOptions.find(o => o.value === template.triggerType)?.label || template.triggerType}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{template.stepsCount} steps</span>
          <span>{template.instancesCount} instances</span>
        </div>
        {template.defaultOwner && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Owner:</span>
            <span className="font-medium">{template.defaultOwner.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function WorkflowTemplatesPage() {
  const router = useRouter()
  const canAccess = useCanAccess("workflows.templates")
  
  // State
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<WorkflowTemplate | null>(null)
  const [creatingInstanceFrom, setCreatingInstanceFrom] = useState<WorkflowTemplate | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<{
    name: string
    description: string
    moduleScope: string
    triggerType: string
    status: "draft" | "active" | "archived"
  }>({
    name: "",
    description: "",
    moduleScope: "",
    triggerType: "",
    status: "draft",
  })
  
  // Queries
  const { data: templates = [], isLoading } = useWorkflowTemplatesList({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  })
  const { data: people = [] } = usePeopleList()
  const createMutation = useCreateWorkflowTemplate()
  const updateMutation = useUpdateWorkflowTemplate()
  const deleteMutation = useDeleteWorkflowTemplate()
  
  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates
    
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      )
    }
    
    if (statusFilter !== "all") {
      result = result.filter(t => t.status === statusFilter)
    }
    
    return result
  }, [templates, search, statusFilter])
  
  // Handlers
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      moduleScope: "",
      triggerType: "",
      status: "draft",
    })
  }
  
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a template name")
      return
    }
    
    try {
      const template = await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        moduleScope: formData.moduleScope || undefined,
        triggerType: formData.triggerType || undefined,
        status: formData.status,
      })
      
      toast.success("Template created successfully")
      setIsCreateOpen(false)
      resetForm()
      
      // Navigate to designer
      router.push(`/workflows/templates/${template.id}/designer`)
    } catch {
      toast.error("Failed to create template")
    }
  }
  
  const handleEdit = (template: WorkflowTemplate) => {
    setEditingTemplate(template)
  }
  
  const handleUpdate = async (formData: EditTemplateFormData) => {
    if (!editingTemplate) return
    
    try {
      await updateMutation.mutateAsync({
        id: editingTemplate.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          moduleScope: formData.moduleScope || undefined,
          triggerType: formData.triggerType || undefined,
          status: formData.status,
          defaultOwnerId: formData.defaultOwnerId,
        },
      })
      
      toast.success("Template updated successfully")
      setEditingTemplate(null)
    } catch {
      toast.error("Failed to update template")
    }
  }
  
  const handleArchive = async (template: WorkflowTemplate) => {
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
  
  const handleDelete = async () => {
    if (!deletingTemplate) return
    
    try {
      await deleteMutation.mutateAsync(deletingTemplate.id)
      toast.success("Template deleted")
      setDeletingTemplate(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete template"
      toast.error(message)
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Templates">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view workflow templates." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Workflow Templates"
      description="Create and manage reusable workflow templates."
      action={
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex justify-between mt-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search ? "Try adjusting your search" : "Create your first workflow template to get started"}
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={setDeletingTemplate}
              onArchive={handleArchive}
              onCreateInstance={setCreatingInstanceFrom}
            />
          ))}
        </div>
      )}
      
      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workflow Template</DialogTitle>
            <DialogDescription>
              Create a new workflow template. You can add steps in the designer after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Standard Onboarding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this workflow is for..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <Select
                  value={formData.moduleScope}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, moduleScope: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleScopeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, triggerType: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create & Open Designer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Dialog */}
      {editingTemplate && (
        <EditTemplateDialog
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
          initialData={{
            name: editingTemplate.name,
            description: editingTemplate.description || "",
            moduleScope: editingTemplate.moduleScope || "people",
            triggerType: editingTemplate.triggerType || "manual",
            status: editingTemplate.status,
            defaultOwnerId: editingTemplate.defaultOwnerId ?? null,
          }}
          onSave={handleUpdate}
          isSaving={updateMutation.isPending}
          people={people}
        />
      )}
      
      {/* Delete Confirmation */}
      <Dialog open={!!deletingTemplate} onOpenChange={() => setDeletingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTemplate(null)}>
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
      
      {/* Create Instance Dialog */}
      {creatingInstanceFrom && (
        <CreateInstanceDialog
          open={!!creatingInstanceFrom}
          onOpenChange={(open) => !open && setCreatingInstanceFrom(null)}
          template={creatingInstanceFrom}
          onSuccess={(instanceId) => {
            setCreatingInstanceFrom(null)
            router.push(`/workflows/instances/${instanceId}`)
          }}
        />
      )}
    </PageShell>
  )
}

