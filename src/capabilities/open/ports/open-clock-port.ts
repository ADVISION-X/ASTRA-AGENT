export type OpenClockInstant = {
  isoTimestamp: string;
  monotonicMs: number;
};

export interface OpenClockPort {
  now(): OpenClockInstant;
}