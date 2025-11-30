/**
 * Generated form configuration for Security ISMS Risk entity
 */

import { z } from "zod"
import type { FormConfig } from "@/components/primitives/form-drawer"

/**
 * Likelihood options
 */
const likelihoodOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

/**
 * Impact options
 */
const impactOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

/**
 * Status options
 */
const statusOptions = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Mitigating" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
]

/**
 * Framework options
 */
const frameworkOptions = [
  { value: "ISMS", label: "ISMS" },
  { value: "SOC 2", label: "SOC 2" },
  { value: "ISO 27001", label: "ISO 27001" },
  { value: "NIST", label: "NIST" },
  { value: "GDPR", label: "GDPR" },
]

/**
 * Form configuration for Risk entity
 */
export const formConfig: FormConfig = {
  title: {
    component: "input",
    label: "Title",
    placeholder: "Enter risk title",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea",
    label: "Description",
    placeholder: "Describe the risk in detail",
  },
  owner_id: {
    component: "input",
    label: "Owner",
    placeholder: "Select risk owner",
    type: "text",
  },
  likelihood: {
    component: "select",
    label: "Likelihood",
    placeholder: "Select likelihood",
    options: likelihoodOptions,
    required: true,
  },
  impact: {
    component: "select",
    label: "Impact",
    placeholder: "Select impact",
    options: impactOptions,
    required: true,
  },
  status: {
    component: "select",
    label: "Status",
    placeholder: "Select status",
    options: statusOptions,
    required: true,
  },
  framework: {
    component: "select",
    label: "Framework",
    placeholder: "Select framework",
    options: frameworkOptions,
  },
}

/**
 * Create form schema
 */
export const createFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  likelihood: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
  framework: z.string().optional(),
})

/**
 * Edit form schema
 */
export const editFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  likelihood: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "mitigating", "accepted", "closed"]),
  framework: z.string().optional(),
})

/**
 * Get form fields based on mode
 */
export function getFormFields(mode: "create" | "edit"): string[] {
  if (mode === "create") {
    return ["title", "description", "owner_id", "likelihood", "impact", "framework"]
  }
  return ["title", "description", "owner_id", "likelihood", "impact", "status", "framework"]
}
