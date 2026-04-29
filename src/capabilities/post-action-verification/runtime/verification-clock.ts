import type { PostActionVerificationClockPort } from "../ports/post-action-verification-clock-port.js";

export function parsePostActionTimestampMs(timestamp: string): number {
  return new Date(timestamp).getTime();
}

export function createSystemPostActionVerificationClock(): PostActionVerificationClockPort {
  const monotonicClock = typeof globalThis.performance?.now === "function"
    ? () => globalThis.performance.now()
    : () => Date.now();

  return {
    portKind: "post-action-verification-clock",
    now() {
      const epochMs = Date.now();
      return {
        isoTimestamp: new Date(epochMs).toISOString(),
        monotonicMs: monotonicClock(),
      };
    },
  };
}
