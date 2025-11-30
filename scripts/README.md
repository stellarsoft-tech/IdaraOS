# Code Generators

This directory contains TypeScript generators that create code from `spec.json` files.

## Overview

Generators read a module's `spec.json` and produce:

1. **types.ts**: Zod schemas + TypeScript types
2. **columns.tsx**: TanStack Table column definitions
3. **form-config.ts**: react-hook-form field configurations

All generated code outputs to: `apps/web/lib/generated/<namespace>/<entity>/`

## Usage

### Generate from a single spec

```bash
pnpm generate specs/modules/people/person/spec.json
```

### Watch mode (regenerate on changes)

```bash
pnpm generate:watch
```

### Generate all specs

```bash
pnpm generate:all
```

## Generator Scripts

### 1. types.ts - Type Generator

**Input**: `spec.json`

**Output**: `apps/web/lib/generated/<module>/types.ts`

**Generates**:
- Zod schema for validation
- TypeScript types (inferred from Zod)
- Field metadata for UI (labels, placeholders, help text)

**Example Output**:

```typescript
import { z } from "zod"

// Zod schema
export const personSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.string().min(1, "Role is required"),
  status: z.enum(["active", "onboarding", "offboarding", "inactive"]),
  start_date: z.string(),
})

// TypeScript types
export type Person = z.infer<typeof personSchema>
export type PersonInput = z.infer<typeof personSchema>

// Field metadata
export const personFields = {
  name: {
    label: "Name",
    placeholder: "Enter name",
    type: "text"
  },
  email: {
    label: "Email",
    placeholder: "Enter email",
    type: "email"
  },
  // ... more fields
}
```

### 2. columns.tsx - Table Column Generator

**Input**: `spec.json`

**Output**: `apps/web/lib/generated/<module>/columns.tsx`

**Generates**:
- TanStack Table column definitions
- Cell renderers based on field type
- Sort/filter configurations

**Example Output**:

```typescript
import { ColumnDef } from "@tanstack/react-table"
import { StatusBadge } from "@/components/status-badge"
import { Person } from "./types"

export const columns: ColumnDef<Person>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return <StatusBadge variant={statusVariants[status]}>{status}</StatusBadge>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  // ... more columns
]
```

### 3. form-config.ts - Form Configuration Generator

**Input**: `spec.json`

**Output**: `apps/web/lib/generated/<module>/form-config.ts`

**Generates**:
- Form field configurations
- Component mapping (type → shadcn component)
- Validation schemas for create/edit

**Example Output**:

```typescript
import { personSchema } from "./types"
import { z } from "zod"

export const createSchema = personSchema.omit({ person_id: true })
export const editSchema = personSchema

export const formConfig = {
  name: {
    component: "input",
    label: "Name",
    placeholder: "Enter name",
    required: true,
  },
  email: {
    component: "input",
    type: "email",
    label: "Email",
    placeholder: "Enter email",
    required: true,
  },
  status: {
    component: "select",
    label: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "onboarding", label: "Onboarding" },
      { value: "offboarding", label: "Offboarding" },
      { value: "inactive", label: "Inactive" },
    ],
    required: true,
  },
  // ... more fields
}
```

### 4. index.ts - CLI Runner

**Input**: Command-line arguments

**Runs**: All generators in sequence

**Usage**:

```bash
node scripts/generate/index.js <spec-path>
```

## How Generators Work

1. **Read Spec**: Parse `spec.json` and validate structure
2. **Transform**: Map spec fields to code constructs
3. **Template**: Use template strings to generate code
4. **Write**: Output to `apps/web/lib/generated/`
5. **Format**: Run prettier on generated files (optional)

## Type Mapping

| Spec Type | Zod Schema | TS Type | Component | Cell Renderer |
|-----------|------------|---------|-----------|---------------|
| string | z.string() | string | Input | Text |
| text | z.string() | string | Textarea | Truncated text |
| number | z.number() | number | Input[type=number] | Number |
| boolean | z.boolean() | boolean | Switch | Check/X icon |
| date | z.string() | string | DatePicker | Formatted date |
| enum | z.enum([...]) | union | Select | StatusBadge |
| uuid | z.string().uuid() | string | AsyncSelect | Linked name |
| computed | (none) | inferred | (none) | Computed value |

## Validation Mapping

| Spec Validation | Zod Method |
|-----------------|------------|
| required: true | No .optional() |
| validation: "email" | .email() |
| validation: "url" | .url() |
| validation: "min:3" | .min(3) |
| validation: "max:255" | .max(255) |
| values: [...] | .enum([...]) |

## Cell Renderer Logic

```typescript
// Enum fields → StatusBadge
if (field.type === "enum") {
  return `<StatusBadge variant={getVariant(value)}>{value}</StatusBadge>`
}

// Reference fields → Linked name
if (field.ref) {
  return `<Link href={getDetailUrl(value)}>{getName(value)}</Link>`
}

// Date fields → Formatted date
if (field.type === "date") {
  return `{format(new Date(value), "MMM d, yyyy")}`
}

// Default → Plain text
return `{value}`
```

## Adding a New Generator

1. Create `scripts/generate/new-generator.ts`
2. Export a function: `export async function generateNew(spec: Spec): Promise<string>`
3. Add to `scripts/generate/index.ts`
4. Update this README

## Troubleshooting

### Generator fails with "Invalid spec"

- Check spec.json syntax (valid JSON)
- Ensure required fields are present
- Validate field types against supported types
- Check for circular references

### Generated code has type errors

- Re-run generator after spec changes
- Check if custom types are imported
- Ensure ref targets exist

### Generated code not formatted

- Run `pnpm format` after generation
- Or integrate prettier into generator

## Development

### Run generator locally

```bash
cd scripts/generate
npx tsx index.ts ../../specs/modules/people/person/spec.json
```

### Test generators

```bash
pnpm test:generators
```

---

**Remember**: Generators are tools, not gospel. Customize generated code when needed, but always regenerate from spec when the spec changes.

