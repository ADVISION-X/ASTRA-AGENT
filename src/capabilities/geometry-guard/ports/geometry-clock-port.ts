export type GeometryClockInstant = {
  iso: string;
  epochMs: number;
};

export interface GeometryClockPort {
  now(): GeometryClockInstant;
}