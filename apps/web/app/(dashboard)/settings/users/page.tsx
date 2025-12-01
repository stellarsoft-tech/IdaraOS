"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Plus, Shield, UserCog, Trash2, Loader2, Search, Building2, User, Lock, RefreshCw } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { DataTableAdvanced } from "@/components/primitives/data-table-advanced"
import { StatusBadge } from "@/components/status-badge"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { 
  useUsersList, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser,
  type ApiUser,
} from "@/lib/api/users"
import {
  useRoles,
  useUserRoles,
  useUpdateUserRoles,
} from "@/lib/api/rbac"
import { useEntraIntegration, useSearchEntraUsers, useTriggerSync, type EntraUser } from "@/lib/api/integrations"
import { usePeopleList } from "@/lib/api/people"
import { userStatusValues } from "@/lib/db/schema"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { useDebounce } from "@/lib/hooks/use-debounce"

// Store handlers in a ref-like pattern to avoid re-render issues
const userActionsStore = {
  handlers: null as {
    onEdit: (user: ApiUser) => void
    onDelete: (userId: string) => void
    canEdit: boolean
    canDelete: boolean
    scimBidirectionalSync: boolean
  } | null
}

// Color utility for role badges
function getRoleColorClass(color: string | null): string {
  const colors: Record<string, string> = {
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    gray: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  }
  return colors[color || "gray"] || colors.gray
}

// Status badge color mapping
const statusColors: Record<string, "default" | "purple" | "info" | "success" | "warning" | "danger"> = {
  active: "success",
  invited: "info",
  suspended: "warning",
  deactivated: "danger",
}

