"use client"

import * as React from "react"
import { 
  Shield, 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Users,
  Check,
  X,
  Loader2,
  Info,
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useUser, useCanAccess } from "@/lib/rbac/context"
import {
  useRoles,
  useRole,
  useModules,
  useActions,
  usePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  type Role,
  type Permission,
  type Module,
} from "@/lib/api/rbac"

// Color options for role badges
const ROLE_COLORS = [
  { value: "red", label: "Red", className: "bg-red-500/10 text-red-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500/10 text-orange-500" },
  { value: "yellow", label: "Yellow", className: "bg-yellow-500/10 text-yellow-500" },
  { value: "green", label: "Green", className: "bg-green-500/10 text-green-500" },
  { value: "blue", label: "Blue", className: "bg-blue-500/10 text-blue-500" },
  { value: "purple", label: "Purple", className: "bg-purple-500/10 text-purple-500" },
  { value: "pink", label: "Pink", className: "bg-pink-500/10 text-pink-500" },
  { value: "gray", label: "Gray", className: "bg-gray-500/10 text-gray-500" },
]

function getRoleColorClass(color: string | null): string {
  const found = ROLE_COLORS.find((c) => c.value === color)
  return found?.className || "bg-gray-500/10 text-gray-500"
}

export default function RolesPage() {
  const canAccess = useCanAccess("settings.roles")
  
  const { data: roles, isLoading: rolesLoading } = useRoles()
  const { data: modules } = useModules()
  const { data: actions } = useActions()
  const { data: allPermissions } = usePermissions()

  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null)
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    color: "gray",
    permissionIds: [] as string[],
  })

  // Fetch full role details when editing
  const { data: roleDetails } = useRole(selectedRole?.id || "")

  // When role details load, update form data
  React.useEffect(() => {
    if (roleDetails && selectedRole) {
      setFormData({
        name: roleDetails.name,
        description: roleDetails.description || "",
        color: roleDetails.color || "gray",
        permissionIds: roleDetails.permissions.map((p) => p.permissionId),
      })
    }
  }, [roleDetails, selectedRole])

  // Group permissions by module for the matrix
  const permissionsByModule = React.useMemo(() => {
    if (!allPermissions || !modules) return new Map()

    const map = new Map<string, { module: typeof modules[0]; permissions: Permission[] }>()

    for (const mod of modules) {
      const modPerms = allPermissions.filter((p) => p.moduleSlug === mod.slug)
      if (modPerms.length > 0) {
        map.set(mod.slug, { module: mod, permissions: modPerms })
      }
    }

    return map
  }, [allPermissions, modules])

  // Group modules by category
  const modulesByCategory = React.useMemo(() => {
    const map = new Map<string, Array<{ module: Module; permissions: Permission[] }>>()

    for (const [, data] of permissionsByModule) {
      const category = data.module.category
      if (!map.has(category)) {
        map.set(category, [])
      }
      map.get(category)!.push(data)
    }

    return map
  }, [permissionsByModule])

  const handleOpenCreate = () => {
    setSelectedRole(null)
    setFormData({
      name: "",
      description: "",
      color: "gray",
      permissionIds: [],
    })
    setDrawerOpen(true)
  }

  const handleOpenEdit = (role: Role) => {
    setSelectedRole(role)
    setDrawerOpen(true)
  }

  const handleOpenDelete = (role: Role) => {
    setSelectedRole(role)
    setDeleteDialogOpen(true)
  }

  const handlePermissionToggle = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }))
  }

  const handleSelectAllForModule = (moduleSlug: string, checked: boolean) => {
    const modulePerms = allPermissions?.filter((p) => p.moduleSlug === moduleSlug) || []
    const modulePermIds = modulePerms.map((p) => p.id)

    setFormData((prev) => ({
      ...prev,
      permissionIds: checked
        ? [...new Set([...prev.permissionIds, ...modulePermIds])]
        : prev.permissionIds.filter((id) => !modulePermIds.includes(id)),
    }))
  }

  const isModuleFullySelected = (moduleSlug: string) => {
    const modulePerms = allPermissions?.filter((p) => p.moduleSlug === moduleSlug) || []
    return modulePerms.every((p) => formData.permissionIds.includes(p.id))
  }

  const isModulePartiallySelected = (moduleSlug: string) => {
    const modulePerms = allPermissions?.filter((p) => p.moduleSlug === moduleSlug) || []
    const selected = modulePerms.filter((p) => formData.permissionIds.includes(p.id))
    return selected.length > 0 && selected.length < modulePerms.length
  }

  const handleSubmit = async () => {
    try {
      if (selectedRole) {
        await updateRole.mutateAsync({
          id: selectedRole.id,
          data: {
            name: formData.name,
            description: formData.description,
            color: formData.color,
            permissionIds: formData.permissionIds,
          },
        })
        toast.success("Role updated successfully")
      } else {
        await createRole.mutateAsync({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          permissionIds: formData.permissionIds,
        })
        toast.success("Role created successfully")
      }
      setDrawerOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save role")
    }
  }

  const handleDelete = async () => {
    if (!selectedRole) return

    try {
      await deleteRole.mutateAsync(selectedRole.id)
      toast.success("Role deleted successfully")
      setDeleteDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete role")
    }
  }

  if (!canAccess) {
    return (
      <PageShell title="Roles & Permissions" icon={Shield}>
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to manage roles and permissions." 
        />
      </PageShell>
    )
  }

  return (
    <PageShell title="Roles & Permissions" icon={Shield}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              Manage custom roles and their permissions. Assign roles to users to control their access.
            </p>
          </div>
          <Protected module="settings.roles" action="create">
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </Protected>
        </div>

        {/* Roles Grid */}
        {rolesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles?.map((role) => (
              <Card key={role.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{role.name}</CardTitle>
                        {role.isSystem && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-xs">
                                  System
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Built-in role. Name and description cannot be changed.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {role.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {role.description || "No description"}
                      </CardDescription>
                    </div>
                    <Protected module="settings.roles" anyAction={["edit", "delete"]}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Protected module="settings.roles" action="edit">
                            <DropdownMenuItem onClick={() => handleOpenEdit(role)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Role
                            </DropdownMenuItem>
                          </Protected>
                          {!role.isSystem && (
                            <Protected module="settings.roles" action="delete">
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleOpenDelete(role)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Role
                              </DropdownMenuItem>
                            </Protected>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Protected>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4" />
                      <span>{role.permissionCount || 0} permissions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{role.userCount || 0} users</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Badge className={getRoleColorClass(role.color)}>
                      {role.name}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Role Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full sm:max-w-2xl flex flex-col">
            <SheetHeader>
              <SheetTitle>
                {selectedRole ? "Edit Role" : "Create Role"}
              </SheetTitle>
              <SheetDescription>
                {selectedRole
                  ? "Update role details and permissions."
                  : "Create a new role with custom permissions."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
              {/* Role Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Role Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., HR Manager"
                    disabled={selectedRole?.isSystem}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this role can do..."
                    rows={2}
                    disabled={selectedRole?.isSystem}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Badge Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, color: color.value }))}
                        className={`flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
                          formData.color === color.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted"
                        }`}
                        disabled={selectedRole?.isSystem}
                      >
                        <div className={`h-3 w-3 rounded-full ${color.className.split(" ")[0]}`} />
                        {color.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Permissions Matrix */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label>Permissions</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Select which actions users with this role can perform on each module.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="space-y-6">
                  {Array.from(modulesByCategory.entries()).map(([category, categoryModules]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
                      <div className="rounded-lg border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-2 text-left text-sm font-medium">Module</th>
                              {actions?.map((action) => (
                                <th key={action.id} className="px-2 py-2 text-center text-sm font-medium">
                                  {action.name}
                                </th>
                              ))}
                              <th className="px-2 py-2 text-center text-sm font-medium">All</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryModules.map((data, idx) => (
                              <tr 
                                key={data.module.slug} 
                                className={idx !== categoryModules.length - 1 ? "border-b" : ""}
                              >
                                <td className="px-4 py-2 text-sm">{data.module.name}</td>
                                {actions?.map((action) => {
                                  const perm = data.permissions.find((p) => p.actionSlug === action.slug)
                                  if (!perm) {
                                    return (
                                      <td key={action.id} className="px-2 py-2 text-center">
                                        <span className="text-muted-foreground/40">—</span>
                                      </td>
                                    )
                                  }
                                  return (
                                    <td key={action.id} className="px-2 py-2 text-center">
                                      <Checkbox
                                        checked={formData.permissionIds.includes(perm.id)}
                                        onCheckedChange={() => handlePermissionToggle(perm.id)}
                                      />
                                    </td>
                                  )
                                })}
                                <td className="px-2 py-2 text-center">
                                  <Checkbox
                                    checked={isModuleFullySelected(data.module.slug)}
                                    onCheckedChange={(checked) => 
                                      handleSelectAllForModule(data.module.slug, checked as boolean)
                                    }
                                    className={isModulePartiallySelected(data.module.slug) ? "data-[state=unchecked]:bg-primary/30" : ""}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createRole.isPending || updateRole.isPending || !formData.name.trim()}
              >
                {(createRole.isPending || updateRole.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedRole ? "Update Role" : "Create Role"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the role &quot;{selectedRole?.name}&quot;? 
                This action cannot be undone. Users with this role will lose their permissions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageShell>
  )
}

