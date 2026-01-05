/**
 * RBAC Resources - Single Source of Truth
 * 
 * All module slugs and action slugs are defined here.
 * Both the RBAC sync script and requirePermission() use these constants.
 * This ensures compile-time validation of permission checks.
 */

// =============================================================================
// Action Slugs - Canonical names for all actions
// =============================================================================

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  PRINT: "print",
  READ_ALL: "read_all",
} as const

export type ActionSlug = (typeof ACTIONS)[keyof typeof ACTIONS]

// =============================================================================
// Module Slugs - Canonical names for all modules
// =============================================================================

export const MODULES = {
  // People & HR
  PEOPLE_OVERVIEW: "people.overview",
  PEOPLE_DIRECTORY: "people.directory",
  PEOPLE_TEAMS: "people.teams",
  PEOPLE_ROLES: "people.roles",
  PEOPLE_WORKFLOWS: "people.workflows",
  PEOPLE_SETTINGS: "people.settings",
  PEOPLE_AUDITLOG: "people.auditlog",

  // Assets
  ASSETS_OVERVIEW: "assets.overview",
  ASSETS_INVENTORY: "assets.inventory",
  ASSETS_CATEGORIES: "assets.categories",
  ASSETS_ASSIGNMENTS: "assets.assignments",
  ASSETS_MAINTENANCE: "assets.maintenance",
  ASSETS_LIFECYCLE: "assets.lifecycle",
  ASSETS_SETTINGS: "assets.settings",
  ASSETS_AUDITLOG: "assets.auditlog",

  // Security
  SECURITY_OVERVIEW: "security.overview",
  SECURITY_RISKS: "security.risks",
  SECURITY_CONTROLS: "security.controls",
  SECURITY_EVIDENCE: "security.evidence",
  SECURITY_AUDITS: "security.audits",
  SECURITY_OBJECTIVES: "security.objectives",
  SECURITY_FRAMEWORKS: "security.frameworks",
  SECURITY_SOA: "security.soa",
  SECURITY_CLAUSES: "security.clauses",
  SECURITY_AUDITLOG: "security.auditlog",

  // Documentation
  DOCS_OVERVIEW: "docs.overview",
  DOCS_DOCUMENTS: "docs.documents",
  DOCS_ROLLOUTS: "docs.rollouts",
  DOCS_ACKNOWLEDGMENTS: "docs.acknowledgments",
  DOCS_SETTINGS: "docs.settings",
  DOCS_AUDITLOG: "docs.auditlog",

  // Workflows
  WORKFLOWS_OVERVIEW: "workflows.overview",
  WORKFLOWS_TEMPLATES: "workflows.templates",
  WORKFLOWS_INSTANCES: "workflows.instances",
  WORKFLOWS_TASKS: "workflows.tasks",
  WORKFLOWS_BOARD: "workflows.board",
  WORKFLOWS_SETTINGS: "workflows.settings",
  WORKFLOWS_AUDITLOG: "workflows.auditlog",

  // Filing
  FILING_OVERVIEW: "filing.overview",
  FILING_FILES: "filing.files",
  FILING_CATEGORIES: "filing.categories",
  FILING_AUDITLOG: "filing.auditlog",

  // Settings
  SETTINGS_ORGANIZATION: "settings.organization",
  SETTINGS_USERS: "settings.users",
  SETTINGS_ROLES: "settings.roles",
  SETTINGS_INTEGRATIONS: "settings.integrations",
  SETTINGS_AUDITLOG: "settings.auditlog",
  SETTINGS_BRANDING: "settings.branding",
  SETTINGS_APIKEYS: "settings.apikeys",
} as const

export type ModuleSlug = (typeof MODULES)[keyof typeof MODULES]

// =============================================================================
// Permission Tuple Type - For type-safe permission checks
// =============================================================================

export type PermissionTuple = readonly [ModuleSlug, ActionSlug]

// =============================================================================
// Autocomplete Helpers - Full autocomplete for permission checks
// =============================================================================

/**
 * Permission helpers with full autocomplete support.
 * 
 * Usage in API routes:
 * ```typescript
 * const session = await requirePermission(...P.people.directory.edit())
 * ```
 * 
 * This provides:
 * - Autocomplete for module categories (people, settings, etc.)
 * - Autocomplete for sub-modules (directory, users, etc.)
 * - Autocomplete for actions (view, create, edit, delete)
 * - Type-safe permission tuples
 */
