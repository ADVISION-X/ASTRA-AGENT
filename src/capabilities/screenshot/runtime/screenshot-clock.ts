import type { ScreenshotClockPort } from "../ports/screenshot-clock-port.js";

export type ScreenshotClockStart = {
  startedAt: string;
  startedMonotonicMs: number;
};

export type ScreenshotPhaseTimings = {
  capturePhaseMs: number | null;
  imageProcessingPhaseMs: number | null;
  artifactStoragePhaseMs: number | null;
  outputBoundaryPhaseMs: number | null;
  totalScreenshotStepMs: number | null;
};

export const EMPTY_SCREENSHOT_PHASE_TIMINGS: ScreenshotPhaseTimings = {
  capturePhaseMs: null,
  imageProcessingPhaseMs: null,
  artifactStoragePhaseMs: null,
  outputBoundaryPhaseMs: null,
  totalScreenshotStepMs: null,
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

export async function measureScreenshotPhaseMs<T>(input: {
  clockPort: ScreenshotClockPort;
  invoke: () => Promise<T>;
}): Promise<{ result: T; durationMs: number }> {
  const startedMonotonicMs = input.clockPort.nowMonotonicMs();
  const result = await input.invoke();
  const endedMonotonicMs = input.clockPort.nowMonotonicMs();
  return {
    result,
    durationMs: Math.max(0, Math.round(endedMonotonicMs - startedMonotonicMs)),
  };
}
