# Prompt: Generate Table Columns from Spec

## Role
You are generating TanStack Table column definitions from a JSON specification.

## Context
- Input: `[SPEC_PATH]` (spec.json file)
- Output: `apps/web/lib/generated/[module]/columns.tsx`
- Reference: Generated types from 02-generate-types.md

## Task
Generate column definitions with appropriate cell renderers and filter functions.

## Requirements

1. **Run the Generator**
   ```bash
   pnpm generate [SPEC_PATH]
   ```

2. **Verify Generated Columns**
   Check `apps/web/lib/generated/[module]/columns.tsx`:
   - All fields from `spec.table.columns` are present
   - Cell renderers match field types
   - Sortable columns have sort config
   - Filterable columns have filter functions
   - Status variants are defined for enums

3. **Cell Renderer Guidelines**
   - **Enums**: Use `<StatusBadge>` with variants
   - **Dates**: Format with `date-fns`
   - **References**: Show linked entity name (TODO: fetch)
   - **Booleans**: Use ✓/✗ or Yes/No
   - **Numbers**: Right-align, format with commas
   - **Computed**: Display read-only with mono font

4. **Manual Enhancements** (if needed)
   - Add custom cell renderers for complex data
   - Implement reference field fetching
   - Add column-specific actions (edit, delete)
   - Customize sorting logic

## Example Column

```typescript
{
  accessorKey: "status",
  header: "Status",
  cell: ({ row }) => {
    const value = row.getValue("status") as string
    return (
      <StatusBadge variant={riskStatusVariants[value]}>
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </StatusBadge>
    )
  },
  filterFn: (row, id, value) => {
    if (!value || value.length === 0) return true
    return value.includes(row.getValue(id))
  }
}
```

## Common Customizations

### Multi-line Cell Content
```typescript
cell: ({ row }) => (
  <div>
    <p className="font-medium">{row.getValue("title")}</p>
    <p className="text-xs text-muted-foreground">
      {row.getValue("description")}
    </p>
  </div>
)
```

### Action Column
```typescript
{
  id: "actions",
  cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEdit(row.original)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDelete(row.original)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Sort by Computed Field
```typescript
sortingFn: (rowA, rowB, columnId) => {
  const a = computeRiskLevel(rowA.original)
  const b = computeRiskLevel(rowB.original)
  return a - b
}
```

## Output Format

```markdown
✅ Generated columns for [entity_name]

**Files created:**
- apps/web/lib/generated/[module]/columns.tsx

**Columns:**
- [field1]: Text with link
- [field2]: StatusBadge with variants
- [field3]: Formatted date
- [field4]: Computed value

**Filters enabled:**
- [field1]: Text search
- [field2]: Multi-select
- [field3]: Date range

**Manual enhancements needed:**
- [ ] None
OR
- [ ] Implement reference fetching for [ref_field]
- [ ] Add action column for edit/delete
- [ ] Custom renderer for [complex_field]
```

## Example Usage

```
Use prompt: docs/prompts/04-generate-columns.md
Spec: specs/modules/security/isms/risk/spec.json
```

## Do NOT
- Edit generated file directly (regenerate from spec)
- Forget to import required components (StatusBadge, format, etc.)
- Skip filter functions for filterable columns
- Use inline styles (use Tailwind classes)

## Next Steps
1. Test columns in DataTable component
2. Verify sorting and filtering work
3. Proceed to 05-generate-form.md

