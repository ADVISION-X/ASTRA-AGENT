import { performance } from "node:perf_hooks";

import type { OpenClockPort } from "../ports/open-clock-port.js";

export function createSystemOpenClock(): OpenClockPort {
  return {
    now() {
      return {
        isoTimestamp: new Date().toISOString(),
        monotonicMs: performance.now(),
      };
    },
  };
}