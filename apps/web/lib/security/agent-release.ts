/**
 * IdaraOS Agent self-update - the released agent script
 *
 * The server serves exactly the official agent script shipped with this IdaraOS deployment
 * (deployment/agent/IdaraOS-Agent.ps1). Admins can only move devices to THIS version - they can't
 * upload a script or point the agent at another URL - so this is an update channel, not a way to run
 * arbitrary code. The agent verifies the SHA-256 before replacing itself.
 *
 * The released version is the $AgentVersion in that file, so deploying a new IdaraOS build is what
 * publishes a new agent. Hardening note: the script is not yet Authenticode-signed; signing it and
 * pinning the signer in the agent would protect against a compromised release endpoint.
 */

import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

export interface ReleasedAgent {
  version: string
  /** Lowercase hex SHA-256 of the raw script bytes (the agent verifies this with Get-FileHash) */
  sha256: string
  /** Raw script bytes, served verbatim so the agent's on-disk hash matches */
  content: Buffer
}

const CANDIDATE_PATHS = [
  process.env.AGENT_SCRIPT_PATH,
  // cwd is the repo root (dev container) or apps/web depending on how the server was started
  path.join(process.cwd(), "deployment/agent/IdaraOS-Agent.ps1"),
  path.join(process.cwd(), "..", "..", "deployment/agent/IdaraOS-Agent.ps1"),
  path.join(process.cwd(), "..", "deployment/agent/IdaraOS-Agent.ps1"),
].filter((p): p is string => !!p)

let cache: { path: string; mtimeMs: number; agent: ReleasedAgent } | null = null

async function resolveScriptPath(): Promise<string | null> {
  if (cache) {
    try {
      await stat(cache.path)
      return cache.path
    } catch {
      cache = null
    }
  }
  for (const candidate of CANDIDATE_PATHS) {
    try {
      await stat(candidate)
      return candidate
    } catch {
      // try the next candidate
    }
  }
  return null
}

/**
 * The released agent script with its version and SHA-256, or null if the script file can't be found
 * on the server. Cached, invalidated when the file's mtime changes.
 */
export async function getReleasedAgent(): Promise<ReleasedAgent | null> {
  const scriptPath = await resolveScriptPath()
  if (!scriptPath) return null

  const info = await stat(scriptPath)
  if (cache && cache.path === scriptPath && cache.mtimeMs === info.mtimeMs) {
    return cache.agent
  }

  const content = await readFile(scriptPath)
  const match = content.toString("utf8").match(/\$AgentVersion\s*=\s*"([^"]+)"/)
  if (!match) return null
  const version = match[1]
  const sha256 = createHash("sha256").update(content).digest("hex")

  const agent: ReleasedAgent = { version, sha256, content }
  cache = { path: scriptPath, mtimeMs: info.mtimeMs, agent }
  return agent
}

const INSTALLER_CANDIDATE_PATHS = [
  process.env.AGENT_INSTALLER_PATH,
  path.join(process.cwd(), "deployment/agent/Install-IdaraOSAgent.ps1"),
  path.join(process.cwd(), "..", "..", "deployment/agent/Install-IdaraOSAgent.ps1"),
  path.join(process.cwd(), "..", "deployment/agent/Install-IdaraOSAgent.ps1"),
].filter((p): p is string => !!p)

/**
 * The agent installer script (deployment/agent/Install-IdaraOSAgent.ps1) so a member can install the
 * agent from the portal. Non-secret: it embeds no credentials and pairing (sign-in + code) is the
 * gate. Returns the raw bytes and the `$Version` in it, or null if the file can't be found.
 */
export async function getInstallerScript(): Promise<{ version: string; content: Buffer } | null> {
  for (const candidate of INSTALLER_CANDIDATE_PATHS) {
    try {
      const content = await readFile(candidate)
      const match = content.toString("utf8").match(/\$Version\s*=\s*"([^"]+)"/)
      return { version: match ? match[1] : "", content }
    } catch {
      // try the next candidate
    }
  }
  return null
}
