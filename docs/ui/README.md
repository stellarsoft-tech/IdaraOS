# UI Design System & Blueprint

> **Purpose**: This directory contains the UI design system documentation for IdaraOS. These documents define the standard patterns, components, and best practices that ensure visual consistency across all modules.

## Quick Links

| Document | Description |
|----------|-------------|
| [Module Blueprint](./module.md) | Standard module structure, layouts, and patterns |
| [Stats Card](./components/stats-card.md) | Top-level metric cards with gradient accent |
| [Page Layout](./components/page-layout.md) | Page structure for different page types |
| [Buttons & CTAs](./components/buttons-ctas.md) | Button patterns and call-to-actions |
| [Data Display](./components/data-display.md) | Tables, badges, lists, and data presentation |
| [Forms](./components/forms.md) | Input fields, validation, and form layouts |

## Design Principles

### 1. Consistency First

All modules should look and feel like part of the same application. Use the documented patterns instead of inventing new ones.

### 2. Dark Mode Support

Every color choice must work in both light and dark modes. Use Tailwind's `dark:` variant for all color specifications.

### 3. Responsive Design

All layouts must be mobile-first and responsive. Use the standard breakpoints:
- `sm`: 640px
- `md`: 768px  
- `lg`: 1024px
- `xl`: 1280px

### 4. Accessible by Default

- All interactive elements must be keyboard accessible
- Icon-only buttons require `sr-only` labels
- Colors must meet contrast requirements
- Loading and error states must be communicated

### 5. Performance Aware

- Use skeleton loaders for better perceived performance
- Lazy load non-critical components
- Optimize images and assets

## Key Visual Elements

### The Gradient Accent

Our signature visual element is a subtle radial gradient in the top-right corner of cards:

```tsx
<div
  className="absolute top-0 right-0 w-16 h-16 opacity-5"
  style={{
    background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
  }}
/>
```

This should be applied to:
- ✅ Stats/metric cards on directory pages
- ✅ Role/category summary cards
- ❌ Data table cards (keep clean)
- ❌ Form cards (keep focused)

### Color Palette

| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Blue | `blue-600` | `blue-400` | Primary actions, totals |
| Green | `green-600` | `green-400` | Success, active states |
| Amber | `amber-600` | `amber-400` | Warnings, pending |
| Red | `red-600` | `red-400` | Errors, destructive |
| Purple | `purple-600` | `purple-400` | Categories, special |
| Gray | `gray-600` | `gray-400` | Neutral, disabled |

### Background Tints

For subtle backgrounds, use 10% opacity in light mode, 20% in dark:

```tsx
className="bg-blue-500/10 dark:bg-blue-500/20"
```

## When to Reference These Docs

- **Creating a new module**: Start with [Module Blueprint](./module.md)
- **Adding metrics/stats**: See [Stats Card](./components/stats-card.md)
- **Building a list/directory page**: See [Page Layout](./components/page-layout.md)
- **Adding actions/buttons**: See [Buttons & CTAs](./components/buttons-ctas.md)
- **Displaying data**: See [Data Display](./components/data-display.md)
- **Building forms**: See [Forms](./components/forms.md)

## Component Library

IdaraOS uses [shadcn/ui](https://ui.shadcn.com/) as its component foundation. All custom patterns documented here are built on top of shadcn components.

Key components:
- `Card`, `CardHeader`, `CardContent`, `CardFooter`
- `Button` (with variants)
- `Sheet`, `SheetContent`, `SheetHeader`, `SheetFooter`
- `DataTableAdvanced` (custom wrapper)
- `PageShell` (custom layout component)
- `StatusBadge` (custom badge component)
- `Protected`, `AccessDenied` (RBAC components)

## Contributing

When adding new patterns:

1. Document the pattern in the appropriate file
2. Include code examples with proper TypeScript types
3. Show both light and dark mode considerations
4. List do's and don'ts
5. Reference related patterns
