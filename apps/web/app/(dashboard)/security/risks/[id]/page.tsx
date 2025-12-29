"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Calendar, Pencil, Shield, User, Clock } from "lucide-react"
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
import { useSecurityRisk, useUpdateSecurityRisk, useSecurityControls } from "@/lib/api/security"
import { toast } from "sonner"

const levelVariant: Record<string, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger",
}

// Edit form schema
const editFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.enum(["operational", "compliance", "strategic", "financial", "reputational", "technical"]),
  inherentLikelihood: z.enum(["low", "medium", "high"]),
  inherentImpact: z.enum(["low", "medium", "high"]),
  residualLikelihood: z.enum(["low", "medium", "high"]).optional(),
  residualImpact: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["open", "mitigating", "accepted", "closed"]),
  treatment: z.enum(["mitigate", "accept", "transfer", "avoid"]).optional(),
  treatmentPlan: z.string().optional(),
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
    options: [
      { value: "operational", label: "Operational" },
      { value: "compliance", label: "Compliance" },
      { value: "strategic", label: "Strategic" },
      { value: "financial", label: "Financial" },
      { value: "reputational", label: "Reputational" },
      { value: "technical", label: "Technical" },
    ],
    required: true,
  },
  inherentLikelihood: {
    component: "select" as const,
    label: "Inherent Likelihood",
    placeholder: "Select likelihood",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    required: true,
  },
  inherentImpact: {
    component: "select" as const,
    label: "Inherent Impact",
    placeholder: "Select impact",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    required: true,
  },
  residualLikelihood: {
    component: "select" as const,
    label: "Residual Likelihood",
    placeholder: "Select residual likelihood",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
  },
  residualImpact: {
    component: "select" as const,
    label: "Residual Impact",
    placeholder: "Select residual impact",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
  },
  status: {
    component: "select" as const,
    label: "Status",
    placeholder: "Select status",
    options: [
      { value: "open", label: "Open" },
      { value: "mitigating", label: "Mitigating" },
      { value: "accepted", label: "Accepted" },
      { value: "closed", label: "Closed" },
    ],
    required: true,
  },
  treatment: {
    component: "select" as const,
    label: "Treatment Strategy",
    placeholder: "Select treatment",
    options: [
      { value: "mitigate", label: "Mitigate" },
      { value: "accept", label: "Accept" },
      { value: "transfer", label: "Transfer" },
      { value: "avoid", label: "Avoid" },
    ],
  },
  treatmentPlan: {
    component: "textarea" as const,
    label: "Treatment Plan",
    placeholder: "Describe the treatment plan",
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
  
  const { data: riskData, isLoading, error } = useSecurityRisk(id)
  const { data: controlsData } = useSecurityControls({ limit: 50 })
  const updateRisk = useUpdateSecurityRisk()
  
  const risk = riskData?.data
  const controls = controlsData?.data || []
  
  // Get related controls (for now, just show first 3 controls)
  const relatedControls = controls.slice(0, 3)
  
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
              <Protected module="security.risks" action="write">
                <Button 
                  className="flex-1 bg-transparent" 
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Risk
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
                          <StatusBadge variant={levelVariant[risk.inherentLikelihood]}>{risk.inherentLikelihood}</StatusBadge>
                        </div>
                        <div className="p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Impact</p>
                          <StatusBadge variant={levelVariant[risk.inherentImpact]}>{risk.inherentImpact}</StatusBadge>
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
                              <StatusBadge variant={levelVariant[risk.residualLikelihood]}>{risk.residualLikelihood}</StatusBadge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                          <div className="p-3 rounded-lg border text-center">
                            <p className="text-xs text-muted-foreground mb-1">Impact</p>
                            {risk.residualImpact ? (
                              <StatusBadge variant={levelVariant[risk.residualImpact]}>{risk.residualImpact}</StatusBadge>
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
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    <div />
                    <div className="text-center p-2 font-medium">Low</div>
                    <div className="text-center p-2 font-medium">Medium</div>
                    <div className="text-center p-2 font-medium">High</div>

                    <div className="p-2 font-medium">High</div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "low" && risk.inherentImpact === "high" ? "ring-2 ring-primary" : ""} bg-yellow-100 dark:bg-yellow-900/30`}
                    >
                      Medium
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "medium" && risk.inherentImpact === "high" ? "ring-2 ring-primary" : ""} bg-red-100 dark:bg-red-900/30`}
                    >
                      High
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "high" && risk.inherentImpact === "high" ? "ring-2 ring-primary" : ""} bg-red-200 dark:bg-red-900/50`}
                    >
                      Critical
                    </div>

                    <div className="p-2 font-medium">Medium</div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "low" && risk.inherentImpact === "medium" ? "ring-2 ring-primary" : ""} bg-green-100 dark:bg-green-900/30`}
                    >
                      Low
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "medium" && risk.inherentImpact === "medium" ? "ring-2 ring-primary" : ""} bg-yellow-100 dark:bg-yellow-900/30`}
                    >
                      Medium
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "high" && risk.inherentImpact === "medium" ? "ring-2 ring-primary" : ""} bg-red-100 dark:bg-red-900/30`}
                    >
                      High
                    </div>

                    <div className="p-2 font-medium">Low</div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "low" && risk.inherentImpact === "low" ? "ring-2 ring-primary" : ""} bg-green-50 dark:bg-green-900/20`}
                    >
                      Low
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "medium" && risk.inherentImpact === "low" ? "ring-2 ring-primary" : ""} bg-green-100 dark:bg-green-900/30`}
                    >
                      Low
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.inherentLikelihood === "high" && risk.inherentImpact === "low" ? "ring-2 ring-primary" : ""} bg-yellow-100 dark:bg-yellow-900/30`}
                    >
                      Medium
                    </div>
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
                  <CardTitle>Related Controls</CardTitle>
                  <CardDescription>Controls that mitigate this risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {relatedControls.length > 0 ? (
                    relatedControls.map((control) => (
                      <div key={control.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{control.controlId}</p>
                          <p className="text-sm text-muted-foreground">{control.title}</p>
                        </div>
                        <StatusBadge
                          variant={
                            control.implementationStatus === "effective"
                              ? "success"
                              : control.implementationStatus === "implemented"
                                ? "info"
                                : "warning"
                          }
                        >
                          {control.implementationStatus}
                        </StatusBadge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No controls linked to this risk yet.
                    </p>
                  )}
                  <Button variant="outline" className="w-full bg-transparent">
                    Link Controls
                  </Button>
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
        config={editFormConfig}
        fields={["title", "description", "category", "inherentLikelihood", "inherentImpact", "residualLikelihood", "residualImpact", "status", "treatment", "treatmentPlan"]}
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
        }}
        onSubmit={handleUpdate}
      />
    </div>
  )
}
