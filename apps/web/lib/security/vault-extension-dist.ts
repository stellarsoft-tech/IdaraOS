/**
 * Self-hosted distribution of the IdaraOS Vault browser extension (Phase 5 / agent force-install).
 *
 * The extension is packed into a signed .crx with a STABLE id (from the key baked into
 * apps/extension/manifest.json). IdaraOS serves the .crx + an Omaha update manifest so the agent can
 * force-install it via Chrome/Edge's ExtensionInstallForcelist policy — no web store, no Intune.
 *
 * Place the packed file at deployment/extension/idaraos-vault.crx (or set VAULT_EXTENSION_CRX_PATH).
 * See apps/extension/pack.mjs and apps/extension/README.md.
 */

import { readFile, stat } from "node:fs/promises"
import path from "node:path"

/** Stable extension id, derived from the signing key baked into the manifest's "key". */
export const VAULT_EXTENSION_ID = "fjlcilgleihnoonfmbofcfidpimedbof"

/** Keep in sync with apps/extension/manifest.json "version" (shown in the update manifest). */
export const VAULT_EXTENSION_VERSION = "1.0.0"

const CRX_CANDIDATE_PATHS = [
  process.env.VAULT_EXTENSION_CRX_PATH,
  path.join(process.cwd(), "deployment/extension/idaraos-vault.crx"),
  path.join(process.cwd(), "..", "..", "deployment/extension/idaraos-vault.crx"),
  path.join(process.cwd(), "..", "deployment/extension/idaraos-vault.crx"),
].filter((p): p is string => !!p)

/** The packed .crx bytes, or null if it hasn't been built/placed on this server yet. */
export async function getExtensionCrx(): Promise<Buffer | null> {
  for (const candidate of CRX_CANDIDATE_PATHS) {
    try {
      await stat(candidate)
      return await readFile(candidate)
    } catch {
      // try the next candidate
    }
  }
  return null
}

/** The Omaha (gupdate) update manifest Chrome/Edge fetch to discover + download the extension. */
export function buildUpdateXml(baseUrl: string): string {
  const crxUrl = `${baseUrl}/api/updater/v1/extension/idaraos-vault.crx`
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${VAULT_EXTENSION_ID}'>
    <updatecheck codebase='${crxUrl}' version='${VAULT_EXTENSION_VERSION}' />
  </app>
</gupdate>
`
}
