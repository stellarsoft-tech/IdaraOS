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
  "people.teams": {
    path: "/people/teams",
    label: "Teams",
    parent: "people",
    description: "Manage organizational teams",
  },
  "people.roles": {
    path: "/people/roles",
    label: "Roles",
    parent: "people",
    description: "Define organizational role hierarchy",
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
    description: "Security and compliance management",
  },
  "security.risks": {
    path: "/security/risks",
    label: "Risk Register",
    parent: "security",
    description: "Identify and manage security risks",
  },
  "security.controls": {
    path: "/security/controls",
    label: "Controls Library",
    parent: "security",
    description: "Manage security controls and their implementation",
  },
  "security.evidence": {
    path: "/security/evidence",
    label: "Evidence Store",
    parent: "security",
    description: "Central repository for compliance artifacts",
  },
  "security.audits": {
    path: "/security/audits",
    label: "Audits",
    parent: "security",
    description: "Track internal and external audits",
  },
  "security.objectives": {
    path: "/security/objectives",
    label: "Objectives",
    parent: "security",
    description: "Security objectives and improvement plans",
  },
  "security.frameworks": {
    path: "/security/frameworks",
    label: "Frameworks (IMS)",
    parent: "security",
    description: "Compliance frameworks and certifications",
  },
  "security.frameworks.iso-27001": {
    path: "/security/frameworks/iso-27001",
    label: "ISO 27001",
    parent: "security.frameworks",
    description: "ISO/IEC 27001:2022 ISMS",
  },
  "security.frameworks.iso-27001.soa": {
    path: "/security/frameworks/iso-27001/soa",
    label: "Statement of Applicability",
    parent: "security.frameworks.iso-27001",
    description: "ISO 27001 Annex A control applicability",
  },
  "security.frameworks.iso-27001.controls": {
    path: "/security/frameworks/iso-27001/controls",
    label: "Annex A Controls",
    parent: "security.frameworks.iso-27001",
    description: "93 Annex A controls browser",
  },
  "security.frameworks.iso-27001.gaps": {
    path: "/security/frameworks/iso-27001/gaps",
    label: "Gap Analysis",
    parent: "security.frameworks.iso-27001",
    description: "Identify implementation gaps",
  },
  "security.frameworks.soc-2": {
    path: "/security/frameworks/soc-2",
    label: "SOC 2",
    parent: "security.frameworks",
    description: "SOC 2 Type II compliance",
  },
  "security.frameworks.soc-2.criteria": {
    path: "/security/frameworks/soc-2/criteria",
    label: "Trust Criteria",
    parent: "security.frameworks.soc-2",
    description: "Trust Service Criteria mapping",
  },
  "security.frameworks.soc-2.evidence": {
    path: "/security/frameworks/soc-2/evidence",
    label: "Evidence Matrix",
    parent: "security.frameworks.soc-2",
    description: "Evidence requirements per criterion",
  },
  "security.frameworks.soc-2.gaps": {
    path: "/security/frameworks/soc-2/gaps",
    label: "Gap Analysis",
    parent: "security.frameworks.soc-2",
    description: "Audit readiness gaps",
  },
  "security.settings": {
    path: "/security/settings",
    label: "Settings",
    parent: "security",
    description: "Configure security module settings",
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

