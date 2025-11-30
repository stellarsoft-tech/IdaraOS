/**
 * Generated types and Zod schemas for People/Person entity
 */

import { z } from "zod"

/**
 * Person status values
 */
export const personStatusValues = ["active", "onboarding", "offboarding", "inactive"] as const
export type PersonStatus = (typeof personStatusValues)[number]

/**
 * Person status badge variants for UI
 */
export const personStatusVariants: Record<PersonStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "default" },
  onboarding: { label: "Onboarding", variant: "secondary" },
  offboarding: { label: "Offboarding", variant: "outline" },
  inactive: { label: "Inactive", variant: "destructive" },
}

/**
 * Base Person schema (for API responses)
 */
export const PersonSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
  team: z.string().optional(),
  manager_id: z.string().uuid().optional().nullable(),
  status: z.enum(personStatusValues),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  phone: z.string().optional(),
  location: z.string().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().optional(),
  assignedAssets: z.number().default(0),
})

export type Person = z.infer<typeof PersonSchema>

/**
 * Create Person schema (for POST requests)
 */
export const CreatePersonSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required").max(100, "Role too long"),
  team: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  phone: z.string().optional(),
  location: z.string().optional(),
})

export type CreatePerson = z.infer<typeof CreatePersonSchema>

/**
 * Update Person schema (for PUT requests)
 */
export const UpdatePersonSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.string().min(1, "Role is required").max(100, "Role too long").optional(),
  team: z.string().optional(),
  status: z.enum(personStatusValues).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
})

export type UpdatePerson = z.infer<typeof UpdatePersonSchema>

/**
 * Person filters for querying
 */
export interface PersonFilters {
  search?: string
  status?: PersonStatus[]
  team?: string[]
  role?: string[]
}
