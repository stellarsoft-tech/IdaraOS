"use client"

import { useMemo, useState } from "react"
import { MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { PageShell } from "@/components/primitives/page-shell"
import { AccessDenied, Protected } from "@/components/primitives/protected"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAccessGroupsList,
  useCreateAccessGroup,
  useDeleteAccessGroup,
  useUpdateAccessGroup,
  type AccessGroup,
  type CreateAccessGroup,
  type UpdateAccessGroup,
} from "@/lib/api/access-control"
import { usePeopleList } from "@/lib/api/people"
import { useOrganizationalRolesList, type OrganizationalRole } from "@/lib/api/org-roles"
import { useCanAccess, usePermission } from "@/lib/rbac/context"

const NONE_VALUE = "__none__"

const accessGroupFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  businessJustification: z.string().min(1, "Business justification is required").max(1500, "Business justification too long"),
  accessItemsText: z.string().optional(),
  isoControlsText: z.string().optional(),
  ownerPersonId: z.string().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  reviewFrequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["active", "draft", "retired"]),
})

type AccessGroupFormValues = z.infer<typeof accessGroupFormSchema>

const riskVariants: Record<AccessGroup["riskLevel"], "default" | "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  critical: "destructive",
}

const statusVariants: Record<AccessGroup["status"], "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "outline",
  retired: "secondary",
}

