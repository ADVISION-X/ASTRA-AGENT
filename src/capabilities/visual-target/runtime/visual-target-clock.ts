import { performance } from "node:perf_hooks";

import type { VisualTargetClockPort } from "../ports/visual-target-clock-port.js";

export function createSystemVisualTargetClock(): VisualTargetClockPort {
  return {
    portKind: "system-monotonic-clock",
    now() {
      const epochMs = Date.now();
      return {
        isoTimestamp: new Date(epochMs).toISOString(),
        epochMs,
        monotonicMs: performance.now(),
      };
    },
  };
}

export function parseVisualTargetIsoTimestamp(isoTimestamp: string): number {
  const parsed = Date.parse(isoTimestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}