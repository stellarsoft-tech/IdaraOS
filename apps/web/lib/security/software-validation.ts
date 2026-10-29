/**
 * Security Software - request validation shared by the catalog API routes
 */

import { z } from "zod"
import { softwareAccessValues, softwareUpdateMethodValues } from "@/lib/db/schema/security-software"
import { isValidWingetId } from "./software"
import { getRequiredGroupIds } from "./software-intune"

const guid = z.string().uuid("Must be a valid ID")
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()

export const catalogAppFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  publisher: optionalText(120),
  description: optionalText(500),
  notes: optionalText(2000),
  access: z.enum(softwareAccessValues),
  enabled: z.boolean(),
  wingetId: z
    .string()
    .trim()
    .refine(isValidWingetId, "Winget ID can only contain letters, numbers and . + _ -")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  updateMethod: z.enum(softwareUpdateMethodValues),
  autoUpdate: z.boolean(),
  intuneAppId: guid.optional().nullable(),
  intuneAppName: optionalText(200),
  installGroupId: guid.optional().nullable(),
  installGroupName: optionalText(200),
  removeFromGroupAfterInstall: z.boolean(),
  installDeadlineHours: z.number().int().min(1, "At least 1 hour").max(168, "At most 7 days"),
})

export type CatalogAppFields = z.infer<typeof catalogAppFieldsSchema>

/**
 * Rules across fields; returns an error message or null
 */
export function checkCatalogApp(app: Partial<CatalogAppFields>): string | null {
  if (app.updateMethod === "winget" && app.autoUpdate && !app.wingetId) {
    return "Add the winget ID, or turn off automatic updates"
  }
  if (app.installGroupId && !app.intuneAppId) {
    return "Choose the Intune app the install group belongs to"
  }
  return null
}

/**
 * Warn (don't block) when the install group isn't a Required target of the Intune app:
 * adding devices to it would then install nothing.
 */
export async function checkInstallGroupWarning(
  intuneAppId: string | null | undefined,
  installGroupId: string | null | undefined
): Promise<string | null> {
  if (!intuneAppId || !installGroupId) return null
  try {
    const required = await getRequiredGroupIds(intuneAppId)
    return required.includes(installGroupId)
      ? null
      : "The install group isn't a Required assignment of this Intune app, so approved installs won't happen until it is."
  } catch (error) {
    return `Couldn't check the Intune assignment: ${error instanceof Error ? error.message : "unknown error"}`
  }
}
