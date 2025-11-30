"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Plus, Shield, UserCog, MoreHorizontal, Trash2, Mail, Loader2, ChevronRight } from "lucide-react"
import Link from "next/link"

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
  type Role,
} from "@/lib/api/rbac"
import { userStatusValues } from "@/lib/db/schema"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

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
const statusColors: Record<string, "default" | "purple" | "info" | "success" | "warning" | "destructive"> = {
  active: "success",
  invited: "info",
  suspended: "warning",
  deactivated: "destructive",
}

export default function UsersPage() {
  const canAccess = useCanAccess("settings.users")
  const canEdit = usePermission("settings.users", "edit")
  const canDelete = usePermission("settings.users", "delete")

  const { data: users = [], isLoading: usersLoading } = useUsersList()
  const { data: roles = [], isLoading: rolesLoading } = useRoles()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const updateUserRoles = useUpdateUserRoles()

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<ApiUser | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    status: "invited" as typeof userStatusValues[number],
    roleIds: [] as string[],
  })

  // Get user roles for editing
  const { data: editUserRoles = [] } = useUserRoles(editUser?.id || "")

  // Update form when editing user changes
  useEffect(() => {
    if (editUser) {
      setFormData({
        name: editUser.name,
        email: editUser.email,
        status: editUser.status,
        roleIds: editUserRoles.map((r) => r.roleId),
      })
    }
  }, [editUser, editUserRoles])

  // Stable handlers for table actions
  const handleEditUser = useCallback((user: ApiUser) => {
    setEditUser(user)
  }, [])

  const handleDeleteUserClick = useCallback((userId: string) => {
    setDeleteUserId(userId)
  }, [])

  // Role stats - count users by their assigned roles
  const roleStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const role of roles) {
      stats[role.id] = role.userCount || 0
    }
    return stats
  }, [roles])

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
        accessorKey: "role",
        header: "Roles",
        cell: ({ row }) => {
          // For now, show the legacy role field - we'll update this later
          const legacyRole = row.original.role
          return (
            <Badge className={getRoleColorClass(legacyRole === "Owner" || legacyRole === "Admin" ? "purple" : "gray")}>
              {legacyRole}
            </Badge>
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
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem 
                    onClick={(e) => { 
                      e.stopPropagation()
                      handleEditUser(user)
                    }}
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    Edit User
                  </DropdownMenuItem>
                )}
                {user.status === "invited" && (
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Invite
                  </DropdownMenuItem>
                )}
                {(canEdit || canDelete) && <DropdownMenuSeparator />}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => { 
                      e.stopPropagation()
                      handleDeleteUserClick(user.id)
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete User
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleEditUser, handleDeleteUserClick, canEdit, canDelete]
  )

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      email: "",
      status: "invited",
      roleIds: [],
    })
    setCreateOpen(true)
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
      })
      
      // Assign roles to the new user
      if (formData.roleIds.length > 0 && newUser?.id) {
        await updateUserRoles.mutateAsync({
          userId: newUser.id,
          roleIds: formData.roleIds,
        })
      }
      
      toast.success("User invited successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite user")
    }
  }

  // Update user handler
  const handleUpdateUser = async () => {
    if (!editUser) return
    try {
      await updateUser.mutateAsync({
        id: editUser.id,
        data: {
          name: formData.name,
          email: formData.email,
          status: formData.status,
        },
      })
      
      // Update roles
      await updateUserRoles.mutateAsync({
        userId: editUser.id,
        roleIds: formData.roleIds,
      })
      
      toast.success("User updated successfully")
      setEditUser(null)
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

  if (!canAccess) {
    return (
      <PageShell title="Users & Access" icon={Shield}>
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
        <Protected module="settings.users" action="create">
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Role Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {roles.slice(0, 5).map((role) => (
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
          ))}
        </div>

        {/* Link to Roles Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Role Permissions</CardTitle>
                <CardDescription>Configure what each role can access</CardDescription>
              </div>
              <Protected module="settings.roles" action="view">
                <Button variant="outline" asChild>
                  <Link href="/settings/roles">
                    Manage Roles
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </Protected>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div key={role.id} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getRoleColorClass(role.color)}>
                      {role.name}
                    </Badge>
                    {role.isSystem && (
                      <Badge variant="outline" className="text-xs">System</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {role.description || "No description"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
              isLoading={usersLoading}
              searchColumn="name"
              searchPlaceholder="Search users..."
              facetedFilters={[
                {
                  column: "status",
                  title: "Status",
                  options: userStatusValues.map((status) => ({
                    value: status,
                    label: status.charAt(0).toUpperCase() + status.slice(1),
                  })),
                },
              ]}
              emptyState={
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No users found</p>
                  <Protected module="settings.users" action="create">
                    <Button onClick={handleOpenCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Invite your first user
                    </Button>
                  </Protected>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* Create/Edit User Sheet */}
        <Sheet open={createOpen || !!editUser} onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditUser(null)
          }
        }}>
          <SheetContent className="overflow-y-auto flex flex-col">
            <SheetHeader>
              <SheetTitle>
                {editUser ? "Edit User" : "Invite User"}
              </SheetTitle>
              <SheetDescription>
                {editUser 
                  ? "Update user details and role assignments."
                  : "Send an invitation to a new team member."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
              {/* User Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
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
                  />
                </div>

                {editUser && (
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData((prev) => ({ 
                        ...prev, 
                        status: value as typeof userStatusValues[number] 
                      }))}
                    >
                      <SelectTrigger>
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
              </div>

              {/* Role Assignment */}
              <div className="space-y-4">
                <Label>Assign Roles</Label>
                <p className="text-sm text-muted-foreground">
                  Select which roles this user should have. Roles determine what the user can access.
                </p>
                
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div 
                      key={role.id} 
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={role.id}
                        checked={formData.roleIds.includes(role.id)}
                        onCheckedChange={() => handleRoleToggle(role.id)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={role.id} className="cursor-pointer font-medium">
                            {role.name}
                          </Label>
                          <Badge className={`${getRoleColorClass(role.color)} text-xs`}>
                            {role.permissionCount || 0} permissions
                          </Badge>
                          {role.isSystem && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {role.description || "No description"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {formData.roleIds.length === 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ User will have no permissions if no roles are assigned.
                  </p>
                )}
              </div>
            </div>

            <SheetFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setCreateOpen(false)
                  setEditUser(null)
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={editUser ? handleUpdateUser : handleCreateUser}
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
                {editUser ? "Update User" : "Send Invitation"}
              </Button>
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
