"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  MoreHorizontal, 
  Pencil, 
  Plus, 
  Trash2, 
  HardDrive, 
  Box, 
  CheckCircle, 
  Wrench,
  UserPlus,
  UserMinus,
  Laptop,
  Monitor,
  Phone,
  Tablet,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Badge } from "@/components/ui/badge"
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
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { usePeopleList } from "@/lib/api/people"
import { z } from "zod"

// API hooks
import { 
  useAssetsList, 
  useCreateAsset, 
  useUpdateAsset, 
  useDeleteAsset,
  useAssignAsset,
  useReturnAsset,
  useCategoriesList,
  type Asset,
  type CreateAsset,
  type UpdateAsset,
} from "@/lib/api/assets"

// Icon mapping for asset categories
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

// Form schemas
const createAssetSchema = z.object({
  assetTag: z.string().min(1, "Asset tag is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(["available", "assigned", "maintenance", "retired", "disposed"]).default("available"),
  serialNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.string().optional(),
  warrantyEnd: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
})

const editAssetSchema = createAssetSchema.partial()

// Form configuration for FormDrawer
const formConfig = {
  assetTag: { component: "input" as const, label: "Asset Tag", placeholder: "e.g., LAP-001" },
  name: { component: "input" as const, label: "Name", placeholder: "e.g., MacBook Pro 16" },
  description: { component: "textarea" as const, label: "Description", placeholder: "Asset description" },
  categoryId: { component: "select" as const, label: "Category", placeholder: "Select category", options: [] as { value: string; label: string }[] },
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
  serialNumber: { component: "input" as const, label: "Serial Number", placeholder: "Manufacturer serial" },
  manufacturer: { component: "input" as const, label: "Manufacturer", placeholder: "e.g., Apple, Dell" },
  model: { component: "input" as const, label: "Model", placeholder: "Model name/number" },
  purchaseDate: { component: "date-picker" as const, label: "Purchase Date" },
  purchaseCost: { component: "input" as const, label: "Purchase Cost", placeholder: "0.00" },
  warrantyEnd: { component: "date-picker" as const, label: "Warranty End" },
  location: { component: "input" as const, label: "Location", placeholder: "e.g., HQ, Remote" },
  notes: { component: "textarea" as const, label: "Notes", placeholder: "Additional notes" },
}

const createFields = [
  "assetTag", "name", "description", "categoryId", "status",
  "serialNumber", "manufacturer", "model",
  "purchaseDate", "purchaseCost", "warrantyEnd",
  "location", "notes"
]

const editFields = createFields

// Stats card component
interface StatsCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  loading?: boolean
}

