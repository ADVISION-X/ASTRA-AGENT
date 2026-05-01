import type { RequestedPlatformId } from "./task-start-types.js";

export function normalizeRequestedPlatformId(value?: string): RequestedPlatformId | null {
  return value === "tiktok-web" || value === "facebook-web" ? value : null;
}

export function normalizePositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    return undefined;
  }

  return value;
}