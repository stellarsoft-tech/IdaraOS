"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft,
  Pencil,
  Trash2,
  HardDrive,
  Box,
  Laptop,
  Monitor,
  Phone,
  Tablet,
  UserPlus,
  UserMinus,
  Calendar,
  MapPin,
  Tag,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Wrench,
  History,
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { useBreadcrumbLabel } from "@/components/breadcrumb-context"
import { usePeopleList } from "@/lib/api/people"
import { z } from "zod"

// API hooks
import { 
  useAssetDetail,
  useUpdateAsset,
  useDeleteAsset,
  useAssignAsset,
  useReturnAsset,
  useAssignmentsList,
  useMaintenanceList,
  useCategoriesList,
  type UpdateAsset,
} from "@/lib/api/assets"

// Icon mapping
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  laptops: Laptop,
  desktop: Monitor,
  desktops: Monitor,
  monitor: Monitor,
  monitors: Monitor,
  phone: Phone,
  phones: Phone,
  tablet: Tablet,
  tablets: Tablet,
  default: Box,
}

function getCategoryIcon(categorySlug?: string | null): React.ComponentType<{ className?: string }> {
  if (!categorySlug) return Box
  const key = categorySlug.toLowerCase()
  return categoryIcons[key] || categoryIcons.default
}

// Status badge colors - using available Badge variants
const statusVariants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  available: "default",
  assigned: "secondary",
  maintenance: "outline",
  retired: "secondary",
  disposed: "destructive",
}

