import { performance } from "node:perf_hooks";

import type { TextInputClockPort } from "../ports/text-input-clock-port.js";

export function createSystemTextInputClock(): TextInputClockPort {
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