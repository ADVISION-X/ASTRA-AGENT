export type MouseClickClockSnapshot = {
  isoTimestamp: string;
  monotonicMs: number;
  portKind: "system-monotonic-clock";
};

export interface MouseClickClockPort {
  now(): MouseClickClockSnapshot;
}