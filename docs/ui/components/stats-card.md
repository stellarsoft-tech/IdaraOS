# Stats Card Component

> **Purpose**: Stats cards display top-level metrics with a distinctive gradient accent. They are used at the top of directory/list pages and overview dashboards.

## Visual Reference

Stats cards feature:
- Compact header with icon
- Large bold metric value
- Subtle gradient accent in top-right corner
- Consistent overflow hidden for gradient containment

## Usage Pattern

### Role/Category Stats (Users & Access style)

Used when displaying counts per category (roles, statuses, types):

```tsx
<Card className="relative overflow-hidden">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium flex items-center gap-2">
      <Shield className="h-4 w-4" />
      {role.name}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{role.userCount || 0}</div>
    <p className="text-xs text-muted-foreground">users</p>
  </CardContent>
  {/* Gradient accent */}
  <div
    className="absolute top-0 right-0 w-16 h-16 opacity-5"
    style={{
      background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
    }}
  />
</Card>
```

### Overview Stats (People & HR style)

Used for overview metrics with icon badge:

```tsx
<Card className="relative overflow-hidden">
  <CardHeader className="flex flex-row items-center justify-between pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      {title}
    </CardTitle>
    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    {trend && (
      <p className={`text-xs ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
        {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
      </p>
    )}
  </CardContent>
  {/* Gradient accent */}
  <div
    className="absolute top-0 right-0 w-24 h-24 opacity-10"
    style={{
      background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
    }}
  />
</Card>
```

## Gradient Accent Specifications

### Standard Variant (Role Cards)

```css
/* Position & Size */
position: absolute;
top: 0;
right: 0;
width: 64px;  /* w-16 */
height: 64px; /* h-16 */
opacity: 0.05; /* Very subtle */

/* Gradient */
background: radial-gradient(circle at top right, currentColor 0%, transparent 70%);
```

### Enhanced Variant (Overview Cards)

```css
/* Position & Size */
position: absolute;
top: 0;
right: 0;
width: 96px;  /* w-24 */
height: 96px; /* h-24 */
opacity: 0.1; /* Slightly more visible */

/* Gradient */
background: radial-gradient(circle at top right, currentColor 0%, transparent 70%);
```

## Critical Requirements

1. **Parent Card MUST have `overflow-hidden`**
   ```tsx
   <Card className="relative overflow-hidden">
   ```

2. **Gradient uses `currentColor`** - inherits from text color context

3. **Low opacity values** - 5-10% to maintain subtlety

4. **Consistent positioning** - always top-right

## Color Associations

Use consistent colors for metric types:

| Metric Type | Color Class | Example |
|-------------|-------------|---------|
| Total/Count | `text-blue-600 dark:text-blue-400` | Total People |
| Active/Success | `text-green-600 dark:text-green-400` | Active Employees |
| Pending/In Progress | `text-amber-600 dark:text-amber-400` | Onboarding |
| Categories/Groups | `text-purple-600 dark:text-purple-400` | Teams |
| Errors/Alerts | `text-red-600 dark:text-red-400` | Offboarding |

## Loading State

```tsx
<Card className="relative overflow-hidden">
  <CardHeader className="pb-2">
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-20" />
    </div>
  </CardHeader>
  <CardContent>
    <Skeleton className="h-8 w-12 mb-1" />
    <Skeleton className="h-3 w-16" />
  </CardContent>
</Card>
```

## Grid Layout

Stats cards should be displayed in responsive grids:

```tsx
{/* Role cards: 5 columns on desktop */}
<div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
  {roles.map((role) => (
    <StatsCard key={role.id} ... />
  ))}
</div>

{/* Overview cards: 4 columns on desktop */}
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {stats.map((stat) => (
    <StatsCard key={stat.id} ... />
  ))}
</div>
```

## Do's and Don'ts

### Do ✅
- Use consistent gradient opacity (5-10%)
- Match icon color to metric type
- Include loading skeletons
- Use `relative overflow-hidden` on Card

### Don't ❌
- Use bright/saturated gradients (too distracting)
- Mix gradient styles within same grid
- Forget loading states
- Use different gradient positions (keep top-right)
