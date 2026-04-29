import { performance } from "node:perf_hooks";

import type { OrchestrationClockPort } from "../ports/orchestration-clock-port.js";

export function createSystemOrchestrationClock(): OrchestrationClockPort {
  return {
    portKind: "system-monotonic-clock",
    now() {
      return {
        isoTimestamp: new Date().toISOString(),
        monotonicMs: performance.now(),
      };
    },
  };
}