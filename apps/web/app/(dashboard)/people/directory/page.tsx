"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
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

// Generated from spec
import { columns as baseColumns } from "@/lib/generated/people/person/columns"
import { formConfig, createFormSchema, editFormSchema, getFormFields } from "@/lib/generated/people/person/form-config"
import type { Person, CreatePerson, UpdatePerson } from "@/lib/generated/people/person/types"

// API hooks
import { usePeopleList, useCreatePerson, useUpdatePerson, useDeletePerson } from "@/lib/api/people"

// Form fields
const createFields = getFormFields("create")
const editFields = getFormFields("edit")

export default function DirectoryPage() {
  const canAccess = useCanAccess("people.directory")
  const canEdit = usePermission("people.directory", "edit")
  const canDelete = usePermission("people.directory", "delete")
  const canCreate = usePermission("people.directory", "create")
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  
  // Fetch people with React Query
  const { data: people = [], isLoading, error } = usePeopleList()
  const createMutation = useCreatePerson()
  const updateMutation = useUpdatePerson()
  const deleteMutation = useDeletePerson()
  
  // Add actions column
  const columns = [
    ...baseColumns,
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/people/directory/${person.slug}`)}>
                View details
              </DropdownMenuItem>
              {(canEdit || canDelete) && <DropdownMenuSeparator />}
              {canEdit && (
                <DropdownMenuItem onSelect={() => { setSelectedPerson(person); setEditOpen(true); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onSelect={() => { setSelectedPerson(person); setDeleteOpen(true); }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
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
      title="Directory"
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
      <DataTable
        columns={columns}
        data={people}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Search people..."
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
            <p className="text-muted-foreground mb-4">No employees found</p>
            <Protected module="people.directory" action="create">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first employee
              </Button>
            </Protected>
          </div>
        }
      />
      
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
    </PageShell>
  )
}
