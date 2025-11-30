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
 * Team options for the form
 */
const teamOptions = [
  { value: "Executive", label: "Executive" },
  { value: "Engineering", label: "Engineering" },
  { value: "Security", label: "Security" },
  { value: "People", label: "People" },
  { value: "Finance", label: "Finance" },
  { value: "Operations", label: "Operations" },
]

/**
 * Form configuration for Person entity
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
  role: {
    component: "input",
    label: "Role",
    placeholder: "e.g. Software Engineer",
    required: true,
    type: "text",
  },
  team: {
    component: "select",
    label: "Team",
    placeholder: "Select a team",
    options: teamOptions,
  },
  status: {
    component: "select",
    label: "Status",
    placeholder: "Select status",
    options: statusOptions,
    required: true,
  },
  startDate: {
    component: "date-picker",
    label: "Start Date",
    placeholder: "Select start date",
    required: true,
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

/**
 * Create form schema
 */
export const createFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required").max(100, "Role too long"),
  team: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  phone: z.string().optional(),
  location: z.string().optional(),
})

/**
 * Edit form schema
 */
export const editFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required").max(100, "Role too long"),
  team: z.string().optional(),
  status: z.enum(["active", "onboarding", "offboarding", "inactive"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
})

/**
 * Get form fields based on mode
 */
export function getFormFields(mode: "create" | "edit"): string[] {
  if (mode === "create") {
    return ["name", "email", "role", "team", "startDate", "phone", "location"]
  }
  return ["name", "email", "role", "team", "status", "startDate", "endDate", "phone", "location", "bio"]
}
