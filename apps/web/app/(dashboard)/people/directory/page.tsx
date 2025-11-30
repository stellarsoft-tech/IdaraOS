"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
import { Protected } from "@/components/rbac/protected"

// Generated from spec
import { columns } from "@/lib/generated/people/person/columns"
import { formConfig, createFormSchema, editFormSchema, getFormFields } from "@/lib/generated/people/person/form-config"
import type { Person, CreatePerson } from "@/lib/generated/people/person/types"

// Mock data (TODO: Replace with API calls)
import { people } from "@/lib/seed-data"

export default function DirectoryPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  
  // TODO: Replace with useListQuery hook
  const data: Person[] = people as any
  const loading = false
  
  const handleCreate = async (values: CreatePerson) => {
    // TODO: Implement API call
    console.log("Creating person:", values)
    // await api.post("/api/people/person", values)
  }
  
  return (
    <PageShell
      title="Directory"
      description="View and manage all employees in your organization."
      breadcrumbs={[
        { label: "People", href: "/people" },
        { label: "Directory" },
      ]}
      action={
        <Protected resource="people.person" action="write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Person
          </Button>
        </Protected>
      }
    >
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKey="name"
        searchPlaceholder="Search people..."
        onRowClick={(person) => router.push(`/people/directory/${person.slug || person.id}`)}
        facetedFilters={{
          status: {
            type: "enum",
            options: [
              { label: "Active", value: "active" },
              { label: "Onboarding", value: "onboarding" },
              { label: "Offboarding", value: "offboarding" },
              { label: "Inactive", value: "inactive" },
            ],
          },
          role: {
            type: "text",
          },
          team: {
            type: "text",
          },
        }}
        enableColumnFilters
        enableSorting
        enableExport
        enableColumnVisibility
      />
      
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Person"
        description="Create a new employee record"
        schema={createFormSchema}
        config={formConfig}
        fields={getFormFields("create")}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
