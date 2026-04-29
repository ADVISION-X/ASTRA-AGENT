import type { ScreenshotClockPort } from "../ports/screenshot-clock-port.js";

export type ScreenshotClockStart = {
  startedAt: string;
  startedMonotonicMs: number;
};

export function startScreenshotClock(clockPort: ScreenshotClockPort): ScreenshotClockStart {
  return {
    startedAt: clockPort.nowIso(),
    startedMonotonicMs: clockPort.nowMonotonicMs(),
  };
}

export function finishScreenshotClock(input: {
  clockPort: ScreenshotClockPort;
  startedAt: string;
  startedMonotonicMs: number;
}): {
  endedAt: string;
  endedMonotonicMs: number;
  durationMs: number;
} {
  const endedMonotonicMs = input.clockPort.nowMonotonicMs();
  return {
    endedAt: input.clockPort.nowIso(),
    endedMonotonicMs,
    durationMs: Math.max(0, Math.round(endedMonotonicMs - input.startedMonotonicMs)),
  };
}