function StatsCard({ title, value, subtitle, icon, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function InventoryPage() {
  const canAccess = useCanAccess("assets.inventory")
  const canEdit = usePermission("assets.inventory", "edit")
  const canDelete = usePermission("assets.inventory", "delete")
  const router = useRouter()
  
  // State
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string>("")
  const [assignNotes, setAssignNotes] = useState<string>("")
  const [returnNotes, setReturnNotes] = useState<string>("")
  
  // Fetch data
  const { data: assets = [], isLoading, error } = useAssetsList()
  const { data: categories = [] } = useCategoriesList()
  const { data: people = [] } = usePeopleList()
  
  // Mutations
  const createMutation = useCreateAsset()
  const updateMutation = useUpdateAsset()
  const deleteMutation = useDeleteAsset()
  const assignMutation = useAssignAsset()
  const returnMutation = useReturnAsset()
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = assets.length
    const available = assets.filter(a => a.status === "available").length
    const assigned = assets.filter(a => a.status === "assigned").length
    const maintenance = assets.filter(a => a.status === "maintenance").length
    
    return { total, available, assigned, maintenance }
  }, [assets])
  
  // Form config with dynamic categories
  const dynamicFormConfig = useMemo(() => ({
    ...formConfig,
    categoryId: {
      ...formConfig.categoryId,
      options: categories.map(c => ({ value: c.id, label: c.name })),
    },
  }), [categories])
  
  // Table columns
  const columns: ColumnDef<Asset>[] = [
    {
      id: "assetTag",
      header: "Asset Tag",
      accessorKey: "assetTag",
      cell: ({ row }) => {
        const asset = row.original
        const Icon = getCategoryIcon(asset.category?.slug)
      return (
        <div className="flex items-center gap-3"> 
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium">{asset.assetTag}</span>
        </div>
      )
      },
      enableSorting: true,
      size: 150,
    },
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      enableSorting: true,
      size: 200,
    },
    {
      id: "category",
      header: "Category",
      accessorFn: (row) => row.category?.name,
      cell: ({ row }) => {
        const category = row.original.category
        if (!category) return <span className="text-muted-foreground">—</span>
        return (
          <Badge 
            variant="outline" 
            className="text-xs"
            style={{ 
              borderColor: category.color ? `var(--${category.color})` : undefined,
            }}
          >
            {category.name}
          </Badge>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 120,
    },
    {
      id: "model",
      header: "Model",
      accessorKey: "model",
      cell: ({ row }) => row.original.model || <span className="text-muted-foreground">—</span>,
      enableSorting: true,
      size: 150,
    },
    {
      id: "assignedTo",
      header: "Assigned To",
      accessorFn: (row) => row.assignedTo?.name,
      cell: ({ row }) => {
        const assignee = row.original.assignedTo
        if (!assignee) return <span className="text-muted-foreground">Unassigned</span>
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/people/directory/${assignee.slug}`)
            }}
            className="text-sm text-primary hover:underline truncate max-w-[150px]"
            title={assignee.name}
          >
            {assignee.name}
          </button>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 150,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.original.status
      return (
          <Badge variant={statusVariants[status] || "default"}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 100,
    },
    {
      id: "location",
      header: "Location",
      accessorKey: "location",
      cell: ({ row }) => row.original.location || <span className="text-muted-foreground">—</span>,
      enableSorting: true,
      enableColumnFilter: true,
      size: 100,
    },
    {
      id: "warrantyEnd",
      header: "Warranty End",
      accessorKey: "warrantyEnd",
      cell: ({ row }) => {
        const warranty = row.original.warrantyEnd
        if (!warranty) return <span className="text-muted-foreground">—</span>
        const date = new Date(warranty)
      const isExpired = date < new Date()
        return (
          <span className={isExpired ? "text-destructive" : ""}>
            {date.toLocaleDateString()}
          </span>
        )
      },
      enableSorting: true,
      size: 120,
    },
    {
      id: "assignedAt",
      header: "Assigned",
      accessorKey: "assignedAt",
      cell: ({ row }) => {
        const date = row.original.assignedAt
        if (!date) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm">
            {new Date(date).toLocaleDateString()}
          </span>
        )
      },
      enableSorting: true,
      size: 100,
    },
    {
      id: "source",
      header: "Source",
      accessorKey: "source",
      cell: ({ row }) => {
        const source = row.original.source
        if (source === "intune_sync") {
          return (
            <Badge className="gap-1 text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-0">
              <RefreshCw className="h-3 w-3" />
              Intune
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="text-xs">
            Manual
          </Badge>
        )
      },
      enableColumnFilter: true,
      size: 100,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const asset = row.original
        const isAssigned = asset.status === "assigned" && asset.assignedToId
        
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault()
                  router.push(`/assets/inventory/${asset.id}`)
                }}
              >
                View details
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => { 
                      e.preventDefault()
                      setSelectedAsset(asset)
                      setEditOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {isAssigned ? (
                    <DropdownMenuItem 
                      onSelect={(e) => { 
                        e.preventDefault()
                        setSelectedAsset(asset)
                        setReturnNotes("")
                        setReturnOpen(true)
                      }}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Return Asset
                    </DropdownMenuItem>
                  ) : asset.status === "available" ? (
                    <DropdownMenuItem 
                      onSelect={(e) => { 
                        e.preventDefault()
                        setSelectedAsset(asset)
                        setSelectedPersonId("")
                        setAssignNotes("")
                        setAssignOpen(true)
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign to Person
                    </DropdownMenuItem>
                  ) : null}
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => { 
                      e.preventDefault()
                      setSelectedAsset(asset)
                      setDeleteOpen(true)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      size: 50,
    },
  ]
  
  // Handlers
  const handleCreate = async (values: CreateAsset) => {
    try {
      const asset = await createMutation.mutateAsync(values)
      toast.success(`Asset ${asset.assetTag} has been created`)
      setCreateOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create asset")
    }
  }
  
  const handleEdit = async (values: UpdateAsset) => {
    if (!selectedAsset) return
    try {
      await updateMutation.mutateAsync({ id: selectedAsset.id, data: values })
      toast.success("Asset updated successfully")
      setEditOpen(false)
      setSelectedAsset(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update asset")
    }
  }
  
  const handleDelete = async () => {
    if (!selectedAsset) return
    try {
      await deleteMutation.mutateAsync(selectedAsset.id)
      toast.success(`Asset ${selectedAsset.assetTag} has been deleted`)
      setDeleteOpen(false)
      setSelectedAsset(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete asset")
    }
  }
  
  const handleAssign = async () => {
    if (!selectedAsset || !selectedPersonId) return
    try {
      const result = await assignMutation.mutateAsync({ 
        id: selectedAsset.id, 
        personId: selectedPersonId,
        notes: assignNotes || undefined,
      })
      toast.success(result.message)
      setAssignOpen(false)
      setSelectedAsset(null)
      setSelectedPersonId("")
      setAssignNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign asset")
    }
  }
  
  const handleReturn = async () => {
    if (!selectedAsset) return
    try {
      const result = await returnMutation.mutateAsync({ 
        id: selectedAsset.id,
        notes: returnNotes || undefined,
      })
      toast.success(result.message)
      setReturnOpen(false)
      setSelectedAsset(null)
      setReturnNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return asset")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Inventory">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the asset inventory." 
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Inventory"
        description="View and manage all assets in your organization."
      >
        <div className="flex items-center justify-center h-64 text-destructive">
          Failed to load asset inventory
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Asset Inventory"
      description="View and manage all hardware assets in your organization."
      action={
        <Protected module="assets.inventory" action="create">
          <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Assets"
            value={stats.total}
            subtitle="in your inventory"
            icon={<HardDrive className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Available"
            value={stats.available}
            subtitle="ready for assignment"
            icon={<Box className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Assigned"
            value={stats.assigned}
            subtitle="currently in use"
            icon={<CheckCircle className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Maintenance"
            value={stats.maintenance}
            subtitle="under repair"
            icon={<Wrench className="h-4 w-4" />}
            loading={isLoading}
          />
        </div>

        {/* Assets Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Assets</CardTitle>
            <CardDescription>
              A complete list of assets with their status, location, and assignments.
            </CardDescription>
          </CardHeader>
          <CardContent>
      <DataTable
              columns={columns}
        data={assets}
              loading={isLoading}
              searchKey="name"
              searchPlaceholder="Search by name, tag, or model..."
        onRowClick={(asset) => router.push(`/assets/inventory/${asset.id}`)}
              facetedFilters={{
                status: { type: "enum" },
                location: { type: "enum" },
                category: { type: "enum" },
              }}
              enableColumnFilters
              enableSorting
              enableExport
              enableColumnVisibility
              emptyState={
                <div className="text-center py-12">
                  <HardDrive className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No assets found</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Get started by adding your first asset.
                  </p>
                  <Protected module="assets.inventory" action="create">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first asset
                    </Button>
                  </Protected>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Create Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Asset"
        description="Create a new asset record"
        schema={createAssetSchema}
        config={dynamicFormConfig}
        fields={createFields}
        mode="create"
        onSubmit={handleCreate}
      />
      
      {/* Edit Drawer */}
      {selectedAsset && (
        <FormDrawer
          open={editOpen}
          onOpenChange={(open) => { setEditOpen(open); if (!open) setSelectedAsset(null); }}
          title={`Edit ${selectedAsset.name}`}
          description={selectedAsset.source === "intune_sync" 
            ? "Some fields are managed by Intune sync"
            : "Update asset information"
          }
          schema={editAssetSchema}
          config={dynamicFormConfig}
          fields={editFields}
          mode="edit"
          defaultValues={{
            assetTag: selectedAsset.assetTag,
            name: selectedAsset.name,
            description: selectedAsset.description || "",
            categoryId: selectedAsset.categoryId || "",
            status: selectedAsset.status,
            serialNumber: selectedAsset.serialNumber || "",
            manufacturer: selectedAsset.manufacturer || "",
            model: selectedAsset.model || "",
            purchaseDate: selectedAsset.purchaseDate || "",
            purchaseCost: selectedAsset.purchaseCost || "",
            warrantyEnd: selectedAsset.warrantyEnd || "",
            location: selectedAsset.location || "",
            notes: selectedAsset.notes || "",
          }}
          onSubmit={handleEdit}
          disabledFields={
            selectedAsset.source === "intune_sync" && selectedAsset.syncEnabled
              ? ["assetTag", "name", "serialNumber", "manufacturer", "model"]
              : []
          }
        />
      )}
      
      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedAsset?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset
              record and remove all associated data including assignment history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedAsset(null)}>Cancel</AlertDialogCancel>
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
      <Dialog open={assignOpen} onOpenChange={(open) => {
        setAssignOpen(open)
        if (!open) {
          setSelectedAsset(null)
          setSelectedPersonId("")
          setAssignNotes("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>
              Assign {selectedAsset?.name} ({selectedAsset?.assetTag}) to a person.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="person-select">Select Person</Label>
              {people.length > 0 ? (
                <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                  <SelectTrigger className="w-full">
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
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No people available. Add people first in People → Directory.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Notes (optional)</Label>
              <Textarea
                id="assign-notes"
                placeholder="Add any notes about this assignment..."
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignOpen(false)
                setSelectedAsset(null)
                setSelectedPersonId("")
                setAssignNotes("")
              }}
            >
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
      <Dialog open={returnOpen} onOpenChange={(open) => {
        setReturnOpen(open)
        if (!open) {
          setSelectedAsset(null)
          setReturnNotes("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>
              Return {selectedAsset?.name} ({selectedAsset?.assetTag}) from {selectedAsset?.assignedTo?.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="return-notes">Notes (optional)</Label>
              <Textarea
                id="return-notes"
                placeholder="Add any notes about this return (condition, reason, etc.)..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={3}
              />
            </div>
    </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnOpen(false)
                setSelectedAsset(null)
                setReturnNotes("")
              }}
            >
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
