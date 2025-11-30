# 🚀 Quick Start Guide

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+ (for database features)

## Installation

```bash
# Install all dependencies
pnpm install

# Start development server
cd apps/web
pnpm dev
```

Visit `http://localhost:3000` in your browser.

## Your First Module

### 1. Create a Spec

Create `specs/modules/hr/department/spec.json`:

```json
{
  "entity": "department",
  "namespace": "hr",
  "label": "Department",
  "id": "department_id",
  "routing": {
    "list": "/people/departments",
    "detail": "/people/departments/[department_id]"
  },
  "permissions": {
    "read": ["HR", "Admin", "Owner"],
    "write": ["HR", "Admin", "Owner"],
    "scope": "org_id"
  },
  "fields": [
    {
      "name": "department_id",
      "type": "uuid",
      "required": true
    },
    {
      "name": "name",
      "type": "string",
      "required": true
    },
    {
      "name": "manager_id",
      "type": "uuid",
      "ref": "people.person",
      "required": false
    },
    {
      "name": "employee_count",
      "type": "number",
      "computed": true,
      "expr": "COUNT(people.person) WHERE department_id = department_id"
    }
  ],
  "table": {
    "columns": ["name", "manager_id", "employee_count"],
    "defaultSort": ["name", "asc"],
    "filters": ["manager_id"]
  },
  "forms": {
    "create": ["name", "manager_id"],
    "edit": ["name", "manager_id"]
  }
}
```

### 2. Generate Code

```bash
pnpm generate specs/modules/hr/department/spec.json
```

This creates:
- `apps/web/lib/generated/hr/department/types.ts`
- `apps/web/lib/generated/hr/department/columns.tsx`
- `apps/web/lib/generated/hr/department/form-config.ts`
- `migrations/{timestamp}_create_departments.sql`

### 3. Create List Page

Create `apps/web/app/(dashboard)/people/departments/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { DataTable } from "@/components/primitives/data-table"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
import { Protected } from "@/components/rbac/protected"

// Generated
import { columns } from "@/lib/generated/hr/department/columns"
import { formConfig, createFormSchema, getFormFields } from "@/lib/generated/hr/department/form-config"

export default function DepartmentsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  
  // TODO: Replace with API call
  const data = []
  
  const handleCreate = async (values) => {
    console.log("Creating:", values)
    // await api.post("/api/hr/department", values)
  }
  
  return (
    <PageShell
      title="Departments"
      description="Manage organizational departments"
      action={
        <Protected resource="hr.department" action="write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Department
          </Button>
        </Protected>
      }
    >
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="Search departments..."
      />
      
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Department"
        schema={createFormSchema}
        config={formConfig}
        fields={getFormFields("create")}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
```

### 4. Add to Navigation

Edit `apps/web/lib/navigation/routes.ts`:

```typescript
"people.departments": {
  path: "/people/departments",
  label: "Departments",
  parent: "people",
},
```

Edit `apps/web/lib/rbac/permissions.ts`:

```typescript
"hr.department": {
  resource: "hr.department",
  actions: ["read", "write"],
  roles: ["HR", "Admin", "Owner"],
  scope: "org",
},
```

### 5. Test

```bash
# Run dev server
pnpm dev

# Press Cmd+K and search for "Departments"
# Navigate to /people/departments
# Click "New Department" button
```

---

## Using AI (Cursor)

### Plan Implementation

```
Use prompt: docs/prompts/01-architect.md
Feature: Department Management
Spec: specs/modules/hr/department/spec.json
```

### Generate Code

```
Use prompt: docs/prompts/02-generate-types.md
Spec: specs/modules/hr/department/spec.json
```

### Review Code

```
Use prompt: docs/prompts/08-critique.md
Module: hr/department
Files: apps/web/app/(dashboard)/people/departments/**
```

---

## Available Primitives

### DataTable

```typescript
<DataTable
  columns={columns}              // From generated
  data={data}                   // From API
  serverMode                    // For 50+ rows
  totalCount={total}
  state={tableState}
  onStateChange={setTableState}
  searchKey="name"
  enableColumnFilters
  enableSorting
  enableExport
/>
```

### FormBuilder

```typescript
<FormBuilder
  form={form}
  config={formConfig}           // From generated
  fields={["name", "email"]}
  mode="create"                 // or "edit" or "readonly"
  onSubmit={handleSubmit}
/>
```

### PageShell

```typescript
<PageShell
  title="Title"
  description="Description"
  action={<Button>Action</Button>}
  breadcrumbs={[...]}
>
  {children}
</PageShell>
```

### FormDrawer

```typescript
<FormDrawer
  open={open}
  onOpenChange={setOpen}
  title="Create Item"
  schema={createSchema}         // From generated
  config={formConfig}          // From generated
  fields={getFormFields("create")}
  mode="create"
  onSubmit={handleCreate}
/>
```

---

## Testing

```bash
# Unit tests (type validation)
pnpm test

# E2E tests
pnpm test:e2e

# With UI
pnpm test:ui
pnpm test:e2e:ui
```

---

## Common Tasks

### Add New Entity

1. Create spec.json
2. Run `pnpm generate`
3. Create pages
4. Add to nav
5. Add permissions
6. Test

### Update Entity

1. Edit spec.json
2. Re-run `pnpm generate`
3. Update custom code if needed
4. Test

### Add Permission

1. Edit `lib/rbac/permissions.ts`
2. Use `<Protected>` in UI
3. Verify server-side

---

## Keyboard Shortcuts

- `Cmd/Ctrl + K` - Command palette
- `Cmd/Ctrl + /` - Toggle sidebar

---

## Documentation

- Technical decisions: `docs/DECISIONS.md`
- Development workflow: `docs/CONTRIBUTING.md`
- Spec schema: `specs/README.md`
- Generators: `scripts/README.md`
- Migrations: `migrations/README.md`

---

## Support

- Check reference modules: `people/person`, `security/isms/risk`
- Use Cursor prompts in `docs/prompts/`
- Read inline comments in generated code
- Review examples in `docs/CONTRIBUTING.md`

---

**Philosophy**: Spec first, generate second, customize last.

