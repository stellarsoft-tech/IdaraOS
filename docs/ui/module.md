# UI Module Blueprint

> **Purpose**: This document defines the standard UI patterns, components, and best practices that should be followed across all modules in IdaraOS to ensure visual consistency and a cohesive user experience.

## Module Page Structure

Every module follows a consistent page hierarchy:

```mermaid
graph TB
    subgraph "Module Structure"
        OVERVIEW[Overview Page<br/>/module]
        DIRECTORY[Directory/List Page<br/>/module/directory]
        DETAIL[Detail Page<br/>/module/directory/[slug]]
        SETTINGS[Module Settings<br/>/module/settings]
        SUBMODULES[Sub-module Pages<br/>/module/submodule]
    end
    
    OVERVIEW --> DIRECTORY
    OVERVIEW --> SUBMODULES
    DIRECTORY --> DETAIL
    OVERVIEW --> SETTINGS
```

## Standard Page Layout

### PageShell Component

Every page MUST use the `PageShell` component for consistent header layout:

```tsx
<PageShell
  title="Page Title"
  description="Brief description of the page purpose."
  action={
    <Protected module="module.submodule" action="create">
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Primary Action
      </Button>
    </Protected>
  }
>
  {/* Page content */}
</PageShell>
```

### Page Content Sections

Pages should follow this vertical structure:

1. **Stats/Summary Cards** (top-level metrics)
2. **Quick Links / Navigation Cards** (for overview pages)
3. **Primary Content** (data table, form, detail view)
4. **Secondary Content** (activity feed, related items)

```tsx
<div className="space-y-6">
  {/* 1. Stats Cards */}
  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
    {/* StatsCard components */}
  </div>

  {/* 2. Primary Content */}
  <Card>
    <CardHeader>
      <CardTitle>Section Title</CardTitle>
      <CardDescription>Section description</CardDescription>
    </CardHeader>
    <CardContent>
      {/* Content */}
    </CardContent>
  </Card>
</div>
```

## Grid Layouts

### Stats Card Grid

- **Mobile**: 1 column
- **Tablet (md)**: 2-3 columns
- **Desktop (lg)**: 4-5 columns

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {/* Stats cards */}
</div>
```

### Role/Category Cards (like Users & Access)

```tsx
<div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
  {/* Role stats cards */}
</div>
```

### Quick Link Cards

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {/* Quick link cards */}
</div>
```

## Color System

### Module Color Tokens

Each metric/status type has a consistent color:

| Type | Light Mode | Dark Mode | Usage |
|------|------------|-----------|-------|
| Primary/Default | `blue-600` | `blue-400` | Total counts, primary metrics |
| Success/Active | `green-600` | `green-400` | Active status, success states |
| Warning/Pending | `amber-600` | `amber-400` | Onboarding, pending actions |
| Danger/Error | `red-600` | `red-400` | Errors, deletions, offboarding |
| Info | `purple-600` | `purple-400` | Teams, categories, neutral info |
| Neutral | `gray-600` | `gray-400` | Inactive, disabled states |

### Background Tints

For icon backgrounds and subtle highlights:

```tsx
// Light: 10% opacity, Dark: 20-30% opacity
className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
```

## Loading States

Every data-dependent component MUST have loading skeletons:

```tsx
{isLoading ? (
  <Card className="relative overflow-hidden">
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-24" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-20 mb-1" />
      <Skeleton className="h-3 w-16" />
    </CardContent>
  </Card>
) : (
  // Actual content
)}
```

## Empty States

Provide meaningful empty states with action prompts:

```tsx
<div className="text-center py-12">
  <IconComponent className="mx-auto h-8 w-8 mb-2 text-muted-foreground opacity-50" />
  <p className="text-muted-foreground mb-4">No items found</p>
  <Protected module="module.name" action="create">
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add your first item
    </Button>
  </Protected>
</div>
```

## Permissions & RBAC

Always wrap actions in `Protected` components:

```tsx
<Protected module="module.submodule" action="create">
  <Button>Create</Button>
</Protected>
```

Access denied states should use `AccessDenied` component:

```tsx
if (!canAccess) {
  return (
    <PageShell title="Page Title">
      <AccessDenied 
        title="Access Denied" 
        description="You don't have permission to access this page." 
      />
    </PageShell>
  )
}
```

## Responsive Design

- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Mobile-first approach (base styles are for mobile)
- Critical breakpoints:
  - `sm`: 640px (tablet portrait)
  - `md`: 768px (tablet landscape)
  - `lg`: 1024px (desktop)
  - `xl`: 1280px (large desktop)

## See Also

- [Stats Card Component](./components/stats-card.md)
- [Page Layout Patterns](./components/page-layout.md)
- [Buttons & CTAs](./components/buttons-ctas.md)
- [Data Display](./components/data-display.md)
