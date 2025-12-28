"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  MoreHorizontal, 
  Pencil, 
  Plus, 
  Trash2, 
  Users, 
  UserCheck, 
  GitFork,
  Building2,
  ChevronRight,
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
  useTeamsList, 
  useCreateTeam, 
  useUpdateTeam, 
  useDeleteTeam,
  type Team,
  type CreateTeam,
  type UpdateTeam,
} from "@/lib/api/teams"
import { usePeopleList, type Person } from "@/lib/api/people"
import { z } from "zod"

// Helper to transform __none__ to null for optional UUID fields
const optionalUuid = z.preprocess(
  (val) => (val === "__none__" || val === "" ? null : val),
  z.string().uuid().nullable().optional()
)

// Form schemas
const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  leadId: optionalUuid,
  parentTeamId: optionalUuid,
})

const editTeamSchema = createTeamSchema

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

export default function TeamsPage() {
  const canAccess = useCanAccess("people.teams")
  const canCreate = usePermission("people.teams", "create")
  const canEdit = usePermission("people.teams", "update")
  const canDelete = usePermission("people.teams", "delete")
  const router = useRouter()
  
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  
  // Fetch teams
  const { data: teams = [], isLoading } = useTeamsList()
  const { data: people = [] } = usePeopleList()
  
  // Mutations
  const createMutation = useCreateTeam()
  const updateMutation = useUpdateTeam()
  const deleteMutation = useDeleteTeam()
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = teams.length
    const withLeads = teams.filter(t => t.leadId).length
    const nested = teams.filter(t => t.parentTeamId).length
    const empty = teams.filter(t => t.memberCount === 0).length
    return { total, withLeads, nested, empty }
  }, [teams])
  
  // Special value for "none" selection (empty string not allowed by Radix Select)
  const NONE_VALUE = "__none__"
  
  // Form config for team
  const formConfig = useMemo(() => {
    // Convert people to select options
    const peopleOptions = people.map(p => ({
      value: p.id,
      label: p.name,
    }))
    
    // Convert teams to select options (excluding current team for edit)
    const teamOptions = teams
      .filter(t => !selectedTeam || t.id !== selectedTeam.id)
      .map(t => ({
        value: t.id,
        label: t.name,
      }))
    
    return {
      name: {
        component: "input" as const,
        label: "Team Name",
        placeholder: "e.g. Engineering",
        required: true,
        type: "text",
      },
      description: {
        component: "textarea" as const,
        label: "Description",
        placeholder: "Describe the team's purpose and responsibilities",
      },
      leadId: {
        component: "select" as const,
        label: "Team Lead",
        placeholder: "Select a team lead",
        options: [{ value: NONE_VALUE, label: "No lead assigned" }, ...peopleOptions],
      },
      parentTeamId: {
        component: "select" as const,
        label: "Parent Team",
        placeholder: "Select parent team",
        options: [{ value: NONE_VALUE, label: "No parent (top-level)" }, ...teamOptions],
      },
    }
  }, [people, teams, selectedTeam])
  
  // Helper to convert NONE_VALUE to null
  const toNullable = (value: string | null | undefined): string | null => {
    if (!value || value === NONE_VALUE) return null
    return value
  }
  
  // Handlers
  const handleCreate = async (data: CreateTeam) => {
    try {
      const payload: CreateTeam = {
        name: data.name,
        description: data.description || undefined,
        leadId: toNullable(data.leadId),
        parentTeamId: toNullable(data.parentTeamId),
      }
      
      await createMutation.mutateAsync(payload)
      toast.success("Team created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error((error as Error).message || "Failed to create team")
    }
  }
  
  const handleEdit = async (data: UpdateTeam) => {
    if (!selectedTeam) return
    
    try {
      const payload: UpdateTeam = {
        name: data.name,
        description: data.description ?? null,
        leadId: toNullable(data.leadId),
        parentTeamId: toNullable(data.parentTeamId),
      }
      
      await updateMutation.mutateAsync({ id: selectedTeam.id, data: payload })
      toast.success("Team updated successfully")
      setEditOpen(false)
      setSelectedTeam(null)
    } catch (error) {
      toast.error((error as Error).message || "Failed to update team")
    }
  }
  
  const handleDelete = async () => {
    if (!selectedTeam) return
    
    try {
      await deleteMutation.mutateAsync(selectedTeam.id)
      toast.success("Team deleted successfully")
      setDeleteOpen(false)
      setSelectedTeam(null)
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete team")
    }
  }
  
  // Table columns
  const columns: ColumnDef<Team>[] = useMemo(() => [
    {
      id: "name",
      accessorKey: "name",
      header: "Team Name",
      cell: ({ row }) => {
        const team = row.original
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium">{team.name}</div>
              {team.description && (
                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">
                  {team.description}
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
      id: "lead",
      accessorKey: "lead.name",
      header: "Team Lead",
      cell: ({ row }) => {
        const team = row.original
        if (!team.lead) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <button
            onClick={() => router.push(`/people/directory/${team.lead!.slug}`)}
            className="text-sm text-primary hover:underline"
          >
            {team.lead.name}
          </button>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      id: "parentTeam",
      accessorKey: "parentTeam.name",
      header: "Parent Team",
      cell: ({ row }) => {
        const team = row.original
        if (!team.parentTeam) {
          return <Badge variant="outline" className="text-xs">Top-Level</Badge>
        }
        return (
          <div className="flex items-center gap-1 text-sm">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span>{team.parentTeam.name}</span>
          </div>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      id: "memberCount",
      accessorKey: "memberCount",
      header: "Members",
      cell: ({ row }) => {
        const team = row.original
        return (
          <Badge variant="secondary" className="font-mono">
            {team.memberCount}
          </Badge>
        )
      },
      enableSorting: true,
    },
    {
      id: "childCount",
      accessorKey: "childCount",
      header: "Sub-Teams",
      cell: ({ row }) => {
        const team = row.original
        if (team.childCount === 0) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <Badge variant="outline" className="font-mono">
            {team.childCount}
          </Badge>
        )
      },
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const team = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Protected module="people.teams" action="update" fallback={null}>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedTeam(team)
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Team
                </DropdownMenuItem>
              </Protected>
              <Protected module="people.teams" action="delete" fallback={null}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedTeam(team)
                    setDeleteOpen(true)
                  }}
                  className="text-destructive focus:text-destructive"
                  disabled={team.memberCount > 0 || team.childCount > 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </DropdownMenuItem>
              </Protected>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      size: 50,
    },
  ], [router])
  
  if (!canAccess) {
    return (
      <PageShell title="Teams">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view teams." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Teams"
      description="Manage organizational teams and their structure."
      action={
        <Protected module="people.teams" action="create" fallback={null}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Team
          </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Teams"
            value={stats.total}
            subtitle="All teams"
            icon={<Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            color="bg-blue-500/10"
            loading={isLoading}
          />
          <StatsCard
            title="With Leads"
            value={stats.withLeads}
            subtitle="Teams with assigned leads"
            icon={<UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />}
            color="bg-green-500/10"
            loading={isLoading}
          />
          <StatsCard
            title="Nested Teams"
            value={stats.nested}
            subtitle="Sub-teams"
            icon={<GitFork className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            color="bg-amber-500/10"
            loading={isLoading}
          />
          <StatsCard
            title="Empty Teams"
            value={stats.empty}
            subtitle="No members assigned"
            icon={<Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
            color="bg-slate-500/10"
            loading={isLoading}
          />
        </div>
        
        {/* Teams Table */}
        <DataTable
          columns={columns}
          data={teams}
          loading={isLoading}
          searchPlaceholder="Search teams..."
          enableSorting
          enableColumnFilters
          enableColumnVisibility
          enableExport
        />
      </div>
      
      {/* Create Team Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Team"
        description="Create a new team in your organization."
        config={formConfig}
        schema={createTeamSchema}
        fields={["name", "description", "leadId", "parentTeamId"]}
        defaultValues={{
          leadId: NONE_VALUE,
          parentTeamId: NONE_VALUE,
        }}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />
      
      {/* Edit Team Drawer */}
      <FormDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedTeam(null)
        }}
        title="Edit Team"
        description="Update team details."
        config={formConfig}
        schema={editTeamSchema}
        fields={["name", "description", "leadId", "parentTeamId"]}
        defaultValues={selectedTeam ? {
          name: selectedTeam.name,
          description: selectedTeam.description || "",
          leadId: selectedTeam.leadId || NONE_VALUE,
          parentTeamId: selectedTeam.parentTeamId || NONE_VALUE,
        } : undefined}
        onSubmit={handleEdit}
        isSubmitting={updateMutation.isPending}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedTeam?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTeam(null)}>
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

