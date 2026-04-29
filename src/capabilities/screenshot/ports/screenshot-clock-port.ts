import { performance } from "node:perf_hooks";

export interface ScreenshotClockPort {
  readonly portKind: "system-monotonic-screenshot-clock";
  nowIso(): string;
  nowMonotonicMs(): number;
}

export function createSystemScreenshotClockPort(): ScreenshotClockPort {
  return {
    portKind: "system-monotonic-screenshot-clock",
    nowIso: () => new Date().toISOString(),
    nowMonotonicMs: () => performance.now(),
  };
}
