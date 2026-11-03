import { describe, it, expect } from "vitest"
import {
  DEVICE_ACTIONS,
  RESTARTABLE_SERVICES,
  actionJobResult,
  deviceActionName,
  getDeviceAction,
  interpretActionExitCode,
  isValidDeviceAction,
  isValidDeviceActionParam,
} from "../../lib/security/device-actions"

describe("device action allowlist", () => {
  it("only accepts known action keys", () => {
    expect(isValidDeviceAction("restart-service")).toBe(true)
    expect(isValidDeviceAction("collect-diagnostics")).toBe(true)
    expect(isValidDeviceAction("upgrade-all")).toBe(true)
    expect(isValidDeviceAction("upgrade-all-unknown")).toBe(true)
    expect(isValidDeviceAction("list-node-versions")).toBe(true)
    expect(isValidDeviceAction("update-node")).toBe(true)
    expect(isValidDeviceAction("rm -rf /")).toBe(false)
    expect(isValidDeviceAction("")).toBe(false)
    expect(isValidDeviceAction("toString")).toBe(false)
    expect(isValidDeviceAction("constructor")).toBe(false)
  })

  it("names every action and no key repeats", () => {
    const keys = DEVICE_ACTIONS.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const action of DEVICE_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0)
      expect(action.description.length).toBeGreaterThan(0)
      expect(getDeviceAction(action.key)).toBe(action)
    }
  })

  it("falls back to the key for an unknown name", () => {
    expect(deviceActionName("restart-service")).toBe("Restart a service")
    expect(deviceActionName("nope")).toBe("nope")
  })
})

describe("device action parameters", () => {
  it("requires an allowlisted service for restart-service", () => {
    expect(isValidDeviceActionParam("restart-service", "spooler")).toBe(true)
    expect(isValidDeviceActionParam("restart-service", "wuauserv")).toBe(true)
    // Not in the allowlist
    expect(isValidDeviceActionParam("restart-service", "TermService")).toBe(false)
    // Must be present
    expect(isValidDeviceActionParam("restart-service", null)).toBe(false)
    expect(isValidDeviceActionParam("restart-service", "")).toBe(false)
    // Prototype keys must not sneak through
    expect(isValidDeviceActionParam("restart-service", "toString")).toBe(false)
  })

  it("rejects a parameter on an action that takes none", () => {
    expect(isValidDeviceActionParam("collect-diagnostics", null)).toBe(true)
    expect(isValidDeviceActionParam("collect-diagnostics", "")).toBe(true)
    expect(isValidDeviceActionParam("collect-diagnostics", "spooler")).toBe(false)
  })

  it("rejects a parameter for an unknown action", () => {
    expect(isValidDeviceActionParam("nope", "spooler")).toBe(false)
    expect(isValidDeviceActionParam("nope", null)).toBe(false)
  })

  it("every restart-service option maps to a service name", () => {
    const restart = getDeviceAction("restart-service")
    expect(restart?.param?.options).toEqual(RESTARTABLE_SERVICES)
    expect(Object.keys(RESTARTABLE_SERVICES).length).toBeGreaterThan(0)
  })
})

describe("action results", () => {
  it("treats exit 0 as success", () => {
    expect(interpretActionExitCode(0)).toEqual({ succeeded: true, message: "Done" })
  })

  it("treats any other exit code as failure", () => {
    expect(interpretActionExitCode(1).succeeded).toBe(false)
    expect(interpretActionExitCode(null)).toMatchObject({ succeeded: false })
    expect(interpretActionExitCode(undefined)).toMatchObject({ succeeded: false })
  })

  it("formats a non-zero exit code as hex", () => {
    expect(interpretActionExitCode(1).message).toBe("The action failed (0x00000001)")
  })

  it("prefers the agent's own message", () => {
    expect(actionJobResult(0, "Restarted the Spooler service")).toEqual({
      succeeded: true,
      exitCode: 0,
      message: "Restarted the Spooler service",
    })
    expect(actionJobResult(1, null)).toMatchObject({ succeeded: false, exitCode: 1 })
    expect(actionJobResult(0, null).message).toBe("Done")
  })
})
