export type VisualTargetClockSnapshot = {
  isoTimestamp: string;
  monotonicMs: number;
};

export interface VisualTargetClockPort {
  readonly portKind: "system-monotonic-clock";
  now(): VisualTargetClockSnapshot;
}