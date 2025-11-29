"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { people, type Person } from "@/lib/seed-data"

const columns = [
  {
    key: "name" as const,
    label: "Name",
    render: (person: Person) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            {person.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{person.name}</p>
          <p className="text-xs text-muted-foreground">{person.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: "role" as const,
    label: "Role",
  },
  {
    key: "team" as const,
    label: "Team",
  },
  {
    key: "startDate" as const,
    label: "Start Date",
    render: (person: Person) => new Date(person.startDate).toLocaleDateString(),
  },
  {
    key: "status" as const,
    label: "Status",
    render: (person: Person) => {
      const variants: Record<string, "success" | "warning" | "info" | "danger"> = {
        active: "success",
        onboarding: "info",
        offboarding: "warning",
        inactive: "danger",
      }
      return (
        <StatusBadge variant={variants[person.status]}>
          {person.status.charAt(0).toUpperCase() + person.status.slice(1)}
        </StatusBadge>
      )
    },
  },
  {
    key: "assignedAssets" as const,
    label: "Assets",
    render: (person: Person) => <span className="text-muted-foreground">{person.assignedAssets}</span>,
  },
]

export default function DirectoryPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <PageHeader title="Directory" description="View and manage all employees in your organization.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Person
        </Button>
      </PageHeader>

      <DataTable
        data={people}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Search people..."
        onRowClick={(person) => router.push(`/people/directory/${person.slug}`)}
      />
    </div>
  )
}
