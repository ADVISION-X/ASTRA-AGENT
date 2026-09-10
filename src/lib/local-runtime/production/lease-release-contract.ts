import type { SerializedExecutionFailure } from "./terminal-failure.js";

export type ProductionLeaseRelease =
  | Readonly<{
    reasonCode: "CAPABILITY_CHANGED_BEFORE_ACCEPT" | "LEASE_SAFETY_BUDGET_EXHAUSTED" | "LOCAL_CAPACITY_CHANGED";
    attemptFailure: null;
  }>
  | Readonly<{
    reasonCode: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";
    attemptFailure: null;
  }>
  | Readonly<{
    reasonCode: "ATTEMPT_FAILED";
    attemptFailure: SerializedExecutionFailure;
  }>;
