import type { AiClockEnd, AiClockPort, AiClockStart } from "../ports/ai-clock-port.js";

export function createSystemAiClock(): AiClockPort {
  return {
    startRun(): AiClockStart {
      return {
        startedAt: new Date().toISOString(),
        startedMonotonicMs: performance.now(),
        portKind: "system-monotonic-clock",
      };
    },
    finishRun(start): AiClockEnd {
      const endedMonotonicMs = performance.now();
      return {
        endedAt: new Date().toISOString(),
        endedMonotonicMs,
        durationMs: Math.max(0, endedMonotonicMs - start.startedMonotonicMs),
        portKind: start.portKind,
      };
    },
  };
}
