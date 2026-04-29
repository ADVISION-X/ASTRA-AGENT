export interface CommanderClockPort {
  nowIso(): string;
  monotonicNowMs(): number;
  elapsedMs(startMs: number, endMs: number): number;
}