function splitLines(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinLines(value: string[]) {
  return value.join("\n")
}

function RoleChecklist({
  roles,
  value,
  onChange,
  disabled,
}: {
  roles: OrganizationalRole[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">No organizational roles available yet.</p>
  }

  return (
    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
      {roles.map((role) => {
        const checked = value.includes(role.id)
        return (
          <Label key={role.id} className="flex cursor-pointer items-start gap-2 text-sm font-normal">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => {
                if (next) {
                  onChange([...value, role.id])
                } else {
                  onChange(value.filter((id) => id !== role.id))
                }
              }}
            />
            <span>
              <span className="font-medium">{role.name}</span>
              {role.team?.name && <span className="text-muted-foreground">, {role.team.name}</span>}
            </span>
          </Label>
        )
      })}
    </div>
  )
}

function StatsCard({
  title,
  value,
  subtitle,
  loading,
}: {
  title: string
  value: number | string
  subtitle: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-1 h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function AccessGroupsPage() {
  const canAccess = useCanAccess("people.access-groups")
  const canEdit = usePermission("people.access-groups", "edit")
  const canDelete = usePermission("people.access-groups", "delete")

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<AccessGroup | null>(null)

  const { data: groups = [], isLoading } = useAccessGroupsList()
  const { data: people = [] } = usePeopleList()
  const { data: roles = [] } = useOrganizationalRolesList()
  const createMutation = useCreateAccessGroup()
  const updateMutation = useUpdateAccessGroup()
  const deleteMutation = useDeleteAccessGroup()

  const stats = useMemo(() => {
    const active = groups.filter((group) => group.status === "active").length
    const highRisk = groups.filter((group) => group.riskLevel === "high" || group.riskLevel === "critical").length
    const assigned = groups.reduce((total, group) => total + group.assignmentCount, 0)
    return { active, highRisk, assigned }
  }, [groups])

  const formConfig = useMemo(() => ({
    name: {
      component: "input" as const,
      label: "Group Name",
      placeholder: "e.g. HR Confidential Records",
      required: true,
      type: "text",
    },
    description: {
      component: "textarea" as const,
      label: "Description",
      placeholder: "Describe the access boundary and intended users",
    },
    businessJustification: {
      component: "textarea" as const,
      label: "Business Justification",
      placeholder: "Explain why this access is needed for role responsibilities",
      required: true,
    },
    accessItemsText: {
      component: "textarea" as const,
      label: "Access Included",
      placeholder: "One system, permission, or data set per line",
      helpText: "Use least-privilege access items that can be reviewed later.",
    },
    isoControlsText: {
      component: "textarea" as const,
      label: "ISO 27001:2022 Controls",
      placeholder: "A.5.15\nA.5.18\nA.8.2",
      helpText: "Defaults should include A.5.15 Access control and A.5.18 Access rights.",
    },
    ownerPersonId: {
      component: "select" as const,
      label: "Access Owner",
      placeholder: "Select owner",
      options: [
        { value: NONE_VALUE, label: "Unassigned" },
        ...people.map((person) => ({ value: person.id, label: person.name })),
      ],
    },
    roleIds: {
      component: "custom" as const,
      label: "Recommended Organizational Roles",
      render: ({ value, onChange, disabled }: { value?: string[]; onChange: (value: string[]) => void; disabled?: boolean }) => (
        <RoleChecklist roles={roles} value={value ?? []} onChange={onChange} disabled={disabled} />
      ),
      renderReadonly: (value?: string[]) => {
        const selected = roles.filter((role) => value?.includes(role.id)).map((role) => role.name)
        return selected.length ? selected.join(", ") : "None"
      },
    },
    reviewFrequency: {
      component: "select" as const,
      label: "Review Frequency",
      required: true,
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "semi_annual", label: "Semi Annual" },
        { value: "annual", label: "Annual" },
      ],
    },
    riskLevel: {
      component: "select" as const,
      label: "Risk Level",
      required: true,
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ],
    },
    status: {
      component: "select" as const,
      label: "Status",
      required: true,
      options: [
        { value: "active", label: "Active" },
        { value: "draft", label: "Draft" },
        { value: "retired", label: "Retired" },
      ],
    },
  }), [people, roles])

  const columns: ColumnDef<AccessGroup>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Access Group",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description && (
            <div className="max-w-[340px] truncate text-xs text-muted-foreground">{row.original.description}</div>
          )}
        </div>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      accessorKey: "riskLevel",
      header: "Risk",
      cell: ({ row }) => (
        <Badge variant={riskVariants[row.original.riskLevel]}>
          {row.original.riskLevel.replace("_", " ")}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "reviewFrequency",
      header: "Review",
      cell: ({ row }) => <span className="text-sm capitalize">{row.original.reviewFrequency.replace("_", " ")}</span>,
      enableSorting: true,
    },
    {
      accessorKey: "owner.name",
      header: "Owner",
      cell: ({ row }) => row.original.owner?.name ?? <span className="text-muted-foreground">Unassigned</span>,
    },
    {
      accessorKey: "roles",
      header: "Recommended Roles",
      cell: ({ row }) => {
        const roles = row.original.roles
        if (roles.length === 0) return <span className="text-sm text-muted-foreground">None</span>
        return (
          <div className="flex max-w-[260px] flex-wrap gap-1">
            {roles.slice(0, 2).map((role) => (
              <Badge key={role.id} variant="outline" className="text-xs">{role.name}</Badge>
            ))}
            {roles.length > 2 && <Badge variant="secondary" className="text-xs">+{roles.length - 2}</Badge>}
          </div>
        )
      },
    },
    {
      accessorKey: "assignmentCount",
      header: "Assigned",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono">
          <Users className="mr-1 h-3 w-3" />
          {row.original.assignmentCount}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariants[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const group = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Protected module="people.access-groups" action="edit" fallback={null}>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedGroup(group)
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Group
                </DropdownMenuItem>
              </Protected>
              <Protected module="people.access-groups" action="delete" fallback={null}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={group.assignmentCount > 0}
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setSelectedGroup(group)
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Group
                </DropdownMenuItem>
              </Protected>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      size: 50,
    },
  ], [])

  const toPayload = (values: AccessGroupFormValues): CreateAccessGroup => ({
    name: values.name,
    description: values.description || undefined,
    businessJustification: values.businessJustification,
    accessItems: splitLines(values.accessItemsText),
    isoControls: splitLines(values.isoControlsText).length ? splitLines(values.isoControlsText) : ["A.5.15", "A.5.18"],
    ownerPersonId: values.ownerPersonId && values.ownerPersonId !== NONE_VALUE ? values.ownerPersonId : null,
    roleIds: values.roleIds ?? [],
    reviewFrequency: values.reviewFrequency,
    riskLevel: values.riskLevel,
    status: values.status,
  })

  const handleCreate = async (values: AccessGroupFormValues) => {
    try {
      await createMutation.mutateAsync(toPayload(values))
      toast.success("Access group created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create access group")
    }
  }

  const handleEdit = async (values: AccessGroupFormValues) => {
    if (!selectedGroup) return

    try {
      const payload: UpdateAccessGroup = toPayload(values)
      await updateMutation.mutateAsync({ id: selectedGroup.id, data: payload })
      toast.success("Access group updated successfully")
      setEditOpen(false)
      setSelectedGroup(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update access group")
    }
  }

  const handleDelete = async () => {
    if (!selectedGroup) return

    try {
      await deleteMutation.mutateAsync(selectedGroup.id)
      toast.success("Access group deleted successfully")
      setDeleteOpen(false)
      setSelectedGroup(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete access group")
    }
  }

  if (!canAccess) {
    return (
      <PageShell title="Access Groups">
        <AccessDenied
          title="Access Denied"
          description="You don't have permission to view access groups."
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Access Groups"
      description="Define ISO 27001:2022-aligned access bundles based on role, responsibility, and least privilege."
      action={
        <Protected module="people.access-groups" action="create" fallback={null}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Access Group
          </Button>
        </Protected>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Groups" value={groups.length} subtitle="Access bundles" loading={isLoading} />
        <StatsCard title="Active Groups" value={stats.active} subtitle="Available for assignment" loading={isLoading} />
        <StatsCard title="High Risk" value={stats.highRisk} subtitle="High or critical risk" loading={isLoading} />
        <StatsCard title="Assignments" value={stats.assigned} subtitle="Register entries" loading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        data={groups}
        loading={isLoading}
        searchPlaceholder="Search access groups..."
        enableSorting
        enableColumnFilters
        enableColumnVisibility
        enableExport
      />

      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Access Group"
        description="Define a least-privilege access bundle for a role or responsibility."
        config={formConfig}
        schema={accessGroupFormSchema}
        fields={["name", "description", "businessJustification", "accessItemsText", "isoControlsText", "ownerPersonId", "roleIds", "reviewFrequency", "riskLevel", "status"]}
        defaultValues={{
          isoControlsText: "A.5.15\nA.5.18",
          ownerPersonId: NONE_VALUE,
          roleIds: [],
          reviewFrequency: "quarterly",
          riskLevel: "medium",
          status: "active",
        }}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />

      <FormDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedGroup(null)
        }}
        title="Edit Access Group"
        description="Update access group definition and review metadata."
        mode="edit"
        config={formConfig}
        schema={accessGroupFormSchema}
        fields={["name", "description", "businessJustification", "accessItemsText", "isoControlsText", "ownerPersonId", "roleIds", "reviewFrequency", "riskLevel", "status"]}
        defaultValues={selectedGroup ? {
          name: selectedGroup.name,
          description: selectedGroup.description ?? "",
          businessJustification: selectedGroup.businessJustification,
          accessItemsText: joinLines(selectedGroup.accessItems),
          isoControlsText: joinLines(selectedGroup.isoControls),
          ownerPersonId: selectedGroup.ownerPersonId ?? NONE_VALUE,
          roleIds: selectedGroup.roleIds,
          reviewFrequency: selectedGroup.reviewFrequency,
          riskLevel: selectedGroup.riskLevel,
          status: selectedGroup.status,
        } : undefined}
        onSubmit={handleEdit}
        isSubmitting={updateMutation.isPending}
        readOnly={!canEdit}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Access Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedGroup?.name}&quot;? Groups with active register assignments must be revoked first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedGroup(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || deleteMutation.isPending}
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
