"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Calendar, Check, Pencil, Plus, Shield, Trash2, User, Clock, X } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
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
  useSecurityRisk,
  useUpdateSecurityRisk,
  useDeleteSecurityRisk,
  useSecurityControls,
  useLinkRiskControl,
  useUnlinkRiskControl,
} from "@/lib/api/security"
import { usePeopleList } from "@/lib/api/people"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  riskCategoryValues,
  riskLikelihoodValues,
  riskImpactValues,
  riskStatusValues,
  riskTreatmentValues,
} from "@/lib/db/schema/security"
import { toast } from "sonner"

const levelVariant: Record<string, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger",
}

// Variant for a 5-step likelihood scale
const likelihoodVariant: Record<(typeof riskLikelihoodValues)[number], "success" | "warning" | "danger"> = {
  very_low: "success",
  low: "success",
  medium: "warning",
  high: "danger",
  very_high: "danger",
}

// Variant for a 5-step impact scale
const impactVariant: Record<(typeof riskImpactValues)[number], "success" | "warning" | "danger"> = {
  negligible: "success",
  minor: "success",
  moderate: "warning",
  major: "danger",
  severe: "danger",
}

// Human-readable labels for canonical enum values
const likelihoodLabels: Record<(typeof riskLikelihoodValues)[number], string> = {
  very_low: "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
}

const impactLabels: Record<(typeof riskImpactValues)[number], string> = {
  negligible: "Negligible",
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  severe: "Severe",
}

const statusLabels: Record<(typeof riskStatusValues)[number], string> = {
  identified: "Identified",
  assessing: "Assessing",
  treating: "Treating",
  monitoring: "Monitoring",
  closed: "Closed",
}

const categoryLabels: Record<(typeof riskCategoryValues)[number], string> = {
  operational: "Operational",
  compliance: "Compliance",
  strategic: "Strategic",
  financial: "Financial",
  reputational: "Reputational",
  technical: "Technical",
}

const treatmentLabels: Record<(typeof riskTreatmentValues)[number], string> = {
  avoid: "Avoid",
  transfer: "Transfer",
  mitigate: "Mitigate",
  accept: "Accept",
}

// Risk matrix scoring (must mirror server-side calculateRiskLevel)
const likelihoodScores: Record<(typeof riskLikelihoodValues)[number], number> = {
  very_low: 1, low: 2, medium: 3, high: 4, very_high: 5,
}
const impactScores: Record<(typeof riskImpactValues)[number], number> = {
  negligible: 1, minor: 2, moderate: 3, major: 4, severe: 5,
}
function levelFromScores(likelihood: string, impact: string): "low" | "medium" | "high" | "critical" {
  const l = likelihoodScores[likelihood as (typeof riskLikelihoodValues)[number]] ?? 0
  const i = impactScores[impact as (typeof riskImpactValues)[number]] ?? 0
  const score = l * i
  if (score >= 20) return "critical"
  if (score >= 12) return "high"
  if (score >= 6) return "medium"
  return "low"
}
const matrixCellClass: Record<"low" | "medium" | "high" | "critical", string> = {
  low: "bg-green-100 dark:bg-green-900/30",
  medium: "bg-yellow-100 dark:bg-yellow-900/30",
  high: "bg-red-100 dark:bg-red-900/30",
  critical: "bg-red-200 dark:bg-red-900/50",
}
const matrixCellLabel: Record<"low" | "medium" | "high" | "critical", string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

// Edit form schema - mirrors the API contract
const editFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.enum(riskCategoryValues),
  inherentLikelihood: z.enum(riskLikelihoodValues),
  inherentImpact: z.enum(riskImpactValues),
  residualLikelihood: z.enum(riskLikelihoodValues).optional(),
  residualImpact: z.enum(riskImpactValues).optional(),
  status: z.enum(riskStatusValues),
  treatment: z.enum(riskTreatmentValues).optional(),
  treatmentPlan: z.string().optional(),
  ownerId: z.preprocess(
    (v) => (v === "" || v === "__unassigned__" || v === undefined ? null : v),
    z.string().uuid().nullable().optional(),
  ),
})

