"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle, Clock, Lock, Plus, Shield, AlertCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { usePermission } from "@/lib/rbac"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  useSecurityFrameworks, 
  useCreateSecurityFramework, 
  useUpdateSecurityFramework,
  useDeleteSecurityFramework,
  type SecurityFramework 
} from "@/lib/api/security"
import { toast } from "sonner"

// Status variants
const statusVariants: Record<string, "default" | "success" | "info" | "warning" | "danger"> = {
  planned: "default",
  implementing: "info",
  certified: "success",
  expired: "danger",
}

// Available frameworks
const availableFrameworks = [
  { code: "iso-27001", name: "ISO/IEC 27001:2022", description: "Information Security Management System" },
  { code: "soc-2", name: "SOC 2 Type II", description: "Service Organization Control 2" },
]

// Form schemas
const createFormSchema = z.object({
  code: z.string().min(1, "Framework is required"),
  name: z.string().min(1, "Name is required").max(200),
  version: z.string().optional(),
  description: z.string().optional(),
  scope: z.string().optional(),
})

const editFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  version: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  status: z.enum(["planned", "implementing", "certified", "expired"]).optional(),
  certificationBody: z.string().optional().nullable(),
  certificateNumber: z.string().optional().nullable(),
  certifiedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
})

// Form config for create
const createFormConfig = {
  code: {
    component: "select" as const,
    label: "Framework",
    placeholder: "Select framework",
    options: availableFrameworks.map(f => ({ value: f.code, label: f.name })),
    required: true,
  },
  name: {
    component: "input" as const,
    label: "Display Name",
    placeholder: "e.g., ISO 27001 Certification 2024",
    required: true,
    type: "text",
  },
  version: {
    component: "input" as const,
    label: "Version",
    placeholder: "e.g., 2022",
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the scope and objectives",
  },
  scope: {
    component: "textarea" as const,
    label: "Certification Scope",
    placeholder: "Define the scope of certification",
  },
}

// Form config for edit
const editFormConfig = {
  name: {
    component: "input" as const,
    label: "Display Name",
    placeholder: "e.g., ISO 27001 Certification 2024",
    required: true,
    type: "text",
  },
  version: {
    component: "input" as const,
    label: "Version",
    placeholder: "e.g., 2022",
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the scope and objectives",
  },
  scope: {
    component: "textarea" as const,
    label: "Certification Scope",
    placeholder: "Define the scope of certification",
  },
  status: {
    component: "select" as const,
    label: "Status",
    placeholder: "Select status",
    options: [
      { value: "planned", label: "Planned" },
      { value: "implementing", label: "Implementing" },
      { value: "certified", label: "Certified" },
      { value: "expired", label: "Expired" },
    ],
  },
  certificationBody: {
    component: "input" as const,
    label: "Certification Body",
    placeholder: "e.g., BSI, Bureau Veritas",
    type: "text",
  },
  certificateNumber: {
    component: "input" as const,
    label: "Certificate Number",
    placeholder: "e.g., IS 123456",
    type: "text",
  },
  certifiedAt: {
    component: "input" as const,
    label: "Certification Date",
    type: "date",
  },
  expiresAt: {
    component: "input" as const,
    label: "Expiry Date",
    type: "date",
  },
}

