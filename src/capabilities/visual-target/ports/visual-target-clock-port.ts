export type VisualTargetClockSnapshot = {
  isoTimestamp: string;
  epochMs: number;
  monotonicMs: number;
};

export interface VisualTargetClockPort {
  readonly portKind: "system-monotonic-clock";
  now(): VisualTargetClockSnapshot;
}