// Edit form config
const editFormConfig = {
  title: {
    component: "input" as const,
    label: "Title",
    placeholder: "Enter risk title",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the risk in detail",
  },
  category: {
    component: "select" as const,
    label: "Category",
    placeholder: "Select category",
    options: riskCategoryValues.map(v => ({ value: v, label: categoryLabels[v] })),
    required: true,
  },
  inherentLikelihood: {
    component: "select" as const,
    label: "Inherent Likelihood",
    placeholder: "Select likelihood",
    options: riskLikelihoodValues.map(v => ({ value: v, label: likelihoodLabels[v] })),
    required: true,
  },
  inherentImpact: {
    component: "select" as const,
    label: "Inherent Impact",
    placeholder: "Select impact",
    options: riskImpactValues.map(v => ({ value: v, label: impactLabels[v] })),
    required: true,
  },
  residualLikelihood: {
    component: "select" as const,
    label: "Residual Likelihood",
    placeholder: "Select residual likelihood",
    options: riskLikelihoodValues.map(v => ({ value: v, label: likelihoodLabels[v] })),
  },
  residualImpact: {
    component: "select" as const,
    label: "Residual Impact",
    placeholder: "Select residual impact",
    options: riskImpactValues.map(v => ({ value: v, label: impactLabels[v] })),
  },
  status: {
    component: "select" as const,
    label: "Status",
    placeholder: "Select status",
    options: riskStatusValues.map(v => ({ value: v, label: statusLabels[v] })),
    required: true,
  },
  treatment: {
    component: "select" as const,
    label: "Treatment Strategy",
    placeholder: "Select treatment",
    options: riskTreatmentValues.map(v => ({ value: v, label: treatmentLabels[v] })),
  },
  treatmentPlan: {
    component: "textarea" as const,
    label: "Treatment Plan",
    placeholder: "Describe the treatment plan",
  },
  ownerId: {
    component: "select" as const,
    label: "Risk Owner",
    placeholder: "Select an owner",
    helpText: "Person accountable for managing this risk",
    options: [] as Array<{ value: string; label: string }>,
  },
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80 lg:col-span-2" />
      </div>
    </div>
  )
}

