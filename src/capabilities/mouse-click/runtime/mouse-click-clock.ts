import { performance } from "node:perf_hooks";

import type { MouseClickClockPort } from "../ports/mouse-click-clock-port.js";

export function createSystemMouseClickClock(): MouseClickClockPort {
  return {
    now() {
      return {
        isoTimestamp: new Date().toISOString(),
        monotonicMs: performance.now(),
        portKind: "system-monotonic-clock",
      };
    },
  };
}