import { performance } from "node:perf_hooks";

export type NerveBusClockStamp = {
  iso: string;
  monotonicMs: number;
};

export interface NerveBusClockPort {
  now(): NerveBusClockStamp;
  toEpochMs(isoTimestamp: string): number;
}

export function createSystemNerveBusClockPort(): NerveBusClockPort {
  return {
    now() {
      return {
        iso: new Date().toISOString(),
        monotonicMs: performance.now(),
      };
    },
    toEpochMs(isoTimestamp) {
      return Date.parse(isoTimestamp);
    },
  };
}
