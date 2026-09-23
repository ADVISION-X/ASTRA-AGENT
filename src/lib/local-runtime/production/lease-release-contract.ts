import type { SerializedTerminalFailure } from "./terminal-failure.js";

export type ProductionLeaseRelease =
  | Readonly<{
    reasonCode: "CAPABILITY_CHANGED_BEFORE_ACCEPT" | "LEASE_SAFETY_BUDGET_EXHAUSTED"
      | "LOCAL_CAPACITY_CHANGED" | "PROVIDER_READBACK_UNAVAILABLE";
    attemptFailure: null;
  }>
  | Readonly<{
    reasonCode: "ATTEMPT_FAILED";
    attemptFailure: SerializedTerminalFailure;
  }>;
