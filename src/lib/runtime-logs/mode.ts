// Runtime Log Spine — Mode
// Three-tier visibility model: FLOW (default) / DEBUG / TRACE
// Mode is runtime-configurable via env var or explicit config.

import type { RuntimeLogMode } from "./schema.js";

export type { RuntimeLogMode };

/** Read active log mode from environment or explicit override. */
export function resolveRuntimeLogMode(override?: RuntimeLogMode): RuntimeLogMode {
  if (override) return override;
  const env = process.env["GRASSEYE_LOG_MODE"];
  if (env === "TRACE") return "TRACE";
  if (env === "DEBUG") return "DEBUG";
  return "FLOW";
}

/** Returns true if the given event's modeVisibility includes the active mode. */
export function isEventVisibleInMode(
  eventModeVisibility: RuntimeLogMode[],
  activeMode: RuntimeLogMode,
): boolean {
  if (activeMode === "TRACE") return true;
  if (activeMode === "DEBUG") {
    return eventModeVisibility.includes("DEBUG") || eventModeVisibility.includes("FLOW");
  }
  // FLOW only
  return eventModeVisibility.includes("FLOW");
}
