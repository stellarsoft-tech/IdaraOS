# Prompt: Scaffold Pages from Spec

## Role
You are scaffolding Next.js App Router pages for a new module.

## Context
- Input: `[SPEC_PATH]` (spec.json file)
- Output: Next.js pages in `apps/web/app/(dashboard)/[paths]`
- Reference: Generated columns, form config, types

## Task
Create list and detail pages using the generated artifacts and primitives.

## Requirements

### 1. List Page (`[spec.routing.list]/page.tsx`)

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { DataTable } from "@/components/primitives/data-table"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"

import { columns } from "@/lib/generated/[module]/columns"
import { formConfig, createSchema } from "@/lib/generated/[module]/form-config"
import type { [Entity] } from "@/lib/generated/[module]/types"

export default function [Entity]ListPage() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  
  // TODO: Replace with real API call
  const data: [Entity][] = []
  const loading = false
  
  const handleCreate = async (values: any) => {
    // TODO: Implement API call
    console.log("Creating:", values)
  }
  
  return (
    <PageShell
      title="[Entity Label Plural]"
      description="[Description from spec]"
      action={
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New [Entity Label]
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKey="[primary_search_field]"
        searchPlaceholder="Search [entity]..."
        onRowClick={(row) => router.push(`[detail_route]/${row.id}`)}
        enableColumnFilters
        enableSorting
        enableExport
      />
      
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="Create [Entity Label]"
        schema={createSchema}
        config={formConfig}
        fields={[/* from spec.forms.create */]}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
```

### 2. Detail Page (`[spec.routing.detail]/page.tsx`)

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Edit, Trash } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { ResourceLayout } from "@/components/primitives/resource-layout"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"

import { formConfig, editSchema } from "@/lib/generated/[module]/form-config"
import type { [Entity] } from "@/lib/generated/[module]/types"

export default function [Entity]DetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  
  // TODO: Fetch entity data
  const entity: [Entity] | null = null
  const loading = false
  
  const handleEdit = async (values: any) => {
    // TODO: Implement API call
    console.log("Updating:", values)
  }
  
  const handleDelete = async () => {
    if (!confirm("Are you sure?")) return
    // TODO: Implement API call
    router.push("[list_route]")
  }
  
  if (loading) return <div>Loading...</div>
  if (!entity) return <div>Not found</div>
  
  return (
    <PageShell
      title={entity.[primary_field]}
      breadcrumbs={[
        { label: "[Entity Plural]", href: "[list_route]" },
        { label: entity.[primary_field] }
      ]}
      action={
        <div className="flex gap-2">
          <Button onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      }
    >
      <ResourceLayout
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: <OverviewTab entity={entity} />
          },
          {
            id: "history",
            label: "History",
            content: <HistoryTab entityId={params.id} />
          }
        ]}
      />
      
      <FormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit [Entity Label]"
        schema={editSchema}
        config={formConfig}
        fields={[/* from spec.forms.edit */]}
        defaultValues={entity}
        mode="edit"
        onSubmit={handleEdit}
      />
    </PageShell>
  )
}
```

### 3. Overview Tab Component

```typescript
function OverviewTab({ entity }: { entity: [Entity] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Field: [field1] */}
      <div>
        <dt className="text-sm font-medium text-muted-foreground">
          [Field Label]
        </dt>
        <dd className="mt-1 text-sm">{entity.[field1]}</dd>
      </div>
      
      {/* Repeat for all relevant fields */}
    </div>
  )
}
```

## Output Format

```markdown
✅ Scaffolded pages for [entity_name]

**Files created:**
- [list_route]/page.tsx (List view with DataTable)
- [detail_route]/page.tsx (Detail view with tabs)

**Components:**
- List: DataTable + FormDrawer (create)
- Detail: ResourceLayout + FormDrawer (edit)
- Overview: Field display grid
- History: Activity log (TODO)

**TODO items:**
- [ ] Implement API calls (fetch, create, update, delete)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Implement history tab
- [ ] Add breadcrumbs to navigation
```

## Example Usage

```
Use prompt: docs/prompts/06-generate-routes.md
Spec: specs/modules/security/isms/risk/spec.json
```

## Do NOT
- Hard-code data (use API calls with TODOs)
- Skip error handling and loading states
- Forget breadcrumbs on detail pages
- Miss the delete confirmation dialog

## Next Steps
1. Add routes to navigation (app-sidebar.tsx)
2. Implement API calls
3. Test create/edit/delete flows
4. Proceed to 07-generate-tests.md