export default function RiskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [controlSearch, setControlSearch] = useState("")
  
  const { data: riskData, isLoading, error } = useSecurityRisk(id)
  const { data: controlsData } = useSecurityControls({ limit: 100 })
  const { data: people = [] } = usePeopleList({ status: ["active"] })
  const updateRisk = useUpdateSecurityRisk()
  const deleteRisk = useDeleteSecurityRisk()
  const linkControl = useLinkRiskControl()
  const unlinkControl = useUnlinkRiskControl()
  
  const risk = riskData?.data
  const controls = controlsData?.data || []
  const mitigatingControls = risk?.mitigatingControls ?? []
  const linkedControlIds = new Set(mitigatingControls.map(mc => mc.controlId))

  // Inject the live list of people as owner options on top of the static config.
  // Radix <Select.Item> disallows value="", so use a sentinel that we translate
  // to null in the Zod preprocess above.
  const editFormConfigWithOwner = useMemo(() => ({
    ...editFormConfig,
    ownerId: {
      ...editFormConfig.ownerId,
      options: [
        { value: "__unassigned__", label: "— Unassigned —" },
        ...people.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
  }), [people])
  
  if (isLoading) {
    return <LoadingSkeleton />
  }
  
  if (error || !risk) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Risk Not Found</h2>
        <p className="text-muted-foreground mb-4">The risk you&apos;re looking for doesn&apos;t exist or has been deleted.</p>
        <Button asChild>
          <Link href="/security/risks">Back to Risk Register</Link>
        </Button>
      </div>
    )
  }
  
  const handleUpdate = async (values: z.infer<typeof editFormSchema>) => {
    try {
      await updateRisk.mutateAsync({ id, data: values })
      toast.success("Risk updated successfully")
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update risk")
    }
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteRisk.mutateAsync(id)
      toast.success("Risk deleted successfully")
      setDeleteOpen(false)
      router.push("/security/risks")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete risk")
    }
  }

  const handleLinkControl = async (controlId: string) => {
    try {
      await linkControl.mutateAsync({ riskId: id, controlId })
      toast.success("Control linked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link control")
    }
  }

  const handleUnlinkControl = async (controlId: string) => {
    try {
      await unlinkControl.mutateAsync({ riskId: id, controlId })
      toast.success("Control unlinked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlink control")
    }
  }

  // Controls available to link: ones that aren't already linked, optionally filtered
  const search = controlSearch.trim().toLowerCase()
  const linkableControls = controls.filter(c => {
    if (linkedControlIds.has(c.id)) return false
    if (!search) return true
    return (
      c.controlId.toLowerCase().includes(search) ||
      c.title.toLowerCase().includes(search)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/risks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={risk.riskId} description={risk.title} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`h-16 w-16 rounded-xl flex items-center justify-center mb-4 ${
                  risk.inherentLevel === "high" || risk.inherentLevel === "critical"
                    ? "bg-red-100 dark:bg-red-900/30"
                    : risk.inherentLevel === "medium"
                      ? "bg-yellow-100 dark:bg-yellow-900/30"
                      : "bg-green-100 dark:bg-green-900/30"
                }`}
              >
                <AlertTriangle
                  className={`h-8 w-8 ${
                    risk.inherentLevel === "high" || risk.inherentLevel === "critical"
                      ? "text-red-600"
                      : risk.inherentLevel === "medium"
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                />
              </div>
              <h2 className="text-xl font-semibold">{risk.riskId}</h2>
              <p className="text-sm text-muted-foreground mt-1">{risk.title}</p>
              <StatusBadge variant={levelVariant[risk.inherentLevel]} className="mt-2">
                {risk.inherentLevel.charAt(0).toUpperCase() + risk.inherentLevel.slice(1)} Risk
              </StatusBadge>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Owner: {risk.ownerName || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Category: {risk.category}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Status: {risk.status}</span>
              </div>
              {risk.treatment && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Treatment: {risk.treatment}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <Protected module="security.risks" anyAction={["edit", "write"]}>
                <Button 
                  className="flex-1 bg-transparent" 
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Risk
                </Button>
              </Protected>
              <Protected module="security.risks" action="delete">
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete risk"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Protected>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{risk.description || "No description provided."}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Inherent Risk</h4>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Likelihood</p>
                          <StatusBadge variant={likelihoodVariant[risk.inherentLikelihood as (typeof riskLikelihoodValues)[number]]}>
                            {likelihoodLabels[risk.inherentLikelihood as (typeof riskLikelihoodValues)[number]] ?? risk.inherentLikelihood}
                          </StatusBadge>
                        </div>
                        <div className="p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Impact</p>
                          <StatusBadge variant={impactVariant[risk.inherentImpact as (typeof riskImpactValues)[number]]}>
                            {impactLabels[risk.inherentImpact as (typeof riskImpactValues)[number]] ?? risk.inherentImpact}
                          </StatusBadge>
                        </div>
                        <div className="p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Level</p>
                          <StatusBadge variant={levelVariant[risk.inherentLevel]}>{risk.inherentLevel}</StatusBadge>
                        </div>
                      </div>
                    </div>
                    {(risk.residualLikelihood || risk.residualImpact || risk.residualLevel) && (
                      <div>
                        <h4 className="text-sm font-medium mb-3">Residual Risk</h4>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="p-3 rounded-lg border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Likelihood</p>
                            {risk.residualLikelihood ? (
                              <StatusBadge variant={likelihoodVariant[risk.residualLikelihood as (typeof riskLikelihoodValues)[number]]}>
                                {likelihoodLabels[risk.residualLikelihood as (typeof riskLikelihoodValues)[number]] ?? risk.residualLikelihood}
                              </StatusBadge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                          <div className="p-3 rounded-lg border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Impact</p>
                            {risk.residualImpact ? (
                              <StatusBadge variant={impactVariant[risk.residualImpact as (typeof riskImpactValues)[number]]}>
                                {impactLabels[risk.residualImpact as (typeof riskImpactValues)[number]] ?? risk.residualImpact}
                              </StatusBadge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                          <div className="p-3 rounded-lg border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Level</p>
                            {risk.residualLevel ? (
                              <StatusBadge variant={levelVariant[risk.residualLevel]}>{risk.residualLevel}</StatusBadge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {risk.treatmentPlan && (
                <Card>
                  <CardHeader>
                    <CardTitle>Treatment Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{risk.treatmentPlan}</p>
                    {risk.treatmentDueDate && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Due: {format(new Date(risk.treatmentDueDate), "PPP")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="assessment" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Matrix</CardTitle>
                  <CardDescription>Visual representation of risk assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 gap-1 text-xs">
                    <div />
                    {riskLikelihoodValues.map(l => (
                      <div key={`head-${l}`} className="text-center p-2 font-medium">
                        {likelihoodLabels[l]}
                      </div>
                    ))}

                    {[...riskImpactValues].reverse().map(impact => (
                      <div key={`row-${impact}`} className="contents">
                        <div className="p-2 font-medium">{impactLabels[impact]}</div>
                        {riskLikelihoodValues.map(likelihood => {
                          const level = levelFromScores(likelihood, impact)
                          const isCurrent =
                            risk.inherentLikelihood === likelihood &&
                            risk.inherentImpact === impact
                          return (
                            <div
                              key={`cell-${likelihood}-${impact}`}
                              className={`p-2 rounded text-center ${matrixCellClass[level]} ${isCurrent ? "ring-2 ring-primary" : ""}`}
                            >
                              {matrixCellLabel[level]}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Likelihood (horizontal) × Impact (vertical)
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="controls" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mitigating Controls</CardTitle>
                  <CardDescription>
                    Controls linked to this risk. Linking a control marks it as a mitigation in your risk register.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mitigatingControls.length > 0 ? (
                    mitigatingControls.map((mc) => (
                      <div
                        key={mc.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <Link
                          href={`/security/controls/${mc.controlId}`}
                          className="flex-1 min-w-0 hover:underline"
                        >
                          <p className="font-medium truncate">{mc.controlIdCode}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {mc.controlTitle}
                          </p>
                        </Link>
                        <div className="flex items-center gap-2 ml-3">
                          <StatusBadge
                            variant={
                              mc.implementationStatus === "effective"
                                ? "success"
                                : mc.implementationStatus === "implemented"
                                  ? "info"
                                  : "warning"
                            }
                          >
                            {mc.implementationStatus}
                          </StatusBadge>
                          <Protected module="security.risks" anyAction={["edit", "write"]}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => handleUnlinkControl(mc.controlId)}
                              disabled={unlinkControl.isPending}
                              aria-label="Unlink control"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </Protected>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No controls linked to this risk yet.
                    </p>
                  )}
                  <Protected module="security.risks" anyAction={["edit", "write"]}>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={() => {
                        setControlSearch("")
                        setLinkOpen(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Link Controls
                    </Button>
                  </Protected>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk History</CardTitle>
                  <CardDescription>Timeline of changes to this risk</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Risk updated</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(risk.updatedAt), "PPP")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="text-sm">Risk created</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(risk.createdAt), "PPP")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <FormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Risk"
        description="Update risk details"
        schema={editFormSchema}
        config={editFormConfigWithOwner}
        fields={["title", "description", "category", "ownerId", "inherentLikelihood", "inherentImpact", "residualLikelihood", "residualImpact", "status", "treatment", "treatmentPlan"]}
        mode="edit"
        defaultValues={{
          title: risk.title,
          description: risk.description || "",
          category: risk.category,
          inherentLikelihood: risk.inherentLikelihood,
          inherentImpact: risk.inherentImpact,
          residualLikelihood: risk.residualLikelihood || undefined,
          residualImpact: risk.residualImpact || undefined,
          status: risk.status,
          treatment: risk.treatment || undefined,
          treatmentPlan: risk.treatmentPlan || "",
          ownerId: risk.ownerId || "__unassigned__",
        }}
        onSubmit={handleUpdate}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Controls</DialogTitle>
            <DialogDescription>
              Pick a control to link as a mitigation for this risk. Linked controls show in the
              Controls tab and contribute to the risk&apos;s residual assessment.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search by control ID or title..."
            value={controlSearch}
            onChange={(e) => setControlSearch(e.target.value)}
          />

          <div className="max-h-80 overflow-y-auto space-y-2 -mx-6 px-6">
            {linkableControls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {controls.length === 0
                  ? "No controls have been created yet. Add controls in Security → Controls first."
                  : controls.length === linkedControlIds.size
                    ? "All available controls are already linked to this risk."
                    : "No controls match your search."}
              </p>
            ) : (
              linkableControls.map((control) => (
                <div
                  key={control.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{control.controlId}</p>
                    <p className="text-sm text-muted-foreground truncate">{control.title}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkControl(control.id)}
                    disabled={linkControl.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Risk</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{risk.riskId} - {risk.title}</strong>?
              This will also remove all links to controls and audit history for this risk.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteRisk.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRisk.isPending ? "Deleting..." : "Delete Risk"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
