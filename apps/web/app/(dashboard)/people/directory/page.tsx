"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Plus, Trash2, Users, UserCheck, UserPlus, Building2, KeyRound, Link2, Unlink } from "lucide-react"
import { toast } from "sonner"

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
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { useUsersList, useUpdateUser, usersKeys } from "@/lib/api/users"
import { peopleKeys } from "@/lib/api/people"
import { useQueryClient } from "@tanstack/react-query"

// Generated from spec
import { columns as baseColumns } from "@/lib/generated/people/person/columns"
import { formConfig, createFormSchema, editFormSchema, getFormFields } from "@/lib/generated/people/person/form-config"
import type { CreatePerson, UpdatePerson } from "@/lib/generated/people/person/types"

// API hooks - Person type comes from api/people with linked user info
import { usePeopleList, useCreatePerson, useUpdatePerson, useDeletePerson, type Person } from "@/lib/api/people"

// Form fields
const createFields = getFormFields("create")
const editFields = getFormFields("edit")

// Stats card component for consistent styling
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

export default function DirectoryPage() {
  const canAccess = useCanAccess("people.directory")
  const canEdit = usePermission("people.directory", "edit")
  const canDelete = usePermission("people.directory", "delete")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkUserOpen, setLinkUserOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  
  // Fetch people with React Query
  const { data: people = [], isLoading, error } = usePeopleList()
  const { data: users = [] } = useUsersList()
  const createMutation = useCreatePerson()
  const updateMutation = useUpdatePerson()
  const deleteMutation = useDeletePerson()
  const updateUserMutation = useUpdateUser()
  
  // Get users that are not already linked to a person
  const availableUsers = useMemo(() => {
    return users.filter(u => !u.personId)
  }, [users])

  // Calculate stats
  const stats = useMemo(() => {
    const total = people.length
    const active = people.filter(p => p.status === "active").length
    const onboarding = people.filter(p => p.status === "onboarding").length
    
    // Get unique teams
    const teams = new Set(people.map(p => p.team).filter(Boolean))
    
    // People who started in the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentHires = people.filter(p => {
      if (!p.startDate) return false
      const startDate = new Date(p.startDate)
      return startDate >= thirtyDaysAgo
    }).length

    return { total, active, onboarding, teams: teams.size, recentHires }
  }, [people])
  
  // Add links and actions columns
  const columns = [
    ...baseColumns,
    {
      id: "links",
      header: "Links",
      cell: ({ row }: { row: { original: Person } }) => {
        const person = row.original
        return (
          <div className="flex items-center gap-1.5">
            {person.hasLinkedUser && (
              <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0.5">
                <KeyRound className="h-3 w-3" />
                User
              </Badge>
            )}
            {person.hasEntraLink && (
              <Badge className="gap-1 text-xs px-1.5 py-0.5 bg-[#0078D4]/10 text-[#0078D4] dark:bg-[#0078D4]/20 dark:text-[#4DA6FF] border-0">
                <Building2 className="h-3 w-3" />
                Entra
              </Badge>
            )}
            {!person.hasLinkedUser && !person.hasEntraLink && (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        )
      },
      enableSorting: false,
      enableColumnFilter: false,
      size: 120,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: Person } }) => {
        const person = row.original
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
                  router.push(`/people/directory/${person.slug}`)
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
                      setSelectedPerson(person)
                      setEditOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {person.hasLinkedUser ? (
                    <DropdownMenuItem 
                      onSelect={(e) => { 
                        e.preventDefault()
                        handleUnlinkUser(person)
                      }}
                    >
                      <Unlink className="mr-2 h-4 w-4" />
                      Unlink User Account
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem 
                      onSelect={(e) => { 
                        e.preventDefault()
                        setSelectedPerson(person)
                        setSelectedUserId("")
                        setLinkUserOpen(true)
                      }}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Link to User Account
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => { 
                      e.preventDefault()
                      setSelectedPerson(person)
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
      enableColumnFilter: false,
      size: 50,
    },
  ]
  
  const handleCreate = async (values: CreatePerson) => {
    try {
      const person = await createMutation.mutateAsync(values)
      toast.success(`${person.name} has been added to the directory`)
      setCreateOpen(false)
    } catch {
      toast.error("Failed to create person")
    }
  }
  
  const handleEdit = async (values: UpdatePerson) => {
    if (!selectedPerson) return
    try {
      await updateMutation.mutateAsync({ id: selectedPerson.id, data: values })
      toast.success("Person updated successfully")
      setEditOpen(false)
      setSelectedPerson(null)
    } catch {
      toast.error("Failed to update person")
    }
  }
  
  const handleDelete = async () => {
    if (!selectedPerson) return
    try {
      await deleteMutation.mutateAsync(selectedPerson.id)
      toast.success(`${selectedPerson.name} has been removed`)
      setDeleteOpen(false)
      setSelectedPerson(null)
    } catch {
      toast.error("Failed to delete person")
    }
  }
  
  const handleLinkUser = async () => {
    if (!selectedPerson || !selectedUserId) return
    try {
      await updateUserMutation.mutateAsync({
        id: selectedUserId,
        data: { personId: selectedPerson.id },
      })
      // Invalidate both people and users queries to refresh the tables
      await queryClient.invalidateQueries({ queryKey: peopleKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      toast.success("User account linked successfully")
      setLinkUserOpen(false)
      setSelectedPerson(null)
      setSelectedUserId("")
    } catch {
      toast.error("Failed to link user account")
    }
  }
  
  const handleUnlinkUser = useCallback(async (person: Person) => {
    if (!person.linkedUser) return
    try {
      await updateUserMutation.mutateAsync({
        id: person.linkedUser.id,
        data: { personId: null },
      })
      // Invalidate both people and users queries to refresh the tables
      await queryClient.invalidateQueries({ queryKey: peopleKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      toast.success("User account unlinked")
    } catch {
      toast.error("Failed to unlink user account")
    }
  }, [updateUserMutation, queryClient])
  
  if (!canAccess) {
    return (
      <PageShell title="Directory">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the people directory." 
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Directory"
        description="View and manage all employees in your organization."
      >
        <div className="flex items-center justify-center h-64 text-destructive">
          Failed to load people directory
        </div>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="People Directory"
      description="View and manage all employees in your organization."
      action={
        <Protected module="people.directory" action="create">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Person
          </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Employees"
            value={stats.total}
            subtitle="in your organization"
            icon={<Users className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Active"
            value={stats.active}
            subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`}
            icon={<UserCheck className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Recent Hires"
            value={stats.recentHires}
            subtitle="in the last 30 days"
            icon={<UserPlus className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Teams"
            value={stats.teams}
            subtitle="across the organization"
            icon={<Building2 className="h-4 w-4" />}
            loading={isLoading}
          />
        </div>

        {/* People Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Employees</CardTitle>
            <CardDescription>
              A complete list of employees with their roles, teams, and current status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={people}
              loading={isLoading}
              searchKey="name"
              searchPlaceholder="Search by name, email, or role..."
              onRowClick={(person) => router.push(`/people/directory/${person.slug}`)}
              facetedFilters={{
                status: { type: "enum" },
                team: { type: "enum" },
                role: { type: "enum" },
                startDate: { type: "date" },
              }}
              enableColumnFilters
              enableSorting
              enableExport
              enableColumnVisibility
              emptyState={
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No employees found</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Get started by adding your first team member.
                  </p>
                  <Protected module="people.directory" action="create">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first employee
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
        title="Add Person"
        description="Create a new employee record"
        schema={createFormSchema}
        config={formConfig}
        fields={createFields}
        mode="create"
        onSubmit={handleCreate}
      />
      
      {/* Edit Drawer */}
      {selectedPerson && (
        <FormDrawer
          open={editOpen}
          onOpenChange={(open) => { setEditOpen(open); if (!open) setSelectedPerson(null); }}
          title={`Edit ${selectedPerson.name}`}
          description="Update employee information"
          schema={editFormSchema}
          config={formConfig}
          fields={editFields}
          mode="edit"
          defaultValues={{
            name: selectedPerson.name,
            email: selectedPerson.email,
            role: selectedPerson.role,
            team: selectedPerson.team || "",
            status: selectedPerson.status,
            startDate: selectedPerson.startDate,
            endDate: selectedPerson.endDate || "",
            phone: selectedPerson.phone || "",
            location: selectedPerson.location || "",
            bio: selectedPerson.bio || "",
          }}
          onSubmit={handleEdit}
        />
      )}
      
      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPerson?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              record and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPerson(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link User Dialog */}
      <Dialog open={linkUserOpen} onOpenChange={(open) => {
        setLinkUserOpen(open)
        if (!open) {
          setSelectedPerson(null)
          setSelectedUserId("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link User Account</DialogTitle>
            <DialogDescription>
              Link {selectedPerson?.name} to an existing user account. This will allow
              them to log in and access the system.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User Account</Label>
              {availableUsers.length > 0 ? (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a user account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No unlinked user accounts available. Create a new user account first
                  in Settings → Users & Access.
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLinkUserOpen(false)
                setSelectedPerson(null)
                setSelectedUserId("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkUser}
              disabled={!selectedUserId || updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Linking..." : "Link Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
