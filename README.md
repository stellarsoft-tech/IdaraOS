# IdaraOS - AI-First Spec-Driven Development System

A modern, spec-driven operating system for organizational management with automated code generation from JSON specifications.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Generate code from spec
pnpm generate specs/modules/people/person/spec.json
```

## 📁 Project Structure

```
IdaraOS/
├── apps/web/              # Next.js application
│   ├── app/               # App Router pages
│   ├── components/        # React components
│   │   └── primitives/    # Reusable primitives (DataTable, FormBuilder, etc.)
│   └── lib/               # Utilities and generated code
│       └── generated/     # Auto-generated from specs
├── specs/                 # Module specifications (JSON)
│   └── modules/           # Organized by domain
├── scripts/               # Code generators
│   └── generate/          # Type-safe generators
└── docs/                  # Documentation
    ├── DECISIONS.md       # Technical decisions (frozen)
    ├── CONTRIBUTING.md    # Development workflow
    └── prompts/           # Cursor AI prompts (8 systematic prompts)
```

## 🎯 Core Concepts

### Spec-Driven Development

Every module starts with a `spec.json` file that serves as the single source of truth:

```json
{
  "entity": "person",
  "namespace": "people",
  "fields": [...],
  "table": {...},
  "forms": {...},
  "permissions": {...}
}
```

### Code Generation

From a spec, the system generates:

1. **Types** (`types.ts`): Zod schemas + TypeScript types
2. **Columns** (`columns.tsx`): TanStack Table column definitions
3. **Forms** (`form-config.ts`): Form field configurations

### Primitives

Feature-complete, reusable components:

- **DataTable**: Server-side pagination, filters, sorting, virtualization, CSV export
- **FormBuilder**: Schema-driven forms with validation
- **PageShell**: Standard page layout with breadcrumbs
- **ResourceLayout**: Tab-based resource views
- **FormDrawer**: Create/edit drawer with FormBuilder

## 🛠️ Development Workflow

### 1. Create a Spec

```bash
# Create spec file
specs/modules/[area]/[module]/spec.json
```

### 2. Generate Code

```bash
pnpm generate specs/modules/[area]/[module]/spec.json
```

This creates:
- `apps/web/lib/generated/[module]/types.ts`
- `apps/web/lib/generated/[module]/columns.tsx`
- `apps/web/lib/generated/[module]/form-config.ts`

### 3. Create Pages

Use generated artifacts with primitives:

```typescript
import { DataTable } from "@/components/primitives/data-table"
import { columns } from "@/lib/generated/[module]/columns"

export default function ListPage() {
  return (
    <DataTable
      columns={columns}
      data={data}
      serverMode
      totalCount={total}
      state={tableState}
      onStateChange={setTableState}
    />
  )
}
```

### 4. Use AI Prompts

Cursor prompts guide development:

1. `docs/prompts/01-architect.md` - Plan implementation
2. `docs/prompts/02-generate-types.md` - Generate types
3. `docs/prompts/03-generate-sql.md` - Generate database schema
4. `docs/prompts/04-generate-columns.md` - Generate table columns
5. `docs/prompts/05-generate-form.md` - Generate form config
6. `docs/prompts/06-generate-routes.md` - Scaffold pages
7. `docs/prompts/07-generate-tests.md` - Generate E2E tests
8. `docs/prompts/08-critique.md` - AI self-review

## 📚 Documentation

- **[DECISIONS.md](docs/DECISIONS.md)**: Frozen technical decisions
- **[CONTRIBUTING.md](docs/CONTRIBUTING.md)**: Module creation workflow
- **[specs/README.md](specs/README.md)**: Spec schema documentation
- **[scripts/README.md](scripts/README.md)**: Generator usage guide

## 🔑 Key Features

### DataTable v2
- ✅ Server-side pagination, sorting, filtering
- ✅ Column visibility, reordering, resizing
- ✅ Row selection with bulk actions
- ✅ Virtualization for 10k+ rows
- ✅ CSV export
- ✅ Faceted filters with chips
- ✅ Loading skeletons, empty states

### FormBuilder
- ✅ Schema-driven (Zod + react-hook-form)
- ✅ All field types (text, select, date, boolean, etc.)
- ✅ Async select for references
- ✅ Create/edit/readonly modes
- ✅ Validation with helpful error messages

### Code Generators
- ✅ TypeScript + Zod schemas
- ✅ TanStack Table columns with renderers
- ✅ Form configurations with component mappings
- ✅ Type-safe throughout

## 🎨 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS 4, shadcn/ui (Radix UI)
- **Forms**: react-hook-form + Zod
- **Tables**: TanStack Table v8 + TanStack Virtual
- **Package Manager**: pnpm (workspaces)

## 📦 Monorepo Structure

- `apps/web` - Main Next.js application
- `specs` - Module specifications
- `scripts` - Code generators

## 🚧 Current Status

**Completed:**
- ✅ Monorepo setup with pnpm workspaces
- ✅ Spec schema with Zod validator
- ✅ 4 code generators (types, columns, forms, CLI)
- ✅ DataTable v2 with all features
- ✅ FormBuilder component
- ✅ Layout primitives (PageShell, ResourceLayout, FormDrawer)
- ✅ 8 systematic Cursor prompts
- ✅ Essential documentation (no bloat)
- ✅ 2 reference specs (person, risk)

**Next Steps:**
- 🔄 Test generators with example specs
- 🔄 Setup MDX for business content
- 🔄 Refactor example modules using generators
- 🔄 Add testing infrastructure (Vitest + Playwright)

## 💡 Philosophy

1. **Spec-first**: JSON spec is the single source of truth
2. **Generate, don't write**: Let AI and generators handle boilerplate
3. **Minimal docs**: Code and specs are documentation
4. **AI-assisted**: Systematic prompts guide development
5. **No lock-in**: Standard tools, replaceable components

## 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the complete development workflow.

## 📝 License

[Your License Here]

---

**Built with ❤️ for developers who value speed, consistency, and AI-first workflows.**
