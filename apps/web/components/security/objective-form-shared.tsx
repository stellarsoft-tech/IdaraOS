"use client"

import Link from "next/link"
import { z } from "zod"

import type { FieldConfig, FormConfig } from "@/components/primitives/form-drawer"
import { Checkbox } from "@/components/ui/checkbox"
import { objectiveAchievementStatusValues } from "@/lib/db/schema/security"
import {
  extractYearFromPeriodLabel,
  getCurrentObjectiveYear,
  getObjectiveYearOptions,
} from "@/lib/security/objectives"
import type { SecurityEvidence, SecurityObjective } from "@/lib/api/security"

const achievementLabels: Record<SecurityObjective["achievementStatus"], string> = {
  not_measured: "Not Measured",
  not_achieved: "Not Achieved",
  partially_achieved: "Partially Achieved",
  achieved: "Achieved",
}

/** Select fields require string values — convert to number on submit via periodFromYear(). */
export const objectiveYearSchema = z
  .string()
  .min(1, "Year is required")
  .refine((v) => {
    const y = Number(v)
    return !Number.isNaN(y) && y >= 2000 && y <= 2100
  }, "Select a valid year")

export const objectiveOwnerIdSchema = z.preprocess(
  (v) => (v === "" || v === "__unassigned__" || v === undefined ? null : v),
  z.string().uuid().nullable().optional()
)

export const objectiveLinkedEvidenceSchema = z.array(z.string()).optional().default([])

export function buildYearFieldConfig(extraYears: number[] = []): FieldConfig {
  const years = new Set([...getObjectiveYearOptions(), ...extraYears])
  return {
    component: "select",
    label: "Objective Year",
    placeholder: "Select year",
    options: Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({
        value: String(y),
        label: String(y),
      })),
    required: true,
  }
}

export const objectiveYearFieldConfig: FieldConfig = buildYearFieldConfig()

export const objectiveOwnerFieldConfig: FieldConfig = {
  component: "select",
  label: "Owner",
  placeholder: "Select owner",
  helpText: "Platform user accountable for this objective",
  options: [],
}

export interface ObjectiveOwnerOption {
  id: string
  name: string
  email?: string | null
}

function formatOwnerLabel(owner: ObjectiveOwnerOption): string {
  return owner.email ? `${owner.name} (${owner.email})` : owner.name
}

export function buildOwnerFieldConfig(
  assignableUsers: ObjectiveOwnerOption[],
  currentOwner?: ObjectiveOwnerOption | null
): FieldConfig {
  const owners = [...assignableUsers]
  if (currentOwner && !owners.some((owner) => owner.id === currentOwner.id)) {
    owners.push(currentOwner)
  }

  return {
    ...objectiveOwnerFieldConfig,
    options: [
      { value: "__unassigned__", label: "— Unassigned —" },
      ...owners.map((owner) => ({
        value: owner.id,
        label: formatOwnerLabel(owner),
      })),
    ],
  }
}

export function buildEvidenceFieldConfig(
  evidenceList: SecurityEvidence[]
): FieldConfig {
  return {
    component: "custom",
    label: "Linked Evidence",
    helpText: "Select evidence that supports measurement of this objective",
    render: ({ value, onChange, disabled }) => {
      const selected = Array.isArray(value) ? (value as string[]) : []
      if (evidenceList.length === 0) {
        return (
          <p className="text-sm text-muted-foreground py-2">
            No evidence available.{" "}
            <Link href="/security/evidence" className="text-primary hover:underline">
              Add evidence
            </Link>{" "}
            first.
          </p>
        )
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
          {evidenceList.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex items-start gap-3 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(isChecked) => {
                    const next = isChecked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id)
                    onChange(next)
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium block">{item.title}</span>
                  <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                </span>
              </label>
            )
          })}
        </div>
      )
    },
  }
}

export function getObjectiveYearDefault(
  objective?: SecurityObjective | null,
  fallbackYear?: number
): string {
  if (objective?.periodLabel) {
    const fromLabel = extractYearFromPeriodLabel(objective.periodLabel)
    if (fromLabel) return String(fromLabel)
  }
  if (objective?.periodStart) {
    return String(new Date(objective.periodStart).getFullYear())
  }
  return String(fallbackYear ?? getCurrentObjectiveYear())
}

export function getObjectiveOwnerDefault(objective?: SecurityObjective | null): string {
  return objective?.ownerId ?? "__unassigned__"
}

export function getObjectiveEvidenceDefault(objective?: SecurityObjective | null): string[] {
  return objective?.linkedEvidenceIds ?? []
}

/** Shared edit schema fields (extend per page as needed). */
export const objectiveEditBaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  year: objectiveYearSchema,
  ownerId: objectiveOwnerIdSchema,
  linkedEvidenceIds: objectiveLinkedEvidenceSchema,
  achievementStatus: z.enum(objectiveAchievementStatusValues),
  successCriteria: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "on_hold", "cancelled"]),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
})

export const objectiveEditBaseFormConfig: FormConfig = {
  title: { component: "input", label: "Title", required: true, type: "text" },
  description: { component: "textarea", label: "Description" },
  year: objectiveYearFieldConfig,
  ownerId: objectiveOwnerFieldConfig,
  linkedEvidenceIds: buildEvidenceFieldConfig([]),
  achievementStatus: {
    component: "select",
    label: "Achievement Status",
    options: objectiveAchievementStatusValues.map((v) => ({
      value: v,
      label: achievementLabels[v],
    })),
    required: true,
  },
  successCriteria: { component: "textarea", label: "Success Criteria" },
  status: {
    component: "select",
    label: "Workflow Status",
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "on_hold", label: "On Hold" },
      { value: "cancelled", label: "Cancelled" },
    ],
    required: true,
  },
  targetDate: { component: "input", label: "Target Date", type: "date" },
  notes: { component: "textarea", label: "Notes" },
}

export function getObjectiveEditDefaults(
  objective: SecurityObjective,
  fallbackYear?: number
) {
  return {
    title: objective.title,
    description: objective.description ?? "",
    year: getObjectiveYearDefault(objective, fallbackYear),
    ownerId: getObjectiveOwnerDefault(objective),
    linkedEvidenceIds: getObjectiveEvidenceDefault(objective),
    achievementStatus: objective.achievementStatus,
    successCriteria: objective.successCriteria ?? "",
    status: objective.status,
    targetDate: objective.targetDate ?? "",
    notes: objective.notes ?? "",
  }
}
