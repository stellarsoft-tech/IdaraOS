/**
 * Document draft / publish workflow helpers.
 * Published content lives in primary storage; pending edits are held separately
 * until the document is approved and published again.
 */

export function bumpPatchVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1]}.1`
  }
  if (parts.length >= 3) {
    const patch = parseInt(parts[2], 10) || 0
    return `${parts[0]}.${parts[1]}.${patch + 1}`
  }
  return `${version}.1`
}

export function hasPendingDraft(
  status: string,
  pendingContent: string | null | undefined
): boolean {
  return status === "in_review" && !!pendingContent
}
