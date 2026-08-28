import type { RuntimeLogVisibility } from "./runtime-failure-contract.js";

export type RuntimeLogMode = RuntimeLogVisibility;

const rank: Readonly<Record<RuntimeLogVisibility, number>> = { FLOW: 0, DEBUG: 1, TRACE: 2 };

export const resolveRuntimeLogMode = (override?: RuntimeLogMode): RuntimeLogMode => {
  const candidate = override ?? process.env.GRASSEYE_LOG_MODE ?? "FLOW";
  return candidate === "DEBUG" || candidate === "TRACE" ? candidate : "FLOW";
};

export const isEventVisibleInMode = (
  minimumVisibility: RuntimeLogVisibility,
  activeMode: RuntimeLogMode,
): boolean => rank[activeMode] >= rank[minimumVisibility];
