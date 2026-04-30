export interface TextInputClockPort {
  now(): {
    isoTimestamp: string;
    monotonicMs: number;
    portKind: "system-monotonic-clock";
  };
}