import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateClockReading } from "../shared/page-state-types.js";

function toClockReading(epochMs: number): PageStateClockReading {
  return {
    isoTimestamp: new Date(epochMs).toISOString(),
    epochMs,
  };
}

export function createSystemPageStateClock(): PageStateClockPort {
  return {
    now() {
      return toClockReading(Date.now());
    },
    fromIsoString(value) {
      const epochMs = new Date(value).getTime();
      return Number.isFinite(epochMs) ? toClockReading(epochMs) : null;
    },
    durationMs(start, end) {
      return Math.max(0, end.epochMs - start.epochMs);
    },
  };
}