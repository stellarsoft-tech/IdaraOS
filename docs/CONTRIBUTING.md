# Contributing to IdaraOS

## Module Creation Workflow

IdaraOS uses a spec-driven development approach. Every feature starts with a `spec.json` file that generates types, forms, tables, and routes.

### Step-by-Step Process

#### 1. Create a Spec File

Create a `spec.json` in `specs/modules/<area>/<module>/`:

```json
{
  "entity": "employee",
  "namespace": "people",
  "label": "Employee",
  "id": "employee_id",
  "routing": {
    "list": "/people/directory",
    "detail": "/people/directory/[employee_id]"
  },
  "permissions": {
    "read": ["HR", "Admin", "Owner"],
    "write": ["HR", "Admin", "Owner"],
    "scope": "org_id"
  },
  "fields": [
    {
      "name": "name",
      "type": "string",
      "required": true,
      "search": { "fts": true }
    },
    {
      "name": "email",
      "type": "string",
      "required": true,
      "validation": "email"
    },
    {
      "name": "role",
      "type": "string",
      "required": true
    },
    {
      "name": "status",
      "type": "enum",
      "values": ["active", "onboarding", "offboarding", "inactive"],
      "default": "active"
    },
    {
      "name": "start_date",
      "type": "date",
      "required": true
    }
  ],
  "table": {
    "columns": ["name", "email", "role", "status", "start_date"],
    "defaultSort": ["name", "asc"],
    "filters": ["status", "role"]
  },
  "forms": {
    "create": ["name", "email", "role", "start_date"],
    "edit": ["name", "email", "role", "status", "start_date"]
  }
}
```

#### 2. Run Generators

```bash
# From project root
pnpm generate specs/modules/people/employee/spec.json
```

This generates:
- `apps/web/lib/generated/people/employee/types.ts`
- `apps/web/lib/generated/people/employee/columns.tsx`
- `apps/web/lib/generated/people/employee/form-config.ts`

#### 3. Create List Page

Use generated code in `apps/web/app/(dashboard)/people/directory/page.tsx`:

```tsx
"use client"

import { DataTable } from "@/components/primitives/data-table"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { columns } from "@/lib/generated/people/employee/columns"
import { formConfig, createSchema } from "@/lib/generated/people/employee/form-config"

export default function EmployeeListPage() {
  const [open, setOpen] = useState(false)
  // TODO: Replace with real API call
  const data = []

  return (
    <PageShell
      title="Employees"
      description="Manage your organization's employees"
      action={<Button onClick={() => setOpen(true)}>Add Employee</Button>}
    >
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
      />

      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="Add Employee"
        schema={createSchema}
        config={formConfig}
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
```

#### 4. Create Detail Page

Create `apps/web/app/(dashboard)/people/directory/[id]/page.tsx`:

```tsx
"use client"

import { ResourceLayout } from "@/components/primitives/resource-layout"
import { PageShell } from "@/components/primitives/page-shell"

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  // TODO: Fetch employee data
  
  return (
    <PageShell title={employee.name}>
      <ResourceLayout
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab /> },
          { id: "history", label: "History", content: <HistoryTab /> },
        ]}
      />
    </PageShell>
  )
}
```

#### 5. Add to Navigation

Update `apps/web/components/app-sidebar.tsx`:

```tsx
{
  title: "People",
  url: "/people",
  icon: Users,
  items: [
    { title: "Directory", url: "/people/directory" },
    // ... other items
  ]
}
```

#### 6. Test

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

## Coding Standards

### TypeScript

- Use strict mode
- Avoid `any` types
- Prefer `const` over `let`
- Use descriptive variable names
- Export types for reusability

### React

- Functional components only
- Use hooks for state and effects
- Keep components small (<200 lines)
- Extract logic to custom hooks
- Use `"use client"` directive only when needed

### Styling

- Use Tailwind utility classes
- Follow design system tokens (see DECISIONS.md)
- Mobile-first responsive design
- Support light and dark modes
- Use semantic HTML

### Forms

- Always validate with Zod (client + server)
- Use react-hook-form for all forms
- Show field-level errors
- Disable submit during submission
- Success toast on completion

### Tables

- Use DataTable primitive
- Server-side pagination for 50+ rows
- Add filters for 3+ searchable fields
- Enable column visibility toggle
- Provide CSV export when relevant

### Accessibility

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus management in modals
- Color contrast ratios (WCAG AA)

## Pull Request Process

1. **Create a branch**: `feature/<module-name>` or `fix/<issue-number>`
2. **Write code**: Follow the module creation workflow
3. **Test**: Run unit and E2E tests
4. **Lint**: `pnpm lint` (auto-fix with `pnpm lint --fix`)
5. **Commit**: Use conventional commits
   - `feat: add employee directory`
   - `fix: correct date validation in forms`
   - `docs: update contributing guide`
6. **Push**: Push to your branch
7. **PR**: Open PR with description and screenshots
8. **Review**: Address feedback
9. **Merge**: Squash and merge when approved

## Using AI (Cursor)

Cursor prompts are in `docs/prompts/`. To use them:

```
Use prompt: docs/prompts/02-generate-types.md with spec: specs/modules/people/employee/spec.json
```

Available prompts:
1. `01-architect.md` - Plan implementation
2. `02-generate-types.md` - Generate types from spec
3. `03-generate-sql.md` - Generate database schema
4. `04-generate-columns.md` - Generate table columns
5. `05-generate-form.md` - Generate form config
6. `06-generate-routes.md` - Scaffold pages
7. `07-generate-tests.md` - Generate E2E tests
8. `08-critique.md` - Review implementation

## Common Tasks

### Adding a new primitive component

1. Create in `apps/web/components/primitives/`
2. Add JSDoc comments
3. Export from index file
4. Create Storybook story (optional)
5. Use in generated code

### Updating a spec

1. Edit `specs/modules/<area>/<module>/spec.json`
2. Re-run generators: `pnpm generate <spec-path>`
3. Review generated code changes
4. Update any custom code if needed
5. Test affected pages

### Adding a dependency

1. Check if it's already in `apps/web/package.json`
2. If not, justify in PR description
3. Analyze bundle size impact
4. Add to approved list in `docs/DECISIONS.md`
5. Install: `pnpm add <package> --filter web`

## Questions?

- Check `docs/DECISIONS.md` for technical decisions
- Check `specs/README.md` for spec schema docs
- Check `scripts/README.md` for generator usage
- Open a discussion for clarification

---

**Remember**: Spec first, generate second, customize last.

