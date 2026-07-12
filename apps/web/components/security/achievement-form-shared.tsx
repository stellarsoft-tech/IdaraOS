"use client"

import Link from "next/link"
import { z } from "zod"

import type { FieldConfig, FormConfig } from "@/components/primitives/form-drawer"
import { Checkbox } from "@/components/ui/checkbox"
import {
  extractYearFromPeriodLabel,
  getAchievementYearOptions,
  getCurrentAchievementYear,
} from "@/lib/security/achievements"
import type { SecurityAchievement, SecurityEvidence } from "@/lib/api/security"

/** Select fields require string values — convert to number on submit via periodFromYear(). */
export const achievementYearSchema = z
  .string()
  .min(1, "Year is required")
  .refine((v) => {
    const y = Number(v)
    return !Number.isNaN(y) && y >= 2000 && y <= 2100
  }, "Select a valid year")

export const achievementLinkedEvidenceSchema = z.array(z.string()).optional().default([])

export function buildAchievementYearFieldConfig(extraYears: number[] = []): FieldConfig {
  const years = new Set([...getAchievementYearOptions(), ...extraYears])
  return {
    component: "select",
    label: "Achievement Year",
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

export function buildAchievementEvidenceFieldConfig(
  evidenceList: SecurityEvidence[]
): FieldConfig {
  return {
    component: "custom",
    label: "Linked Evidence",
    helpText: "Select evidence that supports this achievement (required if Evidence Required is checked)",
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

export function getAchievementYearDefault(
  achievement?: SecurityAchievement | null,
  fallbackYear?: number
): string {
  if (achievement?.periodLabel) {
    const fromLabel = extractYearFromPeriodLabel(achievement.periodLabel)
    if (fromLabel) return String(fromLabel)
  }
  if (achievement?.periodStart) {
    return String(new Date(achievement.periodStart).getFullYear())
  }
  return String(fallbackYear ?? getCurrentAchievementYear())
}

export const achievementFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().optional(),
    year: achievementYearSchema,
    achievementDate: z.string().min(1, "Date is required"),
    evidenceRequired: z.boolean().default(false),
    linkedEvidenceIds: achievementLinkedEvidenceSchema,
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.evidenceRequired && (!data.linkedEvidenceIds || data.linkedEvidenceIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one evidence item when evidence is required",
        path: ["linkedEvidenceIds"],
      })
    }
  })

export const achievementFormConfig: FormConfig = {
  name: {
    component: "input",
    label: "Name",
    placeholder: "Enter achievement name",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea",
    label: "Description",
    placeholder: "Describe the achievement",
  },
  year: buildAchievementYearFieldConfig(),
  achievementDate: {
    component: "input",
    label: "Date",
    type: "date",
    required: true,
  },
  evidenceRequired: {
    component: "custom",
    label: "Evidence required",
    helpText: "When enabled, at least one evidence item must be linked",
    render: ({ value, onChange, disabled }) => (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span className="text-sm text-muted-foreground">
          {value ? "Evidence is required" : "Evidence is optional"}
        </span>
      </div>
    ),
  },
  linkedEvidenceIds: buildAchievementEvidenceFieldConfig([]),
  notes: {
    component: "textarea",
    label: "Notes",
  },
}

export function getAchievementFormDefaults(
  achievement?: SecurityAchievement | null,
  fallbackYear?: number
) {
  return {
    name: achievement?.name ?? "",
    description: achievement?.description ?? "",
    year: getAchievementYearDefault(achievement, fallbackYear),
    achievementDate: achievement?.achievementDate ?? "",
    evidenceRequired: achievement?.evidenceRequired ?? false,
    linkedEvidenceIds: achievement?.linkedEvidenceIds ?? [],
    notes: achievement?.notes ?? "",
  }
}
