import { performance } from "node:perf_hooks";

import type { ScreenshotClockPort } from "../ports/screenshot-clock-port.js";

export function addHoursToIsoTimestamp(timestamp: string, hours: number): string {
  return new Date(new Date(timestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function createSystemScreenshotClockPort(): ScreenshotClockPort {
  return {
    portKind: "system-monotonic-screenshot-clock",
    nowIso: () => new Date().toISOString(),
    nowMonotonicMs: () => performance.now(),
  };
}