# Technical Decisions

This document records all frozen architectural and technology decisions for IdaraOS. All AI code generation and development must adhere to these decisions.

## Stack (Frozen)

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript 5+
- **UI Library**: React 19+
- **Styling**: Tailwind CSS 4+
- **Components**: shadcn/ui (Radix UI primitives)
- **Forms**: react-hook-form + Zod + @hookform/resolvers
- **Tables**: TanStack Table v8
- **State Management**: React hooks + Context (no Redux/Zustand unless necessary)
- **Icons**: lucide-react

### Data Layer (Decided)
- **Choice**: TanStack Query (React Query) + Typed Fetch API
- **Rationale**: 
  - Simple, no lock-in to specific backend
  - Works with any REST API
  - Type-safe with TypeScript
  - Excellent caching and state management
  - Can switch backends later without frontend changes
- **Backend Options** (choose based on project needs):
  - REST API with Express/Fastify
  - Next.js API Routes
  - PostgREST (direct Postgres)
  - Hasura (GraphQL)
  - tRPC (if full-stack TS)
- **Implementation**: `apps/web/lib/api/` contains typed clients

### Database & Migrations (Decided)
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Migrations**: Simple SQL files in `migrations/` folder
  - Timestamp-based naming: `{timestamp}_description.sql`
  - Run manually or via script
  - Generated from spec.json via `pnpm generate`
- **ORM**: None initially (raw SQL for flexibility)
  - Can add Drizzle or Prisma later if needed
- **Connection**: Direct PostgreSQL client or pg-pool

### Backend Services (To Be Decided)
- **Jobs**: BullMQ + Valkey (start) or Temporal (scale later)
- **Search**: Algolia or self-hosted (Meilisearch/Typesense)
- **Decision Pending**: Start simple, scale as needed

### Testing
- **Unit Tests**: Vitest
- **E2E Tests**: Playwright
- **Component Tests**: Storybook (for primitives only)

### Monorepo
- **Package Manager**: pnpm
- **Workspace**: pnpm workspaces
- **Structure**: apps/, specs/, scripts/

## Development Principles

### Spec-First Development
1. Every module starts with a `spec.json` file
2. Generators create types, forms, tables, and routes from specs
3. No manual code until generated code is reviewed
4. Specs are the single source of truth

### Code Generation
- **Tool**: Template strings (simple cases) or ts-morph (complex)
- **Output**: `apps/web/lib/generated/<module>/`
- **Never edit generated files manually** - edit the spec instead

### Approved Dependencies Only
- **No new npm packages** without updating this document
- Request approval in PR with justification
- Keep bundle size minimal

### Current Approved Dependencies
See `apps/web/package.json` for the approved list. New additions require:
1. Clear justification
2. Bundle size analysis
3. Alternative evaluation
4. Update to this document

## Design System

### Spacing
- Base: 4px
- Scale: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96

### Border Radius
- Default: `xl` (0.75rem) for cards
- Large: `2xl` (1rem) for modals
- Small: `lg` (0.5rem) for inputs

### Typography
- Base: 14-16px
- Headings: defined in Tailwind config
- Line height: 1.5 (body), 1.2 (headings)

### Colors
- Use CSS variables for theming
- Support light and dark modes
- Defined in `apps/web/app/globals.css`

## RBAC Model

### Roles
- **Owner**: Full system access
- **Admin**: All modules except billing/org settings
- **HR**: People, onboarding, time-off
- **Security**: Security, compliance, audits
- **Auditor**: Read-only across all compliance data
- **User**: Limited access based on assignments

### Scoping
- All data scoped by `org_id`
- Row-level security (RLS) enforced at database
- UI guards via hooks: `usePermission(action, resource)`
- Never trust client-only checks

## File Structure

### Generated Code
```
apps/web/lib/generated/
  <module>/
    types.ts         # Zod schemas + TS types
    columns.tsx      # Table column definitions
    form-config.ts   # Form field configurations
```

### Primitives
```
apps/web/components/primitives/
  data-table.tsx
  form-builder.tsx
  page-shell.tsx
  resource-layout.tsx
  form-drawer.tsx
```

### Module Pages
```
apps/web/app/(dashboard)/<area>/<module>/
  page.tsx         # List view
  [id]/page.tsx    # Detail view
```

## Non-Negotiables

1. **TypeScript strict mode**: Always
2. **Zod validation**: Client + server
3. **RLS first**: Security at database layer
4. **Mobile responsive**: Every page
5. **Accessibility**: WCAG 2.1 AA minimum
6. **Performance**: LCP < 2.5s, FID < 100ms
7. **Bundle size**: Monitor, optimize, tree-shake

## Change Process

To change any frozen decision:
1. Open an issue with "Decision Change" label
2. Provide evidence and alternatives
3. Team discussion required
4. Update this document
5. Migration plan if existing code affected

---

**Last Updated**: 2024-11-29
**Next Review**: 2025-02-28

