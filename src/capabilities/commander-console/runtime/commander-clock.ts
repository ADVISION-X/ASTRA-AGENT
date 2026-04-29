import type { CommanderClockPort } from "../ports/commander-clock-port.js";

export function createSystemCommanderClock(): CommanderClockPort {
  return {
    nowIso() { return new Date().toISOString(); },
    monotonicNowMs() { return performance.now(); },
    elapsedMs(startMs, endMs) { return Math.max(0, endMs - startMs); },
  };
}
