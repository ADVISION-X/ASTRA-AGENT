import { performance } from "node:perf_hooks";

import type { ScreenshotClockPort } from "../ports/screenshot-clock-port.js";

export function createSystemScreenshotClockPort(): ScreenshotClockPort {
  return {
    portKind: "system-monotonic-screenshot-clock",
    nowIso: () => new Date().toISOString(),
    nowMonotonicMs: () => performance.now(),
  };
}