import { performance } from "node:perf_hooks";

import type { NerveBusClockPort } from "../ports/nerve-bus-clock-port.js";

export function createSystemNerveBusClockPort(): NerveBusClockPort {
  return {
    now() {
      return {
        iso: new Date().toISOString(),
        monotonicMs: performance.now(),
      };
    },
    toEpochMs(isoTimestamp) {
      return Date.parse(isoTimestamp);
    },
  };
}