export type NerveBusClockStamp = {
  iso: string;
  monotonicMs: number;
};

export interface NerveBusClockPort {
  now(): NerveBusClockStamp;
  toEpochMs(isoTimestamp: string): number;
}
