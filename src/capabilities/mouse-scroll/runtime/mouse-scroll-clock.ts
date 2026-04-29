import { performance } from "node:perf_hooks";

import type { MouseScrollClockPort } from "../ports/mouse-scroll-clock-port.js";

export function createSystemMouseScrollClock(): MouseScrollClockPort {
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