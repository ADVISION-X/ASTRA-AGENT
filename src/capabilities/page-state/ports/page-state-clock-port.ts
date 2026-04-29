import type { PageStateClockReading } from "../shared/page-state-types.js";

export interface PageStateClockPort {
  now(): PageStateClockReading;
  fromIsoString(value: string): PageStateClockReading | null;
  durationMs(start: PageStateClockReading, end: PageStateClockReading): number;
}