export type OrchestrationClockSnapshot = {
  isoTimestamp: string;
  monotonicMs: number;
};

export interface OrchestrationClockPort {
  readonly portKind: "system-monotonic-clock";
  now(): OrchestrationClockSnapshot;
}