function FrameworkCard({ 
  framework, 
  onEdit, 
  onDelete,
  canWrite,
  canDelete,
}: { 
  framework: SecurityFramework & { compliancePercent?: number; controlsCount?: number }
  onEdit: (framework: SecurityFramework) => void
  onDelete: (framework: SecurityFramework) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const progress = framework.compliancePercent || 0
  const hasActions = canWrite || canDelete
  
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <Link href={`/security/frameworks/${framework.code}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant={statusVariants[framework.status] || "default"}>
                {framework.status === "implementing" ? "In Progress" : 
                 framework.status.charAt(0).toUpperCase() + framework.status.slice(1)}
              </StatusBadge>
              {hasActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canWrite && (
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(framework); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canWrite && canDelete && <DropdownMenuSeparator />}
                    {canDelete && (
                      <DropdownMenuItem 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(framework); }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <CardTitle className="text-lg mt-4">{framework.name}</CardTitle>
          <CardDescription>{framework.description || availableFrameworks.find(f => f.code === framework.code)?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Compliance</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    progress >= 80
                      ? "bg-green-500"
                      : progress >= 50
                        ? "bg-yellow-500"
                        : "bg-muted-foreground"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                <span>{framework.controlsCount || 0} controls</span>
              </div>
              {framework.certifiedAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Certified {format(new Date(framework.certifiedAt), "MMM yyyy")}</span>
                </div>
              )}
            </div>

            {framework.expiresAt && (
              <div className="flex items-center gap-2 text-sm">
                {new Date(framework.expiresAt) < new Date() ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={new Date(framework.expiresAt) < new Date() ? "text-red-500" : "text-muted-foreground"}>
                  Expires {format(new Date(framework.expiresAt), "MMM d, yyyy")}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

function FrameworkSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-6 w-48 mt-4" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FrameworksPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<SecurityFramework | null>(null)
  
  const { data: frameworksData, isLoading } = useSecurityFrameworks()
  const createFramework = useCreateSecurityFramework()
  const updateFramework = useUpdateSecurityFramework()
  const deleteFramework = useDeleteSecurityFramework()
  
  // RBAC permissions
  const canWrite = usePermission("security.frameworks", "write")
  const canDelete = usePermission("security.frameworks", "delete")
  
  const frameworks = frameworksData?.data || []
  
  // Get available frameworks that haven't been added yet
  const existingCodes = new Set(frameworks.map(f => f.code))
  const canAddMore = availableFrameworks.some(f => !existingCodes.has(f.code))
  
  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      await createFramework.mutateAsync(values)
      toast.success("Framework added successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add framework")
    }
  }
  
  const handleEdit = (framework: SecurityFramework) => {
    setSelectedFramework(framework)
    setEditOpen(true)
  }
  
  const handleEditSubmit = async (values: z.infer<typeof editFormSchema>) => {
    if (!selectedFramework) return
    try {
      await updateFramework.mutateAsync({ id: selectedFramework.id, data: values })
      toast.success("Framework updated successfully")
      setEditOpen(false)
      setSelectedFramework(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update framework")
    }
  }
  
  const handleDeleteClick = (framework: SecurityFramework) => {
    setSelectedFramework(framework)
    setDeleteOpen(true)
  }
  
  const handleDeleteConfirm = async () => {
    if (!selectedFramework) return
    try {
      await deleteFramework.mutateAsync(selectedFramework.id)
      toast.success("Framework deleted successfully")
      setDeleteOpen(false)
      setSelectedFramework(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete framework")
    }
  }
  
  // Auto-populate framework name when code is selected
  const handleFieldChange = (fieldName: string, value: unknown, setValue: (name: string, value: unknown) => void) => {
    if (fieldName === "code" && typeof value === "string") {
      const framework = availableFrameworks.find(f => f.code === value)
      if (framework) {
        setValue("name", framework.name)
      }
    }
  }
  
  return (
    <PageShell
      title="Frameworks (IMS)"
      description="Manage your Information Management System frameworks and compliance programs."
      action={
        canAddMore && (
          <Protected module="security.frameworks" action="write">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Framework
            </Button>
          </Protected>
        )
      }
    >
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FrameworkSkeleton />
          <FrameworkSkeleton />
        </div>
      ) : frameworks.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No frameworks added yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Start your compliance journey by adding a framework like ISO 27001 or SOC 2.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Framework
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((framework) => (
            <FrameworkCard 
              key={framework.id} 
              framework={framework} 
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              canWrite={canWrite}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
      
      {/* Create Framework Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Framework"
        description="Add a compliance framework to track"
        schema={createFormSchema}
        config={{
          ...createFormConfig,
          code: {
            ...createFormConfig.code,
            options: availableFrameworks
              .filter(f => !existingCodes.has(f.code))
              .map(f => ({ value: f.code, label: f.name })),
          },
        }}
        fields={["code", "name", "version", "description", "scope"]}
        mode="create"
        onSubmit={handleCreate}
        onFieldChange={handleFieldChange}
      />
      
      {/* Edit Framework Drawer */}
      <FormDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedFramework(null)
        }}
        title="Edit Framework"
        description={`Update ${selectedFramework?.name || "framework"} settings`}
        schema={editFormSchema}
        config={editFormConfig}
        fields={["name", "version", "description", "scope", "status", "certificationBody", "certificateNumber", "certifiedAt", "expiresAt"]}
        defaultValues={selectedFramework ? {
          name: selectedFramework.name,
          version: selectedFramework.version || "",
          description: selectedFramework.description || "",
          scope: selectedFramework.scope || "",
          status: selectedFramework.status,
          certificationBody: selectedFramework.certificationBody || "",
          certificateNumber: selectedFramework.certificateNumber || "",
          certifiedAt: selectedFramework.certifiedAt ? selectedFramework.certifiedAt.split("T")[0] : "",
          expiresAt: selectedFramework.expiresAt ? selectedFramework.expiresAt.split("T")[0] : "",
        } : undefined}
        mode="edit"
        onSubmit={handleEditSubmit}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Framework</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedFramework?.name}</strong>? 
              This will also delete all associated Statement of Applicability items and progress tracking.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedFramework(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Framework
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