export const P = {
  // People & HR
  people: {
    overview: {
      view: (): PermissionTuple => [MODULES.PEOPLE_OVERVIEW, ACTIONS.VIEW],
    },
    directory: {
      view: (): PermissionTuple => [MODULES.PEOPLE_DIRECTORY, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.PEOPLE_DIRECTORY, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.PEOPLE_DIRECTORY, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.PEOPLE_DIRECTORY, ACTIONS.DELETE],
    },
    teams: {
      view: (): PermissionTuple => [MODULES.PEOPLE_TEAMS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.PEOPLE_TEAMS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.PEOPLE_TEAMS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.PEOPLE_TEAMS, ACTIONS.DELETE],
    },
    roles: {
      view: (): PermissionTuple => [MODULES.PEOPLE_ROLES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.PEOPLE_ROLES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.PEOPLE_ROLES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.PEOPLE_ROLES, ACTIONS.DELETE],
    },
    workflows: {
      view: (): PermissionTuple => [MODULES.PEOPLE_WORKFLOWS, ACTIONS.VIEW],
    },
    settings: {
      view: (): PermissionTuple => [MODULES.PEOPLE_SETTINGS, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.PEOPLE_SETTINGS, ACTIONS.EDIT],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.PEOPLE_AUDITLOG, ACTIONS.VIEW],
    },
  },

  // Assets
  assets: {
    overview: {
      view: (): PermissionTuple => [MODULES.ASSETS_OVERVIEW, ACTIONS.VIEW],
    },
    inventory: {
      view: (): PermissionTuple => [MODULES.ASSETS_INVENTORY, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.ASSETS_INVENTORY, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.ASSETS_INVENTORY, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.ASSETS_INVENTORY, ACTIONS.DELETE],
    },
    categories: {
      view: (): PermissionTuple => [MODULES.ASSETS_CATEGORIES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.ASSETS_CATEGORIES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.ASSETS_CATEGORIES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.ASSETS_CATEGORIES, ACTIONS.DELETE],
    },
    assignments: {
      view: (): PermissionTuple => [MODULES.ASSETS_ASSIGNMENTS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.ASSETS_ASSIGNMENTS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.ASSETS_ASSIGNMENTS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.ASSETS_ASSIGNMENTS, ACTIONS.DELETE],
    },
    maintenance: {
      view: (): PermissionTuple => [MODULES.ASSETS_MAINTENANCE, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.ASSETS_MAINTENANCE, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.ASSETS_MAINTENANCE, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.ASSETS_MAINTENANCE, ACTIONS.DELETE],
    },
    lifecycle: {
      view: (): PermissionTuple => [MODULES.ASSETS_LIFECYCLE, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.ASSETS_LIFECYCLE, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.ASSETS_LIFECYCLE, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.ASSETS_LIFECYCLE, ACTIONS.DELETE],
    },
    settings: {
      view: (): PermissionTuple => [MODULES.ASSETS_SETTINGS, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.ASSETS_SETTINGS, ACTIONS.EDIT],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.ASSETS_AUDITLOG, ACTIONS.VIEW],
    },
  },

  // Security
  security: {
    overview: {
      view: (): PermissionTuple => [MODULES.SECURITY_OVERVIEW, ACTIONS.VIEW],
    },
    risks: {
      view: (): PermissionTuple => [MODULES.SECURITY_RISKS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_RISKS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_RISKS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_RISKS, ACTIONS.DELETE],
    },
    controls: {
      view: (): PermissionTuple => [MODULES.SECURITY_CONTROLS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_CONTROLS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_CONTROLS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_CONTROLS, ACTIONS.DELETE],
    },
    evidence: {
      view: (): PermissionTuple => [MODULES.SECURITY_EVIDENCE, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_EVIDENCE, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_EVIDENCE, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_EVIDENCE, ACTIONS.DELETE],
    },
    audits: {
      view: (): PermissionTuple => [MODULES.SECURITY_AUDITS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_AUDITS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_AUDITS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_AUDITS, ACTIONS.DELETE],
    },
    objectives: {
      view: (): PermissionTuple => [MODULES.SECURITY_OBJECTIVES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_OBJECTIVES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_OBJECTIVES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_OBJECTIVES, ACTIONS.DELETE],
    },
    frameworks: {
      view: (): PermissionTuple => [MODULES.SECURITY_FRAMEWORKS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_FRAMEWORKS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_FRAMEWORKS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_FRAMEWORKS, ACTIONS.DELETE],
    },
    soa: {
      view: (): PermissionTuple => [MODULES.SECURITY_SOA, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_SOA, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_SOA, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_SOA, ACTIONS.DELETE],
    },
    clauses: {
      view: (): PermissionTuple => [MODULES.SECURITY_CLAUSES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SECURITY_CLAUSES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SECURITY_CLAUSES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SECURITY_CLAUSES, ACTIONS.DELETE],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.SECURITY_AUDITLOG, ACTIONS.VIEW],
    },
  },

  // Documentation
  docs: {
    overview: {
      view: (): PermissionTuple => [MODULES.DOCS_OVERVIEW, ACTIONS.VIEW],
    },
    documents: {
      view: (): PermissionTuple => [MODULES.DOCS_DOCUMENTS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.DOCS_DOCUMENTS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.DOCS_DOCUMENTS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.DOCS_DOCUMENTS, ACTIONS.DELETE],
      print: (): PermissionTuple => [MODULES.DOCS_DOCUMENTS, ACTIONS.PRINT],
      readAll: (): PermissionTuple => [MODULES.DOCS_DOCUMENTS, ACTIONS.READ_ALL],
    },
    rollouts: {
      view: (): PermissionTuple => [MODULES.DOCS_ROLLOUTS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.DOCS_ROLLOUTS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.DOCS_ROLLOUTS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.DOCS_ROLLOUTS, ACTIONS.DELETE],
    },
    acknowledgments: {
      view: (): PermissionTuple => [MODULES.DOCS_ACKNOWLEDGMENTS, ACTIONS.VIEW],
    },
    settings: {
      view: (): PermissionTuple => [MODULES.DOCS_SETTINGS, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.DOCS_SETTINGS, ACTIONS.EDIT],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.DOCS_AUDITLOG, ACTIONS.VIEW],
    },
  },

  // Workflows
  workflows: {
    overview: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_OVERVIEW, ACTIONS.VIEW],
    },
    templates: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_TEMPLATES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.WORKFLOWS_TEMPLATES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.WORKFLOWS_TEMPLATES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.WORKFLOWS_TEMPLATES, ACTIONS.DELETE],
    },
    instances: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_INSTANCES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.WORKFLOWS_INSTANCES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.WORKFLOWS_INSTANCES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.WORKFLOWS_INSTANCES, ACTIONS.DELETE],
    },
    tasks: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_TASKS, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.WORKFLOWS_TASKS, ACTIONS.EDIT],
    },
    board: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_BOARD, ACTIONS.VIEW],
    },
    settings: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_SETTINGS, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.WORKFLOWS_SETTINGS, ACTIONS.EDIT],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.WORKFLOWS_AUDITLOG, ACTIONS.VIEW],
    },
  },

  // Filing
  filing: {
    overview: {
      view: (): PermissionTuple => [MODULES.FILING_OVERVIEW, ACTIONS.VIEW],
    },
    files: {
      view: (): PermissionTuple => [MODULES.FILING_FILES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.FILING_FILES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.FILING_FILES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.FILING_FILES, ACTIONS.DELETE],
    },
    categories: {
      view: (): PermissionTuple => [MODULES.FILING_CATEGORIES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.FILING_CATEGORIES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.FILING_CATEGORIES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.FILING_CATEGORIES, ACTIONS.DELETE],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.FILING_AUDITLOG, ACTIONS.VIEW],
    },
  },

  // Settings
  settings: {
    organization: {
      view: (): PermissionTuple => [MODULES.SETTINGS_ORGANIZATION, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.SETTINGS_ORGANIZATION, ACTIONS.EDIT],
    },
    users: {
      view: (): PermissionTuple => [MODULES.SETTINGS_USERS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SETTINGS_USERS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SETTINGS_USERS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SETTINGS_USERS, ACTIONS.DELETE],
    },
    roles: {
      view: (): PermissionTuple => [MODULES.SETTINGS_ROLES, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SETTINGS_ROLES, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SETTINGS_ROLES, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SETTINGS_ROLES, ACTIONS.DELETE],
    },
    integrations: {
      view: (): PermissionTuple => [MODULES.SETTINGS_INTEGRATIONS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SETTINGS_INTEGRATIONS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SETTINGS_INTEGRATIONS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SETTINGS_INTEGRATIONS, ACTIONS.DELETE],
    },
    auditlog: {
      view: (): PermissionTuple => [MODULES.SETTINGS_AUDITLOG, ACTIONS.VIEW],
    },
    branding: {
      view: (): PermissionTuple => [MODULES.SETTINGS_BRANDING, ACTIONS.VIEW],
      edit: (): PermissionTuple => [MODULES.SETTINGS_BRANDING, ACTIONS.EDIT],
    },
    apikeys: {
      view: (): PermissionTuple => [MODULES.SETTINGS_APIKEYS, ACTIONS.VIEW],
      create: (): PermissionTuple => [MODULES.SETTINGS_APIKEYS, ACTIONS.CREATE],
      edit: (): PermissionTuple => [MODULES.SETTINGS_APIKEYS, ACTIONS.EDIT],
      delete: (): PermissionTuple => [MODULES.SETTINGS_APIKEYS, ACTIONS.DELETE],
    },
  },
} as const
