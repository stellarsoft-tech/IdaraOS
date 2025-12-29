"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { 
  ArrowLeft, 
  CheckCircle, 
  FileCheck, 
  Shield, 
  User, 
  Calendar, 
  Link2, 
  Clock, 
  AlertTriangle,
  Edit,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react"
import { format } from "date-fns"
import { z } from "zod"

import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  useSecurityControl, 
  useUpdateSecurityControl,
  useSecurityEvidence,
  useCreateSecurityEvidence,
  type SecurityControl,
  type ControlMapping,
} from "@/lib/api/security"
import { 
  controlTypeValues, 
  controlCategoryValues,
  evidenceTypeValues 
} from "@/lib/db/schema/security"
import { toast } from "sonner"
import { useBreadcrumbLabel } from "@/components/breadcrumb-context"

// Status configurations
const statusConfig: Record<string, { label: string; variant: "success" | "info" | "warning" | "default" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "default" },
  under_review: { label: "Under Review", variant: "warning" },
}

const implementationConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  not_implemented: { label: "Not Implemented", icon: AlertTriangle, color: "text-gray-400" },
  partially_implemented: { label: "Partially Implemented", icon: Clock, color: "text-yellow-500" },
  implemented: { label: "Implemented", icon: CheckCircle, color: "text-blue-500" },
  effective: { label: "Effective", icon: CheckCircle, color: "text-green-500" },
}

// Edit form schema
const editControlSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive", "under_review"]),
  implementationStatus: z.enum(["not_implemented", "partially_implemented", "implemented", "effective"]),
  implementationNotes: z.string().optional(),
  controlType: z.string().optional(),
  category: z.string().optional(),
  reviewFrequencyDays: z.number().int().min(1).max(365).optional().nullable(),
})

// Evidence creation schema
const createEvidenceSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(evidenceTypeValues).default("document"),
  collectedAt: z.string().min(1, "Collection date is required"),
  validUntil: z.string().optional(),
  externalUrl: z.string().url().optional().or(z.literal("")),
  externalSystem: z.string().optional(),
})

function ControlDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[400px] lg:col-span-1" />
        <Skeleton className="h-[400px] lg:col-span-2" />
      </div>
    </div>
  )
}

