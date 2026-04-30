export interface ScreenshotClockPort {
  readonly portKind: "system-monotonic-screenshot-clock";
  nowIso(): string;
  nowMonotonicMs(): number;
}
