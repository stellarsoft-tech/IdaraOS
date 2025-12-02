# Forms & Input Patterns

> **Purpose**: Define consistent form layouts, validation patterns, and input styling across all modules.

## Form Containers

### Sheet/Drawer Forms

Used for create/edit operations without leaving the page:

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent className="overflow-y-auto flex flex-col sm:max-w-lg">
    <SheetHeader>
      <SheetTitle>{mode === "edit" ? "Edit Item" : "Add Item"}</SheetTitle>
      <SheetDescription>
        {mode === "edit"
          ? "Update item details."
          : "Add a new item to the system."}
      </SheetDescription>
    </SheetHeader>

    <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
      {/* Form fields */}
    </div>

    <SheetFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={isPending || !isValid}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "edit" ? "Update" : "Create"}
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Card-based Forms

Used for settings pages:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
    <CardDescription>Description of this settings section</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Form fields */}
  </CardContent>
  <CardFooter className="border-t pt-4">
    <Button onClick={handleSave} disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Save Changes
    </Button>
  </CardFooter>
</Card>
```

## Input Fields

### Text Input

```tsx
<div className="space-y-2">
  <Label htmlFor="name">Full Name</Label>
  <Input
    id="name"
    value={formData.name}
    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
    placeholder="Enter full name"
    disabled={isLocked}
  />
</div>
```

### Email Input

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    value={formData.email}
    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
    placeholder="user@example.com"
    disabled={isLocked}
  />
</div>
```

### Select/Dropdown

```tsx
<div className="space-y-2">
  <Label htmlFor="status">Status</Label>
  <Select
    value={formData.status}
    onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
    disabled={isLocked}
  >
    <SelectTrigger className="w-full" disabled={isLocked}>
      <SelectValue placeholder="Select status" />
    </SelectTrigger>
    <SelectContent>
      {statusOptions.map((status) => (
        <SelectItem key={status} value={status}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### Entity Link Select

```tsx
<div className="space-y-2">
  <Label htmlFor="personId">Link to Person (Directory)</Label>
  <Select
    value={formData.personId || "none"}
    onValueChange={(value) => setFormData((prev) => ({ 
      ...prev, 
      personId: value === "none" ? "" : value 
    }))}
    disabled={isLocked}
  >
    <SelectTrigger className="w-full" disabled={isLocked}>
      <SelectValue placeholder="Select a person to link..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">No link</SelectItem>
      {availableOptions.map((option) => (
        <SelectItem key={option.id} value={option.id}>
          <div className="flex items-center gap-2">
            <span>{option.name}</span>
            <span className="text-xs text-muted-foreground">({option.email})</span>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    Link this user account to an employee in the People Directory.
  </p>
</div>
```

## Checkbox Groups

### Role Assignment

```tsx
<div className="space-y-4">
  <Label>Assign Roles</Label>
  <p className="text-sm text-muted-foreground">
    Select which roles this user should have.
  </p>
  
  <div className="space-y-3">
    {roles.map((role) => (
      <div 
        key={role.id} 
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          isDisabled 
            ? "bg-muted/30 border-blue-200 dark:border-blue-800" 
            : "hover:bg-muted/50"
        }`}
      >
        <Checkbox
          id={role.id}
          checked={formData.roleIds.includes(role.id)}
          onCheckedChange={() => handleRoleToggle(role.id)}
          disabled={isDisabled}
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label 
              htmlFor={role.id} 
              className={isDisabled ? "text-muted-foreground" : "cursor-pointer"}
            >
              {role.name}
            </Label>
            <Badge className={getRoleColorClass(role.color)}>
              {role.permissionCount} permissions
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {role.description || "No description"}
          </p>
        </div>
        {isDisabled && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
    ))}
  </div>

  {formData.roleIds.length === 0 && !isLocked && (
    <p className="text-sm text-amber-600 dark:text-amber-400">
      ⚠️ User will have no permissions if no roles are assigned.
    </p>
  )}
</div>
```

## Alerts & Warnings

### Informational Alert

```tsx
<Alert variant="default" className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
  <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
  <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
    Some roles are synced from Entra ID and cannot be modified here.
  </AlertDescription>
</Alert>
```

### Lock/Readonly Alert

```tsx
<Alert variant="default" className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
  <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
  <AlertDescription className="text-emerald-700 dark:text-emerald-300 text-sm">
    This item is provisioned via SCIM and cannot be edited here.
  </AlertDescription>
</Alert>
```

### Warning Alert

```tsx
<Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
  <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
  <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
    <strong>Warning:</strong> This action will also affect related items.
  </AlertDescription>
</Alert>
```

## Searchable Popovers

### Entity Search (e.g., Entra Users)

```tsx
<Popover open={searchOpen} onOpenChange={setSearchOpen}>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={searchOpen}
      className="w-full justify-start text-muted-foreground"
    >
      <Search className="mr-2 h-4 w-4" />
      Search Entra ID users...
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[400px] p-0" align="start">
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search by name or email..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </div>
          ) : searchQuery.length < 1 ? (
            "Type to search..."
          ) : (
            "No results found."
          )}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={result.id}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarFallback>{getInitials(result.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{result.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

## Dividers

### "Or" Divider

```tsx
<div className="relative">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">
      Or enter manually
    </span>
  </div>
</div>
```

## Validation Messages

### Field-level Warning

```tsx
{formData.roleIds.length === 0 && (
  <p className="text-sm text-amber-600 dark:text-amber-400">
    ⚠️ User will have no permissions if no roles are assigned.
  </p>
)}
```

### Helper Text

```tsx
<p className="text-xs text-muted-foreground">
  Link this user account to an employee in the People Directory.
</p>
```

## Form Spacing

- **Field groups**: `space-y-4`
- **Sections**: `space-y-6`
- **Field + label**: `space-y-2`
- **Checkbox items**: `space-y-3`