function MappingCard({ mapping }: { mapping: ControlMapping }) {
  const frameworkLabels: Record<string, string> = {
    "iso-27001": "ISO 27001",
    "soc-2": "SOC 2",
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">{mapping.standardControl?.controlId}</p>
          <p className="text-xs text-muted-foreground">{mapping.standardControl?.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {frameworkLabels[mapping.standardControl?.frameworkCode || ""] || mapping.standardControl?.frameworkCode}
        </Badge>
        {mapping.coverageLevel && (
          <Badge variant={mapping.coverageLevel === "full" ? "default" : "secondary"}>
            {mapping.coverageLevel}
          </Badge>
        )}
      </div>
    </div>
  )
}

export default function ControlDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const { data, isLoading, error } = useSecurityControl(id)
  const updateControl = useUpdateSecurityControl()
  const { data: evidenceData, refetch: refetchEvidence } = useSecurityEvidence({ controlId: id })
  const createEvidence = useCreateSecurityEvidence()
  
  const [editOpen, setEditOpen] = useState(false)
  const [addEvidenceOpen, setAddEvidenceOpen] = useState(false)
  
  const control = data?.data
  const mappings = control?.mappings || []
  const evidence = evidenceData?.data || []
  
  // Set breadcrumb to show Control ID instead of GUID
  useBreadcrumbLabel(control?.controlId)
  
  if (isLoading) {
    return (
      <PageShell title="Control Details" description="Loading...">
        <ControlDetailSkeleton />
      </PageShell>
    )
  }
  
  if (error || !control) {
    return (
      <PageShell title="Control Not Found" description="The requested control could not be found.">
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Control not found</h3>
            <p className="text-muted-foreground mb-4">
              This control may have been deleted or you don&apos;t have access to it.
            </p>
            <Button asChild>
              <Link href="/security/controls">Back to Controls</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    )
  }
  
  const statusInfo = statusConfig[control.status] || statusConfig.active
  const implInfo = implementationConfig[control.implementationStatus] || implementationConfig.not_implemented
  const ImplIcon = implInfo.icon
  
  const handleEditSubmit = async (formData: Record<string, unknown>) => {
    try {
      await updateControl.mutateAsync({
        id: control.id,
        data: formData as Partial<SecurityControl>,
      })
      toast.success("Control updated successfully")
      setEditOpen(false)
    } catch {
      toast.error("Failed to update control")
    }
  }
  
  const handleAddEvidence = async (formData: Record<string, unknown>) => {
    try {
      await createEvidence.mutateAsync({
        ...formData,
        controlIds: [id], // Pre-link to current control
        externalUrl: formData.externalUrl || undefined,
      } as Parameters<typeof createEvidence.mutateAsync>[0])
      toast.success("Evidence added and linked to this control")
      setAddEvidenceOpen(false)
      refetchEvidence() // Refresh the evidence list
    } catch {
      toast.error("Failed to add evidence")
    }
  }
  
  // Group mappings by framework
  const mappingsByFramework = mappings.reduce((acc, m) => {
    const fw = m.standardControl?.frameworkCode || "unknown"
    if (!acc[fw]) acc[fw] = []
    acc[fw].push(m)
    return acc
  }, {} as Record<string, ControlMapping[]>)
  
  return (
    <PageShell
      title={control.controlId}
      description={control.title}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/security/controls">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Controls
            </Link>
          </Button>
          <Protected module="security.controls" action="edit">
            <Button onClick={() => setEditOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Control
            </Button>
          </Protected>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Control Summary */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{control.controlId}</h2>
              <p className="text-sm text-muted-foreground mt-1">{control.title}</p>
              <div className="flex gap-2 mt-3">
                <StatusBadge variant={statusInfo.variant}>
                  {statusInfo.label}
                </StatusBadge>
                <Badge variant="outline" className={implInfo.color}>
                  {implInfo.label}
                </Badge>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Owner: {control.ownerName || "Unassigned"}</span>
              </div>
              {control.category && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Category: {control.category}</span>
                </div>
              )}
              {control.controlType && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Type: {control.controlType}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <span>Mappings: {mappings.length} framework{mappings.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <span>Evidence: {evidence.length} item{evidence.length !== 1 ? "s" : ""}</span>
              </div>
              {control.lastTestedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Last tested: {format(new Date(control.lastTestedAt), "MMM d, yyyy")}</span>
                </div>
              )}
              {control.nextReviewAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Next review: {format(new Date(control.nextReviewAt), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium mb-3">Framework Coverage</h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(mappingsByFramework).length > 0 ? (
                  Object.keys(mappingsByFramework).map(fw => (
                    <Badge key={fw} variant="secondary">
                      {fw === "iso-27001" ? "ISO 27001" : fw === "soc-2" ? "SOC 2" : fw}
                      <span className="ml-1 text-muted-foreground">({mappingsByFramework[fw].length})</span>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No framework mappings</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="mappings">
                Framework Mappings
                {mappings.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{mappings.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="evidence">
                Evidence
                {evidence.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{evidence.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Control Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {control.description || "No description provided."}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Implementation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <ImplIcon className={`h-5 w-5 ${implInfo.color}`} />
                    <div>
                      <p className="font-medium">{implInfo.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {control.implementationStatus === "not_implemented" && "This control has not been implemented yet."}
                        {control.implementationStatus === "partially_implemented" && "This control is partially implemented."}
                        {control.implementationStatus === "implemented" && "This control has been implemented and is operational."}
                        {control.implementationStatus === "effective" && "This control has been tested and confirmed effective."}
                      </p>
                    </div>
                  </div>
                  {control.implementationNotes && (
                    <div className="mt-4 p-3 rounded-lg bg-muted">
                      <p className="text-sm font-medium mb-1">Implementation Notes</p>
                      <p className="text-sm text-muted-foreground">{control.implementationNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {control.implementedAt && (
                <Card>
                  <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Created</span>
                        <span>{format(new Date(control.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Implemented</span>
                        <span>{format(new Date(control.implementedAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span>{format(new Date(control.updatedAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="mappings" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Framework Mappings</CardTitle>
                      <CardDescription>
                        Standard controls this control satisfies
                      </CardDescription>
                    </div>
                    <Protected module="security.controls" action="edit">
                      <Button size="sm" asChild>
                        <Link href={`/security/controls/${id}/mappings`}>
                          <Plus className="mr-2 h-4 w-4" />
                          Manage Mappings
                        </Link>
                      </Button>
                    </Protected>
                  </div>
                </CardHeader>
                <CardContent>
                  {mappings.length > 0 ? (
                    <div className="space-y-2">
                      {mappings.map(mapping => (
                        <MappingCard key={mapping.id} mapping={mapping} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No framework mappings yet
                      </p>
                      <Protected module="security.controls" action="edit">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/security/controls/${id}/mappings`}>
                            Add Mapping
                          </Link>
                        </Button>
                      </Protected>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Evidence ({evidence.length})</CardTitle>
                      <CardDescription>Documentation supporting this control</CardDescription>
                    </div>
                    <Protected module="security.evidence" action="create">
                      <Button size="sm" onClick={() => setAddEvidenceOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Evidence
                      </Button>
                    </Protected>
                  </div>
                </CardHeader>
                <CardContent>
                  {evidence.length > 0 ? (
                    <div className="space-y-3">
                      {evidence.map((e) => (
                        <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileCheck className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{e.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {e.type} • Added {format(new Date(e.createdAt), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/security/evidence/${e.id}`}>
                              View
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No evidence linked to this control yet
                      </p>
                      <Protected module="security.evidence" action="create">
                        <Button variant="outline" size="sm" onClick={() => setAddEvidenceOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Evidence
                        </Button>
                      </Protected>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Control Drawer */}
      <FormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Control"
        description="Update control details"
        schema={editControlSchema}
        fields={[
          { name: "title", label: "Title", component: "input", type: "text", required: true },
          { name: "description", label: "Description", component: "textarea" },
          { 
            name: "status", 
            label: "Status", 
            component: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "under_review", label: "Under Review" },
            ],
          },
          { 
            name: "implementationStatus", 
            label: "Implementation Status", 
            component: "select",
            options: [
              { value: "not_implemented", label: "Not Implemented" },
              { value: "partially_implemented", label: "Partially Implemented" },
              { value: "implemented", label: "Implemented" },
              { value: "effective", label: "Effective" },
            ],
          },
          { name: "implementationNotes", label: "Implementation Notes", component: "textarea" },
          { 
            name: "controlType", 
            label: "Control Type", 
            component: "select",
            options: controlTypeValues.map(v => ({ 
              value: v, 
              label: v.charAt(0).toUpperCase() + v.slice(1) 
            })),
          },
          { 
            name: "category", 
            label: "Category", 
            component: "select",
            options: controlCategoryValues.map(v => ({ 
              value: v, 
              label: v.charAt(0).toUpperCase() + v.slice(1) 
            })),
          },
          { name: "reviewFrequencyDays", label: "Review Frequency (days)", component: "input", type: "number" },
        ]}
        defaultValues={{
          title: control.title,
          description: control.description || "",
          status: control.status,
          implementationStatus: control.implementationStatus,
          implementationNotes: control.implementationNotes || "",
          controlType: control.controlType || "",
          category: control.category || "",
          reviewFrequencyDays: control.reviewFrequencyDays || undefined,
        }}
        onSubmit={handleEditSubmit}
        submitLabel="Save Changes"
        isSubmitting={updateControl.isPending}
      />
      
      {/* Add Evidence Drawer */}
      <FormDrawer
        open={addEvidenceOpen}
        onOpenChange={setAddEvidenceOpen}
        title="Add Evidence"
        description={`Add evidence for ${control.controlId}: ${control.title}`}
        schema={createEvidenceSchema}
        fields={[
          { name: "title", label: "Title", component: "input", type: "text", required: true },
          { name: "description", label: "Description", component: "textarea" },
          { 
            name: "type", 
            label: "Type", 
            component: "select",
            options: evidenceTypeValues.map(v => ({ 
              value: v, 
              label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ") 
            })),
            required: true,
          },
          { name: "collectedAt", label: "Collection Date", component: "input", type: "date", required: true },
          { name: "validUntil", label: "Valid Until", component: "input", type: "date" },
          { name: "externalUrl", label: "External URL", component: "input", type: "text", placeholder: "https://..." },
          { name: "externalSystem", label: "External System", component: "input", type: "text", placeholder: "e.g., Jira, Confluence" },
        ]}
        defaultValues={{
          type: "document",
          collectedAt: new Date().toISOString().split('T')[0],
        }}
        onSubmit={handleAddEvidence}
        submitLabel="Add Evidence"
        isSubmitting={createEvidence.isPending}
        infoBanner={
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-sm">
            <Shield className="h-4 w-4 text-primary" />
            <span>This evidence will be linked to <strong>{control.controlId}</strong></span>
          </div>
        }
      />
    </PageShell>
  )
}