export default function UsersPage() {
  const canAccess = useCanAccess("settings.users")
  const canEdit = usePermission("settings.users", "edit")
  const canDelete = usePermission("settings.users", "delete")

  const { data: users = [], isLoading: usersLoading } = useUsersList()
  const { data: roles = [], isLoading: rolesLoading } = useRoles()
  const { data: people = [] } = usePeopleList()
  const { data: entraIntegration } = useEntraIntegration()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const updateUserRoles = useUpdateUserRoles()
  const triggerSync = useTriggerSync()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create")
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  // Entra user search state
  const [entraSearchOpen, setEntraSearchOpen] = useState(false)
  const [entraSearchQuery, setEntraSearchQuery] = useState("")
  const debouncedEntraSearch = useDebounce(entraSearchQuery, 300)
  const [selectedEntraUser, setSelectedEntraUser] = useState<EntraUser | null>(null)

  // Check if Entra SSO is enabled
  const isEntraEnabled = entraIntegration?.status === "connected" && entraIntegration?.ssoEnabled

  // Search Entra users
  const { data: entraUsers = [], isLoading: entraUsersLoading } = useSearchEntraUsers(
    debouncedEntraSearch,
    isEntraEnabled && sheetMode === "create" && debouncedEntraSearch.length >= 1
  )

  // Get people that are not already linked to a user (for linking)
  const availablePeople = useMemo(() => {
    return people.filter(p => !p.hasLinkedUser)
  }, [people])

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    status: "invited" as typeof userStatusValues[number],
    roleIds: [] as string[],
    personId: "" as string,
  })

  // Get user roles for editing (only fetch when we have an ID)
  const { data: editUserRoles = [] } = useUserRoles(editUserId || "")

  // Update roleIds when they load (separate from other form data)
  useEffect(() => {
    if (editUserId && editUserRoles.length > 0) {
      setFormData(prev => ({
        ...prev,
        roleIds: editUserRoles.map((r) => r.roleId),
      }))
    }
  }, [editUserId, editUserRoles])

  // Stable handlers for table actions
  const handleEditUser = useCallback((user: ApiUser) => {
    // Set form data immediately (synchronously) before opening sheet
    setFormData({
      name: user.name,
      email: user.email,
      status: user.status,
      roleIds: [], // Will be populated by useEffect when roles load
      personId: user.personId || "",
    })
    setEditUserId(user.id)
    setSheetMode("edit")
    setSheetOpen(true)
  }, [])

  const handleDeleteUserClick = useCallback((userId: string) => {
    setDeleteUserId(userId)
  }, [])
  
  // Check if SCIM bidirectional sync is enabled
  const scimBidirectionalSync = entraIntegration?.scimBidirectionalSync ?? false

  // Update store for cell access (outside React lifecycle)
  userActionsStore.handlers = { onEdit: handleEditUser, onDelete: handleDeleteUserClick, canEdit, canDelete, scimBidirectionalSync }

  // Table columns
  const columns: ColumnDef<ApiUser>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => {
          const user = row.original
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "roles",
        header: "Roles",
        cell: ({ row }) => {
          const assignedRoles = row.original.roles || []
          if (assignedRoles.length === 0) {
            return <span className="text-muted-foreground text-sm">No roles</span>
          }
          return (
            <TooltipProvider>
            <div className="flex flex-wrap gap-1">
              {assignedRoles.map((role) => (
                  <Tooltip key={role.roleId}>
                    <TooltipTrigger asChild>
                      <Badge className={`${getRoleColorClass(role.roleColor)} ${role.source === "scim" ? "pr-1" : ""}`}>
                  {role.roleName}
                        {role.source === "scim" && (
                          <RefreshCw className="h-2.5 w-2.5 ml-1 opacity-70" />
                        )}
                </Badge>
                    </TooltipTrigger>
                    {role.source === "scim" && (
                      <TooltipContent>
                        <p>Assigned via SCIM (Entra ID)</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
              ))}
            </div>
            </TooltipProvider>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string
          return (
            <StatusBadge variant={statusColors[status] || "default"}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </StatusBadge>
          )
        },
      },
      {
        id: "links",
        header: "Links",
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex items-center gap-1.5">
              {user.hasLinkedPerson && (
                <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0.5">
                  <User className="h-3 w-3" />
                  Person
                </Badge>
              )}
              {user.hasEntraLink && (
                <Badge className="gap-1 text-xs px-1.5 py-0.5 bg-[#0078D4]/10 text-[#0078D4] dark:bg-[#0078D4]/20 dark:text-[#4DA6FF] border-0">
                  <Building2 className="h-3 w-3" />
                  Entra
                </Badge>
              )}
              {user.isScimProvisioned && (
                <Badge className="gap-1 text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
                  <RefreshCw className="h-3 w-3" />
                  SCIM
                </Badge>
              )}
              {!user.hasLinkedPerson && !user.hasEntraLink && !user.isScimProvisioned && (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last Login",
        cell: ({ row }) => {
          const date = row.getValue("lastLoginAt") as string | null
          if (!date) return <span className="text-muted-foreground">Never</span>
          return new Date(date).toLocaleDateString()
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const user = row.original
          const handlers = userActionsStore.handlers
          if (!handlers) return null
          
          // SCIM-provisioned users are locked when bidirectional sync is disabled
          const isScimLocked = user.isScimProvisioned && !handlers.scimBidirectionalSync
          
          return (
            <TooltipProvider>
            <div className="flex items-center gap-1">
              {handlers.canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                        disabled={isScimLocked}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlers.onEdit(user)
                  }}
                >
                        {isScimLocked ? <Lock className="h-4 w-4" /> : <UserCog className="h-4 w-4" />}
                  <span className="sr-only">Edit</span>
                </Button>
                    </span>
                  </TooltipTrigger>
                  {isScimLocked && (
                    <TooltipContent>
                      <p>SCIM-provisioned users cannot be edited.<br />Update in Microsoft Entra ID instead.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
              {handlers.canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={isScimLocked}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlers.onDelete(user.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
                    </span>
                  </TooltipTrigger>
                  {isScimLocked && (
                    <TooltipContent>
                      <p>SCIM-provisioned users cannot be deleted.<br />Remove in Microsoft Entra ID instead.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
            </div>
            </TooltipProvider>
          )
        },
      },
    ],
    []
  )

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      email: "",
      status: "invited",
      roleIds: [],
      personId: "",
    })
    setEditUserId(null)
    setSelectedEntraUser(null)
    setEntraSearchQuery("")
    setSheetMode("create")
    setSheetOpen(true)
  }

  const handleSelectEntraUser = (entraUser: EntraUser) => {
    setSelectedEntraUser(entraUser)
    setFormData((prev) => ({
      ...prev,
      name: entraUser.name,
      email: entraUser.email,
    }))
    setEntraSearchOpen(false)
    setEntraSearchQuery("")
  }

  const handleClearEntraUser = () => {
    setSelectedEntraUser(null)
    setFormData((prev) => ({
      ...prev,
      name: "",
      email: "",
    }))
  }

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }))
  }

  // Create user handler
  const handleCreateUser = async () => {
    try {
      const newUser = await createUser.mutateAsync({
        name: formData.name,
        email: formData.email,
        role: "User", // Legacy field, will be replaced by roles
        // Include Entra ID if user was selected from Entra
        entraId: selectedEntraUser?.id || null,
        // Include person link if selected
        personId: formData.personId || null,
      })
      
      // Assign roles to the new user
      if (formData.roleIds.length > 0 && newUser?.id) {
        await updateUserRoles.mutateAsync({
          userId: newUser.id,
          roleIds: formData.roleIds,
        })
      }
      
      toast.success("User added successfully")
      setSheetOpen(false)
      setSelectedEntraUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add user")
    }
  }

  // Update user handler
  const handleUpdateUser = async () => {
    if (!editUserId) return
    try {
      await updateUser.mutateAsync({
        id: editUserId,
        data: {
          name: formData.name,
          email: formData.email,
          status: formData.status,
          personId: formData.personId || null,
        },
      })
      
      // Update roles
      await updateUserRoles.mutateAsync({
        userId: editUserId,
        roleIds: formData.roleIds,
      })
      
      toast.success("User updated successfully")
      setSheetOpen(false)
      setEditUserId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user")
    }
  }

  // Delete user handler
  const handleDeleteUser = async () => {
    if (!deleteUserId) return
    try {
      await deleteUser.mutateAsync(deleteUserId)
      toast.success("User deleted")
      setDeleteUserId(null)
    } catch {
      toast.error("Failed to delete user")
    }
  }

  // Sync from Entra ID handler
  const handleSyncFromEntra = async () => {
    try {
      const result = await triggerSync.mutateAsync()
      if (result.success) {
        const stats = result.stats
        let description = ""
        if (stats) {
          const parts = []
          if (stats.usersCreated > 0) parts.push(`+${stats.usersCreated} created`)
          if (stats.usersDeprovisioned > 0) parts.push(`-${stats.usersDeprovisioned} deprovisioned`)
          if (stats.rolesAssigned > 0) parts.push(`+${stats.rolesAssigned} roles`)
          if (stats.rolesRemoved > 0) parts.push(`-${stats.rolesRemoved} roles`)
          if (stats.groupsRemoved > 0) parts.push(`${stats.groupsRemoved} stale groups removed`)
          description = parts.join(", ") || "No changes"
        }
        toast.success(result.message, { description })
      } else {
        toast.warning(result.message, {
          description: result.stats?.errors?.length 
            ? `${result.stats.errors.length} errors occurred`
            : undefined,
        })
      }
    } catch {
      toast.error("Failed to sync from Entra ID")
    }
  }

  // Check if Entra sync is available
  const isEntraSyncEnabled = entraIntegration?.status === "connected" && entraIntegration?.scimEnabled

  if (!canAccess) {
    return (
      <PageShell title="Users & Access">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to manage users." 
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Users & Access"
      description="Manage user accounts and their role assignments."
      action={
        <div className="flex items-center gap-2">
          {/* Sync from Entra ID button - only show if Entra is connected and SCIM is enabled */}
          {isEntraSyncEnabled && (
            <Protected module="settings.integrations" action="edit">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={handleSyncFromEntra}
                      disabled={triggerSync.isPending}
                    >
                      {triggerSync.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Sync from Entra
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sync users and groups from Microsoft Entra ID</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Protected>
          )}
          <Protected module="settings.users" action="create">
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </Protected>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Role Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {rolesLoading ? (
            // Show 5 skeleton cards while loading
            Array.from({ length: 5 }).map((_, index) => (
              <Card key={`skeleton-${index}`} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            roles.slice(0, 5).map((role) => (
              <Card key={role.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {role.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{role.userCount || 0}</div>
                  <p className="text-xs text-muted-foreground">users</p>
                </CardContent>
                <div
                  className="absolute top-0 right-0 w-16 h-16 opacity-5"
                  style={{
                    background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
                  }}
                />
              </Card>
            ))
          )}
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage user accounts and their role assignments</CardDescription>
          </CardHeader>
          <CardContent>
              <DataTableAdvanced
                columns={columns}
                data={users}
                loading={usersLoading}
                searchKey="name"
                searchPlaceholder="Search users..."
                facetedFilters={{
                  status: {
                    type: "enum",
                    options: userStatusValues.map((status) => ({
                      value: status,
                      label: status.charAt(0).toUpperCase() + status.slice(1),
                    })),
                  },
                }}
              emptyState={
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No users found</p>
                  <Protected module="settings.users" action="create">
                    <Button onClick={handleOpenCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first user
                    </Button>
                  </Protected>
                </div>
              }
              />
          </CardContent>
        </Card>

        {/* Create/Edit User Sheet */}
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          if (!open) {
            setSheetOpen(false)
            setEditUserId(null)
            setSelectedEntraUser(null)
          }
        }}>
          <SheetContent className="overflow-y-auto flex flex-col sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>
                {sheetMode === "edit" ? "Edit User" : "Add User"}
              </SheetTitle>
              <SheetDescription>
                {sheetMode === "edit"
                  ? "Update user details and role assignments."
                  : isEntraEnabled 
                    ? "Add a user from Microsoft Entra ID or enter details manually."
                    : "Add a new team member to the system."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
              {/* SCIM User Warning - when user is SCIM-provisioned and bidirectional sync is off */}
              {sheetMode === "edit" && (() => {
                const editingUser = users.find(u => u.id === editUserId)
                if (editingUser?.isScimProvisioned && !scimBidirectionalSync) {
                  return (
                    <Alert variant="default" className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                      <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <AlertDescription className="text-emerald-700 dark:text-emerald-300 text-sm">
                        This user is provisioned via SCIM and cannot be edited here. To modify this user&apos;s details, update them in Microsoft Entra ID. Changes will sync automatically.
                      </AlertDescription>
                    </Alert>
                  )
                }
                return null
              })()}

              {/* Entra User Search (only in create mode when SSO is enabled) */}
              {sheetMode === "create" && isEntraEnabled && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#0078D4]" />
                    Import from Microsoft Entra ID
                  </Label>
                  
                  {selectedEntraUser ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm bg-[#0078D4]/10 text-[#0078D4]">
                          {selectedEntraUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{selectedEntraUser.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{selectedEntraUser.email}</p>
                        {selectedEntraUser.jobTitle && (
                          <p className="text-xs text-muted-foreground truncate">{selectedEntraUser.jobTitle}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearEntraUser}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Popover open={entraSearchOpen} onOpenChange={setEntraSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={entraSearchOpen}
                          className="w-full justify-start text-muted-foreground"
                        >
                          <Search className="mr-2 h-4 w-4" />
                          Search Entra ID users...
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search by name or email..."
                            value={entraSearchQuery}
                            onValueChange={setEntraSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {entraUsersLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Searching...
                                </div>
                              ) : entraSearchQuery.length < 1 ? (
                                "Type to search Entra ID users..."
                              ) : (
                                "No users found in Entra ID."
                              )}
                            </CommandEmpty>
                            {entraUsers.length > 0 && (
                              <CommandGroup heading="Entra ID Users">
                                {entraUsers.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={user.id}
                                    onSelect={() => handleSelectEntraUser(user)}
                                    className="cursor-pointer"
                                  >
                                    <Avatar className="h-8 w-8 mr-3">
                                      <AvatarFallback className="text-xs bg-[#0078D4]/10 text-[#0078D4]">
                                        {user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{user.name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                    {user.jobTitle && (
                                      <Badge variant="secondary" className="ml-2 text-xs">
                                        {user.jobTitle}
                                      </Badge>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or enter manually
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* User Details */}
              {(() => {
                const editingUser = users.find(u => u.id === editUserId)
                const isScimLocked = sheetMode === "edit" && editingUser?.isScimProvisioned && !scimBidirectionalSync
                
                return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                        disabled={!!selectedEntraUser || isScimLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="user@example.com"
                        disabled={!!selectedEntraUser || isScimLocked}
                  />
                </div>

                {sheetMode === "edit" && (
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData((prev) => ({ 
                        ...prev, 
                        status: value as typeof userStatusValues[number] 
                      }))}
                          disabled={isScimLocked}
                    >
                          <SelectTrigger className="w-full" disabled={isScimLocked}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {userStatusValues.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Link to Person */}
                <div className="space-y-2">
                  <Label htmlFor="personId">Link to Person (Directory)</Label>
                  <Select
                    value={formData.personId || "none"}
                    onValueChange={(value) => setFormData((prev) => ({ 
                      ...prev, 
                      personId: value === "none" ? "" : value 
                    }))}
                        disabled={isScimLocked}
                  >
                        <SelectTrigger className="w-full" disabled={isScimLocked}>
                      <SelectValue placeholder="Select a person to link..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No link</SelectItem>
                      {(formData.personId ? people : availablePeople).map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          <div className="flex items-center gap-2">
                            <span>{person.name}</span>
                            <span className="text-xs text-muted-foreground">({person.email})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Link this user account to an employee in the People Directory.
                  </p>
                </div>
              </div>
                )
              })()}

              {/* Role Assignment */}
              {(() => {
                const editingUser = users.find(u => u.id === editUserId)
                const isScimLocked = sheetMode === "edit" && editingUser?.isScimProvisioned && !scimBidirectionalSync
                
                return (
              <div className="space-y-4">
                <Label>Assign Roles</Label>
                <p className="text-sm text-muted-foreground">
                  Select which roles this user should have. Roles determine what the user can access.
                </p>
                
                {/* SCIM Warning for specific role assignments */}
                    {sheetMode === "edit" && editUserRoles.some(r => r.source === "scim") && !isScimLocked && (
                  <Alert variant="default" className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                    <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                      Some roles are assigned via SCIM (Entra ID) and cannot be modified here. 
                      To change these roles, update the user&apos;s group membership in Microsoft Entra ID.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-3">
                  {roles.map((role) => {
                    // Check if this role is SCIM-assigned for this user
                    const scimRole = editUserRoles.find(r => r.roleId === role.id && r.source === "scim")
                    const isScimAssigned = !!scimRole
                        const isRoleDisabled = isScimAssigned || isScimLocked
                    
                    return (
                    <div 
                      key={role.id} 
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                              isRoleDisabled 
                            ? "bg-muted/30 border-blue-200 dark:border-blue-800" 
                            : "hover:bg-muted/50"
                        }`}
                    >
                      <Checkbox
                        id={role.id}
                        checked={formData.roleIds.includes(role.id)}
                        onCheckedChange={() => handleRoleToggle(role.id)}
                              disabled={isRoleDisabled}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <Label 
                              htmlFor={role.id} 
                                  className={`font-medium ${isRoleDisabled ? "text-muted-foreground" : "cursor-pointer"}`}
                            >
                            {role.name}
                          </Label>
                          <Badge className={`${getRoleColorClass(role.color)} text-xs`}>
                            {role.permissionCount || 0} permissions
                          </Badge>
                          {role.isSystem && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                            {isScimAssigned && (
                              <Badge variant="outline" className="text-xs gap-1 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
                                <RefreshCw className="h-2.5 w-2.5" />
                                SCIM
                              </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {role.description || "No description"}
                        </p>
                      </div>
                            {isRoleDisabled && (
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                    </div>
                    )
                  })}
                </div>

                    {formData.roleIds.length === 0 && !isScimLocked && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ User will have no permissions if no roles are assigned.
                  </p>
                )}
              </div>
                )
              })()}
            </div>

            <SheetFooter>
              {(() => {
                const editingUser = users.find(u => u.id === editUserId)
                const isScimLocked = sheetMode === "edit" && editingUser?.isScimProvisioned && !scimBidirectionalSync
                
                return (
                  <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSheetOpen(false)
                  setEditUserId(null)
                }}
              >
                      {isScimLocked ? "Close" : "Cancel"}
              </Button>
                    {!isScimLocked && (
              <Button 
                onClick={sheetMode === "edit" ? handleUpdateUser : handleCreateUser}
                disabled={
                  createUser.isPending || 
                  updateUser.isPending || 
                  updateUserRoles.isPending ||
                  !formData.name.trim() || 
                  !formData.email.trim()
                }
              >
                {(createUser.isPending || updateUser.isPending || updateUserRoles.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {sheetMode === "edit" ? "Update User" : "Add User"}
              </Button>
                    )}
                  </>
                )
              })()}
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
                The user will lose access to the system immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {/* Warning when bidirectional sync is enabled */}
            {scimBidirectionalSync && (
              <Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                  <strong>Entra ID Sync:</strong> This user will also be <strong>disabled</strong> in Microsoft Entra ID. 
                  They will not be removed from their Entra ID groups, but their account will be deactivated.
                </AlertDescription>
              </Alert>
            )}
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteUser.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageShell>
  )
}
