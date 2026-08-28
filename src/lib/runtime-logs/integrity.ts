import { createHash } from "node:crypto";

import type { RuntimeLogEventV2, RuntimeLogEventWithoutIntegrity } from "./runtime-event-contract.js";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
};

export const runtimeEventHash = (event: RuntimeLogEventWithoutIntegrity): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(event))).digest("hex")}`;

export const runtimeEventIntegrityValid = (event: RuntimeLogEventV2): boolean => {
  const { eventHash, ...unsigned } = event;
  return runtimeEventHash(unsigned) === eventHash;
};
