export type AiClockPortKind = "system-monotonic-clock";

export type AiClockStart = {
  startedAt: string;
  startedMonotonicMs: number;
  portKind: AiClockPortKind;
};

export type AiClockEnd = {
  endedAt: string;
  endedMonotonicMs: number;
  durationMs: number;
  portKind: AiClockPortKind;
};

export interface AiClockPort {
  startRun(): AiClockStart;
  finishRun(start: AiClockStart): AiClockEnd;
}
