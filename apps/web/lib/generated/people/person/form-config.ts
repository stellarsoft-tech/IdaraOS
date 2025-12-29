/**
 * Generated form configuration for People/Person entity
 */

import { z } from "zod"
import type { FormConfig } from "@/components/primitives/form-drawer"

/**
 * Status options for the form
 */
const statusOptions = [
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
  { value: "inactive", label: "Inactive" },
]

/**
 * Load teams from API for async select
 */
async function loadTeamOptions(_search: string) {
  try {
    const res = await fetch("/api/people/teams")
    if (!res.ok) return []
    const teams = await res.json()
    return teams.map((t: { id: string; name: string; parentTeam?: { name: string } }) => ({
      value: t.id,
      label: t.name,
      sublabel: t.parentTeam?.name ? `Under ${t.parentTeam.name}` : undefined,
    }))
  } catch {
    return []
  }
}

/**
 * Load organizational roles from API for async select
 * Includes Level and Parent info in sublabel
 */
async function loadRoleOptions(_search: string) {
  try {
    const res = await fetch("/api/people/roles")
    if (!res.ok) return []
    const roles = await res.json()
    return roles.map((r: { 
      id: string
      name: string
      level: number
      parentRole?: { name: string } | null
    }) => {
      // Build sublabel with level and parent
      const parts: string[] = []
      if (r.level !== undefined) {
        parts.push(`L${r.level}`)
      }
      if (r.parentRole) {
        parts.push(`Reports to ${r.parentRole.name}`)
      }
      return {
        value: r.id,
        label: r.name,
        sublabel: parts.length > 0 ? parts.join(" · ") : undefined,
      }
    })
  } catch {
    return []
  }
}

/**
 * Form configuration for Person entity
 * Note: roleId and teamId are dropdowns - text values are derived for Entra sync
 */
export const formConfig: FormConfig = {
  name: {
    component: "input",
    label: "Full Name",
    placeholder: "Enter full name",
    required: true,
    type: "text",
  },
  email: {
    component: "input",
    label: "Email",
    placeholder: "name@company.com",
    required: true,
    type: "email",
  },
  roleId: {
    component: "async-select",
    label: "Role",
    placeholder: "Select role...",
    loadOptions: loadRoleOptions,
  },
  teamId: {
    component: "async-select",
    label: "Team",
    placeholder: "Select team...",
    loadOptions: loadTeamOptions,
  },
  status: {
    component: "select",
    label: "Status",
    placeholder: "Select status",
    options: statusOptions,
    required: true,
    helpText: "Setting to 'Onboarding' or 'Offboarding' may trigger associated workflows",
  },
  startDate: {
    component: "date-picker",
    label: "Start Date",
    placeholder: "Select start date",
    required: true,
  },
  hireDate: {
    component: "date-picker",
    label: "Hire Date",
    placeholder: "Select hire date",
  },
  endDate: {
    component: "date-picker",
    label: "End Date",
    placeholder: "Select end date",
  },
  phone: {
    component: "input",
    label: "Phone",
    placeholder: "+1 (555) 123-4567",
    type: "tel",
  },
  location: {
    component: "input",
    label: "Location",
    placeholder: "e.g. New York, NY",
    type: "text",
  },
  bio: {
    component: "textarea",
    label: "Bio",
    placeholder: "Brief bio or description",
  },
}

// Helper to handle empty strings as null for optional UUID fields
const optionalUuid = z.preprocess(
  (val) => (val === "" || val === "__none__" ? null : val),
  z.string().uuid().nullable().optional()
)

/**
 * Create form schema
 * roleId and teamId are optional - text values are derived from selected entities for Entra sync
 */
export const createFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  roleId: optionalUuid,
  teamId: optionalUuid,
  status: z.enum(["active", "onboarding", "offboarding", "inactive"]).default("onboarding"),
  startDate: z.string().min(1, "Start date is required"),
  hireDate: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
})

/**
 * Edit form schema
 * roleId and teamId are optional - text values are derived from selected entities for Entra sync
 */
export const editFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  roleId: optionalUuid,
  teamId: optionalUuid,
  status: z.enum(["active", "onboarding", "offboarding", "inactive"]),
  startDate: z.string().min(1, "Start date is required"),
  hireDate: z.string().optional(),
  endDate: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
})

/**
 * Get form fields based on mode
 * roleId (Job Title) and teamId are the primary fields - text values derived for Entra sync
 */
export function getFormFields(mode: "create" | "edit"): string[] {
  if (mode === "create") {
    return ["name", "email", "roleId", "teamId", "status", "startDate", "hireDate", "phone", "location"]
  }
  return ["name", "email", "roleId", "teamId", "status", "startDate", "hireDate", "endDate", "phone", "location", "bio"]
}
