"use client"

import { useState, useMemo } from "react"
import { 
  MoreHorizontal, 
  Pencil, 
  Plus, 
  Trash2, 
  Building2, 
  Users,
  GitFork,
  Crown,
  TreeDeciduous,
  LayoutGrid,
  List,
  Layers,
} from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { 
  useOrganizationalRolesList, 
  useCreateOrganizationalRole, 
  useUpdateOrganizationalRole, 
  useDeleteOrganizationalRole,
  useBulkUpdateOrganizationalRoles,
  type OrganizationalRole,
  type CreateOrganizationalRole,
  type UpdateOrganizationalRole,
} from "@/lib/api/org-roles"
import { useTeamsList } from "@/lib/api/teams"
import { useOrganizationalLevelsList } from "@/lib/api/org-levels"
import { OrgTreeView } from "@/components/people/org-tree-view"
import { OrgChartDesigner } from "@/components/people/org-chart-designer"
import { LevelsManager } from "@/components/people/levels-manager"
import { TeamTreeSelect } from "@/components/people/team-tree-select"
import { z } from "zod"

// Helper to transform __none__ to null for optional UUID fields
const optionalUuid = z.preprocess(
  (val) => (val === "__none__" || val === "" ? null : val),
  z.string().uuid().nullable().optional()
)

// Form schemas - teamId is required
const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  teamId: z.string().uuid("Team is required"),
  parentRoleId: optionalUuid,
})

const editRoleSchema = createRoleSchema

// Stats card component
interface StatsCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  color: string
  loading?: boolean
}

