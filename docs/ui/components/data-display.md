# Data Display Patterns

> **Purpose**: Define consistent patterns for displaying data in tables, lists, cards, and badges across all modules.

## Data Tables

### Standard Table in Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>All Items</CardTitle>
    <CardDescription>Description of the data being displayed</CardDescription>
  </CardHeader>
  <CardContent>
    <DataTableAdvanced
      columns={columns}
      data={items}
      loading={isLoading}
      searchKey="name"
      searchPlaceholder="Search items..."
      facetedFilters={{
        status: {
          type: "enum",
          options: statusOptions,
        },
      }}
      emptyState={<EmptyState />}
    />
  </CardContent>
</Card>
```

### Column Types

#### User/Person Column with Avatar

```tsx
{
  accessorKey: "name",
  header: "User",
  cell: ({ row }) => {
    const user = row.original
    const initials = user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
    )
  },
}
```

#### Status Column with Badge

```tsx
{
  accessorKey: "status",
  header: "Status",
  cell: ({ row }) => {
    const status = row.getValue("status") as string
    return (
      <StatusBadge variant={statusColors[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </StatusBadge>
    )
  },
}
```

#### Date Column

```tsx
{
  accessorKey: "createdAt",
  header: "Created",
  cell: ({ row }) => {
    const date = row.getValue("createdAt") as string | null
    if (!date) return <span className="text-muted-foreground">—</span>
    return new Date(date).toLocaleDateString()
  },
}
```

#### Link Badges Column

```tsx
{
  id: "links",
  header: "Links",
  cell: ({ row }) => {
    const item = row.original
    return (
      <div className="flex items-center gap-1.5">
        {item.hasLinkedPerson && (
          <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0.5">
            <User className="h-3 w-3" />
            Person
          </Badge>
        )}
        {item.hasEntraLink && (
          <Badge className="gap-1 text-xs px-1.5 py-0.5 bg-[#0078D4]/10 text-[#0078D4] dark:bg-[#0078D4]/20 dark:text-[#4DA6FF] border-0">
            <Building2 className="h-3 w-3" />
            Entra
          </Badge>
        )}
        {!item.hasLinkedPerson && !item.hasEntraLink && (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>
    )
  },
}
```

## Status Badges

### StatusBadge Variants

| Variant | Color | Usage |
|---------|-------|-------|
| `default` | Gray | Default/unknown |
| `success` | Green | Active, complete |
| `info` | Blue | Invited, in progress |
| `warning` | Amber | Pending, onboarding |
| `danger` | Red | Error, deactivated |
| `purple` | Purple | Special categories |

```tsx
<StatusBadge variant="success">Active</StatusBadge>
<StatusBadge variant="info">Invited</StatusBadge>
<StatusBadge variant="warning">Pending</StatusBadge>
<StatusBadge variant="danger">Deactivated</StatusBadge>
```

### Role Badges with Color

```tsx
function getRoleColorClass(color: string | null): string {
  const colors: Record<string, string> = {
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    gray: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  }
  return colors[color || "gray"] || colors.gray
}

<Badge className={getRoleColorClass(role.color)}>
  {role.name}
</Badge>
```

### Sync Indicator Badge

```tsx
<Badge className="gap-1 text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
  <RefreshCw className="h-3 w-3" />
  Sync
</Badge>
```

## Quick Link Cards

```tsx
function QuickLinkCard({ href, icon, title, description, count, badge, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-40 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group hover:border-primary/30 hover:shadow-md transition-all duration-200">
      <Link href={href} className="block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground group-hover:text-primary transition-colors">
              {icon}
            </span>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {badge || <span className="text-2xl font-bold">{count ?? 0}</span>}
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
```

## Activity Lists

```tsx
function ActivityItem({ icon, iconBg, title, subtitle, time }: Props) {
  return (
    <div className="flex items-center gap-4">
      <div className={`h-9 w-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  )
}
```

### Icon Background Colors for Activity Types

```tsx
// Success actions (joined, completed)
iconBg="bg-green-100 dark:bg-green-900/30"
icon={<UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />}

// Info actions (started, created)
iconBg="bg-blue-100 dark:bg-blue-900/30"
icon={<UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />}

// Warning actions (pending, review)
iconBg="bg-amber-100 dark:bg-amber-900/30"
icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
```

## Empty States

```tsx
// In table
emptyState={
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
}

// In activity list
<div className="text-center py-8 text-muted-foreground">
  <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
  <p>No recent activity</p>
</div>
```

## Null/Empty Values

Use consistent placeholder for empty/null values:

```tsx
// Em dash for missing values
<span className="text-muted-foreground">—</span>

// "Never" for never-occurred events
<span className="text-muted-foreground">Never</span>

// "No roles" for empty arrays
<span className="text-muted-foreground text-sm">No roles</span>
```

## Tooltip Patterns

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge className="gap-1">
        {role.name}
        {role.source === "sync" && <RefreshCw className="h-2.5 w-2.5" />}
      </Badge>
    </TooltipTrigger>
    {role.source === "sync" && (
      <TooltipContent>
        <p>Synced from Entra ID</p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```
