import type { GeometryClockPort } from "../ports/geometry-clock-port.js";

export function createSystemGeometryClock(): GeometryClockPort {
  return {
    now() {
      const epochMs = Date.now();
      return {
        iso: new Date(epochMs).toISOString(),
        epochMs,
      };
    },
  };
}