function StatsCard({ title, value, subtitle, icon, color, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
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
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

type ViewMode = "tree" | "chart" | "table" | "levels"

export default function RolesPage() {
  const canAccess = useCanAccess("people.roles")
  const canCreate = usePermission("people.roles", "create")
  const canEdit = usePermission("people.roles", "edit")
  const canDelete = usePermission("people.roles", "delete")
  
  const [viewMode, setViewMode] = useState<ViewMode>("chart")
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<OrganizationalRole | null>(null)
  const [parentRoleIdForCreate, setParentRoleIdForCreate] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Fetch roles, teams, and levels
  const { data: roles = [], isLoading } = useOrganizationalRolesList()
  const { data: teams = [] } = useTeamsList()
  const { data: levels = [] } = useOrganizationalLevelsList()
  
  // Mutations
  const createMutation = useCreateOrganizationalRole()
  const updateMutation = useUpdateOrganizationalRole()
  const deleteMutation = useDeleteOrganizationalRole()
  const bulkUpdateMutation = useBulkUpdateOrganizationalRoles()
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = roles.length
    const topLevel = roles.filter(r => r.parentRoleId === null).length
    const withHolders = roles.filter(r => r.holderCount > 0).length
    const vacant = roles.filter(r => r.holderCount === 0).length
    return { total, topLevel, withHolders, vacant }
  }, [roles])
  
  // Special value for "none" selection (empty string not allowed by Radix Select)
  const NONE_VALUE = "__none__"
  
  // Form config for role
  const formConfig = useMemo(() => {
    // Convert roles to select options (excluding current role for edit)
    const roleOptions = roles
      .filter(r => !selectedRole || r.id !== selectedRole.id)
      .map(r => ({
        value: r.id,
        label: r.name,
      }))
    
    return {
      name: {
        component: "input" as const,
        label: "Role Name",
        placeholder: "e.g. Engineering Manager",
        required: true,
        type: "text",
      },
      description: {
        component: "textarea" as const,
        label: "Description",
        placeholder: "Describe the role's responsibilities",
      },
      teamId: {
        component: "custom" as const,
        label: "Team",
        placeholder: "Select team",
        required: true,
        render: ({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) => (
          <TeamTreeSelect
            teams={teams}
            value={value || null}
            onChange={(newValue) => onChange(newValue ?? "")}
            disabled={disabled}
            placeholder="Select team..."
          />
        ),
        renderReadonly: (value: string | null) => {
          if (!value) return "—"
          const team = teams.find(t => t.id === value)
          return team?.name ?? "Unknown"
        },
      },
      parentRoleId: {
        component: "select" as const,
        label: "Reports To",
        placeholder: "Select parent role",
        options: [{ value: NONE_VALUE, label: "None (Top-level)" }, ...roleOptions],
      },
    }
  }, [teams, roles, selectedRole])
  
  // Handlers
  const handleAdd = (parentRoleId?: string | null) => {
    setParentRoleIdForCreate(parentRoleId ?? null)
    setCreateOpen(true)
  }
  
  // Helper to convert NONE_VALUE to null
  const toNullable = (value: string | null | undefined): string | null => {
    if (!value || value === NONE_VALUE) return null
    return value
  }
  
  const handleCreate = async (data: CreateOrganizationalRole) => {
    // Guard against double submission
    if (createMutation.isPending) return
    
    const payload: CreateOrganizationalRole = {
      name: data.name,
      description: data.description || undefined,
      teamId: data.teamId,
      parentRoleId: toNullable(data.parentRoleId) || parentRoleIdForCreate || null,
    }
    
    // Close drawer immediately to prevent re-submission
    setCreateOpen(false)
    setParentRoleIdForCreate(null)
    
    try {
      await createMutation.mutateAsync(payload)
      toast.success("Role created successfully")
    } catch (error) {
      toast.error((error as Error).message || "Failed to create role")
    }
  }
  
  const handleEdit = async (data: UpdateOrganizationalRole) => {
    if (!selectedRole || updateMutation.isPending) return
    
    const roleId = selectedRole.id
    const payload: UpdateOrganizationalRole = {
      name: data.name,
      description: data.description ?? null,
      teamId: data.teamId,
      parentRoleId: toNullable(data.parentRoleId),
    }
    
    // Close drawer immediately to prevent re-submission
    setEditOpen(false)
    setSelectedRole(null)
    
    try {
      await updateMutation.mutateAsync({ id: roleId, data: payload })
      toast.success("Role updated successfully")
    } catch (error) {
      toast.error((error as Error).message || "Failed to update role")
    }
  }
  
  const handleDelete = async () => {
    if (!selectedRole) return
    
    try {
      await deleteMutation.mutateAsync(selectedRole.id)
      toast.success("Role deleted successfully")
      setDeleteOpen(false)
      setSelectedRole(null)
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete role")
    }
  }
  
  const handleSaveLayout = async (updates: Array<{ id: string; positionX: number; positionY: number; level?: number }>) => {
    try {
      await bulkUpdateMutation.mutateAsync({ updates })
      toast.success("Layout saved successfully")
    } catch (error) {
      toast.error((error as Error).message || "Failed to save layout")
    }
  }
  
  // Handle updating parent role (from drag-connecting in org chart)
  const handleUpdateParent = async (roleId: string, newParentId: string | null) => {
    // Prevent circular reference
    if (roleId === newParentId) {
      toast.error("A role cannot be its own parent")
      return
    }
    
    // Calculate new level based on parent
    let newLevel = 0
    if (newParentId) {
      const parentRole = roles.find(r => r.id === newParentId)
      if (parentRole) {
        newLevel = parentRole.level + 1
      }
    }
    
    try {
      await updateMutation.mutateAsync({
        id: roleId,
        data: {
          parentRoleId: newParentId,
          level: newLevel,
        },
      })
      toast.success("Role hierarchy updated")
    } catch (error) {
      toast.error((error as Error).message || "Failed to update role hierarchy")
    }
  }
  
  // Table columns
  const columns: ColumnDef<OrganizationalRole>[] = useMemo(() => [
    {
      id: "name",
      accessorKey: "name",
      header: "Role Name",
      cell: ({ row }) => {
        const role = row.original
  return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
              <div className="font-medium">{role.name}</div>
              {role.description && (
                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">
                  {role.description}
                </div>
              )}
            </div>
              </div>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      id: "team",
      accessorKey: "team.name",
      header: "Team",
      cell: ({ row }) => {
        const role = row.original
        if (!role.team) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {role.team.name}
          </Badge>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      id: "parentRole",
      accessorKey: "parentRole.name",
      header: "Reports To",
      cell: ({ row }) => {
        const role = row.original
        if (!role.parentRole) {
          return <Badge variant="default" className="text-xs">Top-Level</Badge>
        }
        return <span className="text-sm">{role.parentRole.name}</span>
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      id: "level",
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => {
        const role = row.original
        return (
          <Badge variant="outline" className="font-mono">
            L{role.level}
          </Badge>
        )
      },
      enableSorting: true,
    },
    {
      id: "holderCount",
      accessorKey: "holderCount",
      header: "Holders",
      cell: ({ row }) => {
        const role = row.original
        if (role.holderCount === 0) {
          return <Badge variant="secondary" className="text-xs">Vacant</Badge>
        }
        return (
          <Badge variant="secondary" className="font-mono">
            <Users className="h-3 w-3 mr-1" />
            {role.holderCount}
          </Badge>
        )
      },
      enableSorting: true,
    },
    {
      id: "childCount",
      accessorKey: "childCount",
      header: "Direct Reports",
      cell: ({ row }) => {
        const role = row.original
        if (role.childCount === 0) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <Badge variant="outline" className="font-mono">
            {role.childCount}
          </Badge>
        )
      },
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const role = row.original
              return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Protected module="people.roles" action="create" fallback={null}>
                <DropdownMenuItem onClick={() => handleAdd(role.id)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sub-Role
                </DropdownMenuItem>
              </Protected>
              <Protected module="people.roles" action="update" fallback={null}>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedRole(role)
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Role
                </DropdownMenuItem>
              </Protected>
              <Protected module="people.roles" action="delete" fallback={null}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedRole(role)
                    setDeleteOpen(true)
                  }}
                  className="text-destructive focus:text-destructive"
                  disabled={role.holderCount > 0 || role.childCount > 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Role
                </DropdownMenuItem>
              </Protected>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      size: 50,
    },
  ], [])
  
  if (!canAccess) {
    return (
      <PageShell title="Organizational Roles">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view organizational roles." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Organizational Roles"
      description="Define your organizational structure and role hierarchy."
      action={
        <Protected module="people.roles" action="create" fallback={null}>
          <Button onClick={() => handleAdd(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </Protected>
      }
    >
      <div className={isFullscreen ? "" : "space-y-6"}>
        {/* Stats Cards - hidden in fullscreen */}
        {!isFullscreen && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Roles"
              value={stats.total}
              subtitle="All roles"
              icon={<Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              color="bg-blue-500/10"
              loading={isLoading}
            />
            <StatsCard
              title="Top-Level"
              value={stats.topLevel}
              subtitle="Executive roles"
              icon={<Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              color="bg-amber-500/10"
              loading={isLoading}
            />
            <StatsCard
              title="With Holders"
              value={stats.withHolders}
              subtitle="Filled positions"
              icon={<Users className="h-4 w-4 text-green-600 dark:text-green-400" />}
              color="bg-green-500/10"
              loading={isLoading}
            />
            <StatsCard
              title="Vacant"
              value={stats.vacant}
              subtitle="Open positions"
              icon={<GitFork className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
              color="bg-rose-500/10"
              loading={isLoading}
            />
          </div>
        )}
        
        {/* View Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          {/* Tabs list - hidden in fullscreen */}
          {!isFullscreen && (
            <TabsList>
              <TabsTrigger value="tree" className="flex items-center gap-2">
                <TreeDeciduous className="h-4 w-4" />
                Tree View
              </TabsTrigger>
              <TabsTrigger value="chart" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Org Chart
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="levels" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Levels
              </TabsTrigger>
            </TabsList>
          )}
          
          <TabsContent value="tree" className="mt-0">
            <Card className="py-0">
              <CardContent className="p-0 py-0">
                <OrgTreeView
                  roles={roles}
                  selectedRoleId={selectedRole?.id}
                  onSelect={(role) => setSelectedRole(role)}
                  onAdd={canCreate ? handleAdd : undefined}
                  onEdit={canEdit ? (role) => {
                    setSelectedRole(role)
                    setEditOpen(true)
                  } : undefined}
                  onDelete={canDelete ? (role) => {
                    setSelectedRole(role)
                    setDeleteOpen(true)
                  } : undefined}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="chart" className={isFullscreen ? "mt-0 h-screen" : "mt-0"}>
            <Card className={isFullscreen ? "border-0 shadow-none h-full py-0" : "overflow-hidden py-0"}>
              <CardContent className={isFullscreen ? "p-0 h-full" : "p-0"}>
                <div className={isFullscreen ? "h-full" : "h-[600px]"}>
                  <OrgChartDesigner
                    roles={roles}
                    teams={teams}
                    levels={levels}
                    selectedRoleId={selectedRole?.id}
                    onSelect={(role) => setSelectedRole(role)}
                    onEdit={canEdit ? (role) => {
                      setSelectedRole(role)
                      setEditOpen(true)
                    } : undefined}
                    onDelete={canDelete ? (role) => {
                      setSelectedRole(role)
                      setDeleteOpen(true)
                    } : undefined}
                    onSave={canEdit ? handleSaveLayout : undefined}
                    onUpdateParent={canEdit ? handleUpdateParent : undefined}
                    onInlineUpdate={canEdit ? async (roleId, data) => {
                      try {
                        await updateMutation.mutateAsync({ id: roleId, data })
                        toast.success("Role updated")
                      } catch (error) {
                        toast.error((error as Error).message || "Failed to update role")
                      }
                    } : undefined}
                    onCreate={canCreate ? async (drafts) => {
                      // Create all draft roles
                      try {
                        for (const draft of drafts) {
                          await createMutation.mutateAsync({
                            name: draft.name,
                            description: draft.description || undefined,
                            teamId: draft.teamId,
                            teamIds: draft.teamIds, // Include all team IDs for multi-team support
                            parentRoleId: draft.parentRoleId,
                            level: draft.level,
                            positionX: draft.positionX,
                            positionY: draft.positionY,
                          })
                        }
                        toast.success(`${drafts.length} role${drafts.length > 1 ? "s" : ""} created`)
                      } catch (error) {
                        toast.error((error as Error).message || "Failed to create roles")
                        throw error // Re-throw to prevent clearing drafts
                      }
                    } : undefined}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canCreate={canCreate}
                    isLoading={isLoading}
                    isSaving={bulkUpdateMutation.isPending || createMutation.isPending}
                    isFullscreen={isFullscreen}
                    onFullscreenChange={setIsFullscreen}
                  />
                </div>
          </CardContent>
        </Card>
          </TabsContent>
          
          <TabsContent value="table" className="mt-0">
            <DataTable
              columns={columns}
              data={roles}
              loading={isLoading}
              searchPlaceholder="Search roles..."
              enableSorting
              enableColumnFilters
              enableColumnVisibility
              enableExport
            />
          </TabsContent>
          
          <TabsContent value="levels" className="mt-0">
            <LevelsManager
              canEdit={canEdit}
              canDelete={canDelete}
              canCreate={canCreate}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Create Role Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setParentRoleIdForCreate(null)
        }}
        title="Add Role"
        description="Create a new organizational role."
        config={formConfig}
        schema={createRoleSchema}
        fields={["name", "description", "teamId", "parentRoleId"]}
        defaultValues={{
          parentRoleId: parentRoleIdForCreate || NONE_VALUE,
        }}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />
      
      {/* Edit Role Drawer */}
      <FormDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedRole(null)
        }}
        title="Edit Role"
        description="Update role details."
        mode="edit"
        config={formConfig}
        schema={editRoleSchema}
        fields={["name", "description", "teamId", "parentRoleId"]}
        defaultValues={selectedRole ? {
          name: selectedRole.name,
          description: selectedRole.description || "",
          teamId: selectedRole.teamId,
          parentRoleId: selectedRole.parentRoleId || NONE_VALUE,
        } : undefined}
        onSubmit={handleEdit}
        isSubmitting={updateMutation.isPending}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedRole?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedRole(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}

