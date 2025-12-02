# Buttons & CTAs

> **Purpose**: Define button patterns, variants, and call-to-action styling for consistency across all modules.

## Button Variants

### Primary Button (Default)

Used for main actions (Create, Save, Submit):

```tsx
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>
```

### Secondary Button (Outline)

Used for secondary actions (Sync, Export, Filter):

```tsx
<Button variant="outline">
  <RefreshCw className="mr-2 h-4 w-4" />
  Sync
</Button>
```

### Destructive Button

Used for delete/remove actions:

```tsx
<Button 
  variant="ghost"
  className="text-destructive hover:text-destructive"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

### Ghost Button (Icon Only)

Used for inline actions in tables:

```tsx
<Button variant="ghost" size="icon" className="h-8 w-8">
  <UserCog className="h-4 w-4" />
  <span className="sr-only">Edit</span>
</Button>
```

## Icon Placement

Icons should appear BEFORE text with `mr-2` spacing:

```tsx
// ✅ Correct
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add User
</Button>

// ❌ Incorrect
<Button>
  Add User
  <Plus className="ml-2 h-4 w-4" />
</Button>
```

## Icon Sizes

- **Standard buttons**: `h-4 w-4`
- **Large buttons**: `h-5 w-5`
- **Icon-only buttons**: `h-4 w-4` in `size="icon"` button

## Loading States

Always show loading indicator when action is pending:

```tsx
<Button disabled={isPending}>
  {isPending ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Plus className="mr-2 h-4 w-4" />
  )}
  {isPending ? "Adding..." : "Add User"}
</Button>
```

Simplified pattern when label doesn't change:

```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {!isPending && <Plus className="mr-2 h-4 w-4" />}
  Add User
</Button>
```

## Page Header Actions

### Single Action

```tsx
action={
  <Protected module="module.name" action="create">
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add Item
    </Button>
  </Protected>
}
```

### Multiple Actions (Order: Secondary → Primary)

```tsx
action={
  <div className="flex items-center gap-2">
    {/* Secondary action with tooltip */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from Entra
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sync users and groups from Microsoft Entra ID</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* Primary action */}
    <Button onClick={handleCreate}>
      <Plus className="mr-2 h-4 w-4" />
      Add User
    </Button>
  </div>
}
```

## Table Row Actions

```tsx
<div className="flex items-center gap-1">
  {canEdit && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(item)}
          >
            <UserCog className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
  
  {canDelete && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
</div>
```

## Dialog/Sheet Footer Actions

Order: Cancel → Primary (left to right):

```tsx
<SheetFooter>
  <Button variant="outline" onClick={() => setOpen(false)}>
    Cancel
  </Button>
  <Button 
    onClick={handleSubmit}
    disabled={isSubmitting || !isValid}
  >
    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {mode === "edit" ? "Update" : "Create"}
  </Button>
</SheetFooter>
```

## Delete Confirmation Dialog

```tsx
<AlertDialogFooter>
  <AlertDialogCancel>Cancel</AlertDialogCancel>
  <AlertDialogAction
    onClick={handleDelete}
    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
  >
    {isDeleting ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Trash2 className="mr-2 h-4 w-4" />
    )}
    Delete
  </AlertDialogAction>
</AlertDialogFooter>
```

## Empty State CTA

```tsx
<div className="text-center py-12">
  <Users className="mx-auto h-8 w-8 mb-2 text-muted-foreground opacity-50" />
  <p className="text-muted-foreground mb-4">No users found</p>
  <Protected module="settings.users" action="create">
    <Button onClick={handleCreate}>
      <Plus className="mr-2 h-4 w-4" />
      Add your first user
    </Button>
  </Protected>
</div>
```

## Common Icon Mappings

| Action | Icon | Import |
|--------|------|--------|
| Create/Add | `Plus` | `lucide-react` |
| Edit | `UserCog` or `Pencil` | `lucide-react` |
| Delete | `Trash2` | `lucide-react` |
| Sync/Refresh | `RefreshCw` | `lucide-react` |
| Save | `Save` | `lucide-react` |
| Cancel | (none - text only) | - |
| Loading | `Loader2` | `lucide-react` |
| Back | `ArrowLeft` | `lucide-react` |
| External Link | `ExternalLink` | `lucide-react` |
| Download | `Download` | `lucide-react` |
| Upload | `Upload` | `lucide-react` |

## Disabled States

Buttons should be disabled when:
- Form is invalid
- Action is pending
- User lacks permission (use `Protected` wrapper instead)
- Item is locked (e.g., SCIM-provisioned)

```tsx
<Button 
  disabled={
    isPending || 
    !formData.name.trim() || 
    !formData.email.trim()
  }
>
  Submit
</Button>
```

## Accessibility

- Always include `<span className="sr-only">` for icon-only buttons
- Use proper `aria-label` for context
- Ensure focus states are visible
- Tooltips should describe the action
