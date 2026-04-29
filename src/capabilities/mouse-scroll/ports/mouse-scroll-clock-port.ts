export type MouseScrollClockSnapshot = {
  isoTimestamp: string;
  monotonicMs: number;
};

export interface MouseScrollClockPort {
  readonly portKind: "system-monotonic-clock";
  now(): MouseScrollClockSnapshot;
}