// Edit form schema
const editAssetSchema = z.object({
  assetTag: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(["available", "assigned", "maintenance", "retired", "disposed"]).optional(),
  serialNumber: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.string().optional().nullable(),
  warrantyEnd: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  assignedAt: z.string().optional().nullable(),
})

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AssetDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const canAccess = useCanAccess("assets.inventory")
  const canEdit = usePermission("assets.inventory", "edit")
  const canDelete = usePermission("assets.inventory", "delete")
  const router = useRouter()
  
  // State
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState<string>("")
  const [assignNotes, setAssignNotes] = useState<string>("")
  const [returnNotes, setReturnNotes] = useState<string>("")
  
  // Fetch data
  const { data: asset, isLoading, error } = useAssetDetail(id)
  const { data: categories = [] } = useCategoriesList()
  const { data: people = [] } = usePeopleList()
  const { data: assignments = [] } = useAssignmentsList({ assetId: id, includeReturned: true })
  const { data: maintenanceRecords = [] } = useMaintenanceList({ assetId: id })
  
  // Set breadcrumb label to asset name
  useBreadcrumbLabel(asset?.name)
  
  // Mutations
  const updateMutation = useUpdateAsset()
  const deleteMutation = useDeleteAsset()
  const assignMutation = useAssignAsset()
  const returnMutation = useReturnAsset()
  
  // Determine if asset is Intune-synced with sync enabled
  const isIntuneSynced = asset?.source === "intune_sync" && asset?.syncEnabled
  
  // Form config with sync indicators for Intune-managed fields
  const formConfig = {
    assetTag: { 
      component: "input" as const, 
      label: "Asset Tag", 
      placeholder: "e.g., LAP-001",
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
    },
    name: { 
      component: "input" as const, 
      label: "Name", 
      placeholder: "e.g., MacBook Pro 16",
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
    },
    description: { component: "textarea" as const, label: "Description", placeholder: "Asset description" },
    categoryId: { 
      component: "select" as const,
      label: "Category", 
      placeholder: "Select category", 
      options: categories.map(c => ({ value: c.id, label: c.name })),
    },
    status: { 
      component: "select" as const,
      label: "Status", 
      options: [
        { value: "available", label: "Available" },
        { value: "assigned", label: "Assigned" },
        { value: "maintenance", label: "Maintenance" },
        { value: "retired", label: "Retired" },
        { value: "disposed", label: "Disposed" },
      ]
    },
    serialNumber: { 
      component: "input" as const, 
      label: "Serial Number", 
      placeholder: "Manufacturer serial",
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
    },
    manufacturer: { 
      component: "input" as const, 
      label: "Manufacturer", 
      placeholder: "e.g., Apple, Dell",
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
    },
    model: { 
      component: "input" as const, 
      label: "Model", 
      placeholder: "Model name/number",
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
    },
    purchaseDate: { component: "date-picker" as const, label: "Purchase Date" },
    purchaseCost: { component: "input" as const, label: "Purchase Cost", placeholder: "0.00" },
    warrantyEnd: { component: "date-picker" as const, label: "Warranty End" },
    location: { component: "input" as const, label: "Location", placeholder: "e.g., HQ, Remote" },
    notes: { component: "textarea" as const, label: "Notes", placeholder: "Additional notes" },
    assignedToId: { 
      component: "select" as const,
      label: "Assigned To", 
      placeholder: "Select a person...", 
      options: [
        { value: "__none__", label: "Unassigned" },
        ...people.filter(p => p.status === "active").map(p => ({ value: p.id, label: `${p.name} (${p.email})` })),
      ],
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
      helpText: isIntuneSynced 
        ? "Managed by Intune sync based on device user" 
        : "Select who this asset is assigned to",
    },
    assignedAt: { 
      component: "date-picker" as const, 
      label: "Assigned Date",
      syncIndicator: isIntuneSynced ? "intune" as const : undefined,
      helpText: isIntuneSynced 
        ? "Set from Intune device enrollment date" 
        : "When was this asset assigned",
    },
  }
  
  // Show assignment fields only when status is "assigned" or asset is already assigned
  const showAssignmentFields = asset?.status === "assigned" || asset?.assignedToId
  
  const editFields = [
    "assetTag", "name", "description", "categoryId", "status",
    "serialNumber", "manufacturer", "model",
    "purchaseDate", "purchaseCost", "warrantyEnd",
    "location", 
    ...(showAssignmentFields ? ["assignedToId", "assignedAt"] : []),
    "notes"
  ]
  
  // Handlers
  const handleEdit = async (values: UpdateAsset) => {
    if (!asset) return
    try {
      // Convert "__none__" to null for assignedToId
      const processedValues = {
        ...values,
        assignedToId: values.assignedToId === "__none__" ? null : values.assignedToId,
      }
      await updateMutation.mutateAsync({ id: asset.id, data: processedValues })
      toast.success("Asset updated successfully")
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update asset")
    }
  }
  
  const handleDelete = async () => {
    if (!asset) return
    try {
      await deleteMutation.mutateAsync(asset.id)
      toast.success(`Asset ${asset.assetTag} has been deleted`)
      router.push("/assets/inventory")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete asset")
    }
  }
  
  const handleAssign = async () => {
    if (!asset || !selectedPersonId) return
    try {
      const result = await assignMutation.mutateAsync({ 
        id: asset.id, 
        personId: selectedPersonId,
        notes: assignNotes || undefined,
      })
      toast.success(result.message)
      setAssignOpen(false)
      setSelectedPersonId("")
      setAssignNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign asset")
    }
  }
  
  const handleReturn = async () => {
    if (!asset) return
    try {
      const result = await returnMutation.mutateAsync({ 
        id: asset.id,
        notes: returnNotes || undefined,
      })
      toast.success(result.message)
      setReturnOpen(false)
      setReturnNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return asset")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Asset Details">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view this asset." 
        />
      </PageShell>
    )
  }

  if (isLoading) {
    return (
      <PageShell title="Asset Details">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    )
  }

  if (error || !asset) {
    return (
      <PageShell title="Asset Details">
        <div className="flex flex-col items-center justify-center h-64">
          <HardDrive className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Asset not found</h3>
          <p className="text-muted-foreground mt-2 mb-4">
            The asset you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Button variant="outline" onClick={() => router.push("/assets/inventory")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Button>
        </div>
      </PageShell>
    )
  }
  
  const Icon = getCategoryIcon(asset.category?.slug)
  const isAssigned = asset.status === "assigned" && asset.assignedToId
  const warrantyExpired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date()

  return (
    <PageShell
      title={asset.name}
      description={`${asset.assetTag} • ${asset.category?.name || "Uncategorized"}`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/assets/inventory")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {canEdit && (
            <>
              {isAssigned ? (
                <Button variant="outline" onClick={() => setReturnOpen(true)}>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Return
                </Button>
              ) : asset.status === "available" ? (
                <Button variant="outline" onClick={() => setAssignOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign
                </Button>
              ) : null}
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
        </Button>
          )}
      </div>
      }
    >
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center">
                <Icon className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">{asset.name}</h2>
                  <Badge variant={statusVariants[asset.status] || "default"}>
                {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                  </Badge>
                  {asset.source === "intune_sync" && (
                    <Badge className="gap-1 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-0">
                      <RefreshCw className="h-3 w-3" />
                      Intune Sync
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    <span>{asset.assetTag}</span>
            </div>
                  {asset.model && (
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4" />
                      <span>{asset.manufacturer ? `${asset.manufacturer} ` : ""}{asset.model}</span>
              </div>
                  )}
                  {asset.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                <span>{asset.location}</span>
              </div>
                  )}
                  {asset.warrantyEnd && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className={warrantyExpired ? "text-destructive" : ""}>
                        Warranty: {new Date(asset.warrantyEnd).toLocaleDateString()}
                        {warrantyExpired && " (Expired)"}
                      </span>
                    </div>
                  )}
                </div>
                {asset.assignedTo && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Assigned to:</span>
                    <Link 
                      href={`/people/directory/${asset.assignedTo.slug}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {asset.assignedTo.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      ({asset.assignedTo.email})
                </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance ({maintenanceRecords.length})</TabsTrigger>
            {asset.source === "intune_sync" && (
              <TabsTrigger value="intune">Intune Info</TabsTrigger>
            )}
            </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Specifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Specifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                      <div className="text-muted-foreground">Serial Number</div>
                      <div className="font-medium">{asset.serialNumber || "—"}</div>
                  </div>
                  <div>
                      <div className="text-muted-foreground">Manufacturer</div>
                      <div className="font-medium">{asset.manufacturer || "—"}</div>
                  </div>
                  <div>
                      <div className="text-muted-foreground">Model</div>
                      <div className="font-medium">{asset.model || "—"}</div>
                  </div>
                  <div>
                      <div className="text-muted-foreground">Category</div>
                      <div className="font-medium">{asset.category?.name || "Uncategorized"}</div>
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Purchase & Warranty</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Purchase Date</div>
                      <div className="font-medium">
                        {asset.purchaseDate 
                          ? new Date(asset.purchaseDate).toLocaleDateString() 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Purchase Cost</div>
                      <div className="font-medium">
                        {asset.purchaseCost 
                          ? `$${parseFloat(asset.purchaseCost).toLocaleString()}` 
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Warranty End</div>
                      <div className={`font-medium ${warrantyExpired ? "text-destructive" : ""}`}>
                        {asset.warrantyEnd 
                          ? new Date(asset.warrantyEnd).toLocaleDateString() 
                          : "—"}
                        {warrantyExpired && " (Expired)"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Location</div>
                      <div className="font-medium">{asset.location || "—"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Notes */}
              {asset.notes && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{asset.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
            </TabsContent>

          <TabsContent value="assignments" className="mt-6">
              <Card>
                <CardHeader>
                <CardTitle className="text-base">Assignment History</CardTitle>
                <CardDescription>
                  A complete history of who this asset has been assigned to.
                </CardDescription>
                </CardHeader>
                <CardContent>
                {assignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="mx-auto h-8 w-8 mb-2" />
                    <p>No assignment history</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-start gap-4 p-4 rounded-lg border">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          assignment.returnedAt ? "bg-muted" : "bg-green-100 dark:bg-green-900/30"
                        }`}>
                          {assignment.returnedAt ? (
                            <UserMinus className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link 
                              href={`/people/directory/${assignment.person.slug}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {assignment.person.name}
                            </Link>
                            {!assignment.returnedAt && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                            {assignment.assignedBy && ` by ${assignment.assignedBy.name}`}
                          </div>
                          {assignment.returnedAt && (
                            <div className="text-sm text-muted-foreground">
                              Returned: {new Date(assignment.returnedAt).toLocaleDateString()}
                            </div>
                          )}
                          {assignment.notes && (
                            <p className="text-sm text-muted-foreground mt-2 italic">
                              {assignment.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="maintenance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Maintenance Records</CardTitle>
                <CardDescription>
                  Repair tickets and scheduled maintenance for this asset.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {maintenanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="mx-auto h-8 w-8 mb-2" />
                    <p>No maintenance records</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {maintenanceRecords.map((record) => (
                      <div key={record.id} className="flex items-start gap-4 p-4 rounded-lg border">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          record.status === "completed" 
                            ? "bg-green-100 dark:bg-green-900/30"
                            : record.status === "in_progress"
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "bg-muted"
                        }`}>
                          {record.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : record.status === "in_progress" ? (
                            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{record.type}</span>
                            <Badge variant={
                              record.status === "completed" ? "default" :
                              record.status === "in_progress" ? "secondary" :
                              record.status === "cancelled" ? "destructive" :
                              "outline"
                            } className="text-xs capitalize">
                              {record.status.replace("_", " ")}
                            </Badge>
                          </div>
                          {record.description && (
                            <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                          )}
                          <div className="text-sm text-muted-foreground mt-2 space-y-1">
                            {record.scheduledDate && (
                              <div>Scheduled: {new Date(record.scheduledDate).toLocaleDateString()}</div>
                            )}
                            {record.completedDate && (
                              <div>Completed: {new Date(record.completedDate).toLocaleDateString()}</div>
                            )}
                            {record.cost && <div>Cost: ${parseFloat(record.cost).toLocaleString()}</div>}
                            {record.vendor && <div>Vendor: {record.vendor}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </CardContent>
              </Card>
            </TabsContent>

          {asset.source === "intune_sync" && (
            <TabsContent value="intune" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Microsoft Intune Information
                  </CardTitle>
                  <CardDescription>
                    This device is synced from Microsoft Intune.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Intune Device ID</div>
                      <div className="font-medium text-xs">
                        {asset.intuneDeviceId || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Compliance State</div>
                      <div className="flex items-center gap-2">
                        {asset.intuneComplianceState === "compliant" ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-600">Compliant</span>
                          </>
                        ) : asset.intuneComplianceState === "noncompliant" ? (
                          <>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="font-medium text-destructive">Non-Compliant</span>
                          </>
                        ) : (
                          <span className="font-medium text-muted-foreground">
                            {asset.intuneComplianceState || "Unknown"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Enrollment Type</div>
                      <div className="font-medium capitalize">
                        {asset.intuneEnrollmentType?.replace(/([A-Z])/g, " $1").trim() || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Last Synced</div>
                      <div className="font-medium">
                        {asset.intuneLastSyncAt 
                          ? new Date(asset.intuneLastSyncAt).toLocaleString() 
                          : "Never"}
                      </div>
                    </div>
                  </div>
                  
                  {asset.syncEnabled && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                        <RefreshCw className="h-4 w-4" />
                        <span>Sync is enabled. Changes from Intune will overwrite local data.</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          </Tabs>
      </div>
      
      {/* Edit Drawer */}
      <FormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Edit ${asset.name}`}
        description={asset.source === "intune_sync" && asset.syncEnabled
          ? "Some fields are managed by Intune sync"
          : "Update asset information"
        }
        schema={editAssetSchema}
        config={formConfig}
        fields={editFields}
        mode="edit"
        defaultValues={{
          assetTag: asset.assetTag,
          name: asset.name,
          description: asset.description || "",
          categoryId: asset.categoryId || "",
          status: asset.status,
          serialNumber: asset.serialNumber || "",
          manufacturer: asset.manufacturer || "",
          model: asset.model || "",
          purchaseDate: asset.purchaseDate || "",
          purchaseCost: asset.purchaseCost || "",
          warrantyEnd: asset.warrantyEnd || "",
          location: asset.location || "",
          notes: asset.notes || "",
          assignedToId: asset.assignedToId || "__none__",
          assignedAt: asset.assignedAt || "",
        }}
        onSubmit={handleEdit}
        disabledFields={
          asset.source === "intune_sync" && asset.syncEnabled
            ? ["assetTag", "name", "serialNumber", "manufacturer", "model", "assignedToId", "assignedAt"]
            : []
        }
        infoBanner={
          asset.source === "intune_sync" && asset.syncEnabled ? (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300 text-sm">
                <RefreshCw className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Synced from Microsoft Intune</span>
                  <p className="text-blue-600 dark:text-blue-400 mt-0.5">
                    Fields marked with a lock icon are managed by Intune and cannot be edited here.
                    Changes will be overwritten on the next sync.
                  </p>
                </div>
              </div>
            </div>
          ) : undefined
        }
      />
      
      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {asset.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset
              record and remove all associated data including assignment history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>
              Assign {asset.name} ({asset.assetTag}) to a person.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Person</Label>
              <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a person..." />
                </SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.status === "active").map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      <div className="flex flex-col">
                        <span>{person.name}</span>
                        <span className="text-xs text-muted-foreground">{person.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about this assignment..."
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedPersonId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>
              Return {asset.name} ({asset.assetTag}) from {asset.assignedTo?.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isIntuneSynced && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Intune Sync Warning</AlertTitle>
                <AlertDescription>
                  This asset is synced from Microsoft Intune. After returning it here, you must also manually unassign the device from the user in Intune. Otherwise, the next sync will automatically re-assign it to the same person.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about this return..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending ? "Returning..." : "Return Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
