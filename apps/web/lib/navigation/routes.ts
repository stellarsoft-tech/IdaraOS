/**
 * Route configuration for navigation and breadcrumbs
 */

export interface RouteConfig {
  path: string
  label: string
  icon?: string
  parent?: string
  description?: string
}

/**
 * Central route registry
 * Add new routes here when creating modules
 */
export const routes: Record<string, RouteConfig> = {
  // Dashboard
  dashboard: {
    path: "/dashboard",
    label: "Dashboard",
  },
  
  // People
  people: {
    path: "/people",
    label: "People",
  },
  "people.directory": {
    path: "/people/directory",
    label: "Directory",
    parent: "people",
  },
  "people.workflows": {
    path: "/people/workflows",
    label: "Workflows",
    parent: "people",
    description: "Onboarding, offboarding & other people workflows",
  },
  "people.audit-log": {
    path: "/people/audit-log",
    label: "Audit Log",
    parent: "people",
    description: "Activity history for people records",
  },
  "people.settings": {
    path: "/people/settings",
    label: "Settings",
    parent: "people",
    description: "Configure People & HR module settings",
  },
  
  // Security
  security: {
    path: "/security",
    label: "Security",
  },
  "security.risks": {
    path: "/security/risks",
    label: "Risks",
    parent: "security",
  },
  "security.controls": {
    path: "/security/controls",
    label: "Controls",
    parent: "security",
  },
  "security.audits": {
    path: "/security/audits",
    label: "Audits",
    parent: "security",
  },
  "security.evidence": {
    path: "/security/evidence",
    label: "Evidence",
    parent: "security",
  },
  "security.frameworks": {
    path: "/security/frameworks",
    label: "Frameworks",
    parent: "security",
  },
  "security.frameworks.isms": {
    path: "/security/frameworks/isms",
    label: "ISMS",
    parent: "security.frameworks",
  },
  
  // Assets
  assets: {
    path: "/assets",
    label: "Assets",
  },
  "assets.overview": {
    path: "/assets",
    label: "Overview",
    parent: "assets",
  },
  "assets.inventory": {
    path: "/assets/inventory",
    label: "Inventory",
    parent: "assets",
  },
  "assets.categories": {
    path: "/assets/categories",
    label: "Categories",
    parent: "assets",
  },
  "assets.assignments": {
    path: "/assets/assignments",
    label: "Assignments",
    parent: "assets",
  },
  "assets.maintenance": {
    path: "/assets/maintenance",
    label: "Maintenance",
    parent: "assets",
  },
  "assets.lifecycle": {
    path: "/assets/lifecycle",
    label: "Lifecycle",
    parent: "assets",
    description: "Asset lifecycle events and audit trail",
  },
  "assets.settings": {
    path: "/assets/settings",
    label: "Settings",
    parent: "assets",
    description: "Configure asset sync and integrations",
  },
  
  // Docs
  docs: {
    path: "/docs",
    label: "Docs",
  },
  "docs.policies": {
    path: "/docs/policies",
    label: "Policies",
    parent: "docs",
  },
  "docs.attestations": {
    path: "/docs/attestations",
    label: "Attestations",
    parent: "docs",
  },
  
  // Finance
  finance: {
    path: "/finance",
    label: "Finance",
  },
  
  // Vendors
  vendors: {
    path: "/vendors",
    label: "Vendors",
  },
  
  // Workflows
  workflows: {
    path: "/workflows",
    label: "Workflows",
  },
  "workflows.templates": {
    path: "/workflows/templates",
    label: "Templates",
    parent: "workflows",
    description: "Workflow template library",
  },
  "workflows.instances": {
    path: "/workflows/instances",
    label: "Active Workflows",
    parent: "workflows",
    description: "Running workflow instances",
  },
  "workflows.board": {
    path: "/workflows/board",
    label: "Board",
    parent: "workflows",
    description: "Kanban board view",
  },
  "workflows.tasks": {
    path: "/workflows/tasks",
    label: "My Tasks",
    parent: "workflows",
    description: "All tasks assigned to you",
  },
  "workflows.settings": {
    path: "/workflows/settings",
    label: "Settings",
    parent: "workflows",
    description: "Configure workflow settings",
  },
  
  // Settings
  settings: {
    path: "/settings",
    label: "Settings",
  },
  "settings.users": {
    path: "/settings/users",
    label: "Users",
    parent: "settings",
  },
  "settings.integrations": {
    path: "/settings/integrations",
    label: "Integrations",
    parent: "settings",
  },
  "settings.audit-log": {
    path: "/settings/audit-log",
    label: "Audit Log",
    parent: "settings",
  },
}

/**
 * Get breadcrumb trail for a path
 */
export function getBreadcrumbs(pathname: string): Array<{ label: string; href?: string }> {
  const breadcrumbs: Array<{ label: string; href?: string }> = []
  
  // Find matching route
  const route = Object.values(routes).find((r) => pathname.startsWith(r.path))
  
  if (!route) {
    return breadcrumbs
  }
  
  // Build breadcrumb trail by following parent chain
  let current: RouteConfig | undefined = route
  const trail: RouteConfig[] = []
  
  while (current) {
    trail.unshift(current)
    current = current.parent ? routes[current.parent] : undefined
  }
  
  // Convert to breadcrumb format
  trail.forEach((item, index) => {
    breadcrumbs.push({
      label: item.label,
      href: index < trail.length - 1 ? item.path : undefined, // Last item has no href
    })
  })
  
  // Handle detail pages (with IDs in path)
  const segments = pathname.split("/").filter(Boolean)
  const routeSegments = route.path.split("/").filter(Boolean)
  
  if (segments.length > routeSegments.length) {
    // There's an ID or additional segment
    const lastSegment = segments[segments.length - 1]
    
    // Don't add raw UUIDs to breadcrumbs, just indicate it's a detail view
    if (lastSegment.length > 20 || lastSegment.match(/^[a-f0-9-]{36}$/i)) {
      breadcrumbs.push({
        label: "Details",
      })
    } else {
      breadcrumbs.push({
        label: lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1),
      })
    }
  }
  
  return breadcrumbs
}

/**
 * Get route by path
 */
export function getRoute(path: string): RouteConfig | undefined {
  return Object.values(routes).find((r) => r.path === path)
}

/**
 * Get all routes for a parent
 */
export function getChildRoutes(parentKey: string): RouteConfig[] {
  return Object.values(routes).filter((r) => r.parent === parentKey)
}

