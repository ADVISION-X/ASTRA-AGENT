import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";

export function createSystemForensicsClockPort(): ForensicsClockPort {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}
