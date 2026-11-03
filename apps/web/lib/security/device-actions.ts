/**
 * IdaraOS Agent - device actions (pure helpers, no database access)
 *
 * A super admin can run a fixed, reviewed set of named actions on an agent device
 * (restart a service, collect diagnostics, ...). The server only ever sends an action
 * KEY from this allowlist - never a command - and the agent runs only the keys it knows.
 * This keeps the agent unable to run anything that wasn't reviewed and shipped, the same
 * property that limits installs to validated winget package IDs.
 *
 * Shared with the agent (deployment/agent/IdaraOS-Agent.ps1): the action keys, the
 * restart-service allowlist and the result interpretation must match on both sides.
 */

/** A parameter an action takes, chosen from a fixed allowlist (never free text) */
export interface DeviceActionParam {
  /** Field name in the payload, e.g. "service" */
  key: string
  label: string
  /** Allowed values mapped to a human label; the agent resolves the value itself */
  options: Record<string, string>
}

export interface DeviceActionDef {
  /** Stable key sent to the agent */
  key: string
  label: string
  /** What the action does, shown to the super admin before they run it */
  description: string
  /** Changes the device (vs. read-only); the portal confirms these */
  changesDevice: boolean
  param?: DeviceActionParam
}

/**
 * Services the "restart-service" action may restart. The key is sent to the agent, which
 * maps it to the Windows service name itself - so the server can't name an arbitrary service.
 */
export const RESTARTABLE_SERVICES: Record<string, string> = {
  spooler: "Print Spooler",
  wuauserv: "Windows Update",
  bits: "Background Intelligent Transfer",
  dnscache: "DNS Client",
  usosvc: "Update Orchestrator",
}

/**
 * The actions the agent supports. Adding one means shipping a new agent version that
 * implements its key (see IdaraOS-Agent.ps1) - there is no runtime command input.
 */
export const DEVICE_ACTIONS: DeviceActionDef[] = [
  {
    key: "collect-diagnostics",
    label: "Collect diagnostics",
    description:
      "Gathers OS build, uptime, free disk space, pending-reboot state and winget status, and returns it as text.",
    changesDevice: false,
  },
  {
    key: "list-installed-software",
    label: "List installed software",
    description: "Returns winget's list of installed packages on the device.",
    changesDevice: false,
  },
  {
    key: "upgrade-all",
    label: "Update all apps",
    description:
      "Runs winget upgrade on every app that has an update. The agent runs as SYSTEM, so it needs no admin rights and nobody is prompted.",
    changesDevice: true,
  },
  {
    key: "upgrade-all-unknown",
    label: "Update all apps (include unknown versions)",
    description:
      "Like Update all apps, but also tries apps whose installed version winget can't read (--include-unknown). Broader, and occasionally updates more than you expect.",
    changesDevice: true,
  },
  {
    key: "list-node-versions",
    label: "List Node.js versions (nvm)",
    description:
      "Runs nvm list to show the Node.js versions installed under NVM for Windows. Read-only. Needs NVM for Windows installed machine-wide (the agent runs as SYSTEM).",
    changesDevice: false,
  },
  {
    key: "update-node",
    label: "Update Node.js (nvm)",
    description:
      "For each installed Node.js line, installs the newest release in that major version if nvm doesn't already have it (e.g. 22.2.1 -> newest 22.x), keeps the active line current, and records the nvm list in the output. Needs NVM for Windows installed machine-wide.",
    changesDevice: true,
  },
  {
    key: "check-local-admins",
    label: "Check admin accounts",
    description:
      "Reports who is in the device's local Administrators group, so you can spot members who still have admin rights.",
    changesDevice: false,
  },
  {
    key: "restart-service",
    label: "Restart a service",
    description: "Restarts one Windows service on the device.",
    changesDevice: true,
    param: { key: "service", label: "Service", options: RESTARTABLE_SERVICES },
  },
  {
    key: "clear-update-cache",
    label: "Clear Windows Update cache",
    description:
      "Stops Windows Update, clears its download cache and starts it again - a common fix for stuck updates.",
    changesDevice: true,
  },
]

const DEVICE_ACTION_BY_KEY: Record<string, DeviceActionDef> = Object.fromEntries(
  DEVICE_ACTIONS.map((a) => [a.key, a])
)

/** The action definition for a key, or undefined if it isn't a known action */
export function getDeviceAction(key: string): DeviceActionDef | undefined {
  return DEVICE_ACTION_BY_KEY[key]
}

/** Whether `key` is a known device action */
export function isValidDeviceAction(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEVICE_ACTION_BY_KEY, key)
}

/**
 * Whether `param` is acceptable for the action: required and in the allowlist when the
 * action takes one, and absent when it doesn't.
 */
export function isValidDeviceActionParam(key: string, param: string | null | undefined): boolean {
  const action = DEVICE_ACTION_BY_KEY[key]
  if (!action) return false
  if (!action.param) return param == null || param === ""
  return typeof param === "string" && Object.prototype.hasOwnProperty.call(action.param.options, param)
}

/** The display name for an action key, falling back to the key itself */
export function deviceActionName(key: string): string {
  return DEVICE_ACTION_BY_KEY[key]?.label ?? key
}

export interface ActionOutcome {
  succeeded: boolean
  message: string
}

/**
 * What an action's exit code means. The agent reports 0 on success, non-zero on failure;
 * there is no winget-style retry semantics - a failed action is just reported, not retried.
 */
export function interpretActionExitCode(exitCode: number | null | undefined): ActionOutcome {
  if (exitCode === 0) return { succeeded: true, message: "Done" }
  if (exitCode === null || exitCode === undefined) {
    return { succeeded: false, message: "The agent didn't report a result" }
  }
  return { succeeded: false, message: `The action failed (0x${(exitCode >>> 0).toString(16).toUpperCase().padStart(8, "0")})` }
}

/**
 * The job result to store for an action the agent reported
 */
export function actionJobResult(
  exitCode: number | null | undefined,
  agentMessage?: string | null
): { succeeded: boolean; exitCode: number | null; message: string } {
  const outcome = interpretActionExitCode(exitCode)
  return {
    succeeded: outcome.succeeded,
    exitCode: exitCode ?? null,
    message: agentMessage?.trim() || outcome.message,
  }
}
