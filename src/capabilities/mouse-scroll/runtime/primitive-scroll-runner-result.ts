export type PrimitiveScrollFailureReason =
  | "primitive_failed"
  | "primitive_threw"
  | "primitive_timeout"
  | "primitive_execution_ref_missing"
  | "primitive_circuit_open"
  | "primitive_concurrency_guard"
  | "primitive_aborted";

export type PrimitiveTimeoutDecision = "within_limit" | "timed_out";
export type PrimitiveAbortDecision = "not_requested" | "timeout_abort_requested";
export type PrimitiveCircuitBreakerState = "closed" | "open";
export type PrimitiveIterationStatus = "failed" | "threw" | "aborted" | "succeeded";

export type PrimitiveIterationProof = {
  repeatIndex: number;
  primitiveCallId: string;
  primitiveExecutionRef: string | null;
  status: PrimitiveIterationStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  timeoutDecision: PrimitiveTimeoutDecision;
  abortDecision: PrimitiveAbortDecision;
  portHangDetected: boolean;
  primitivePortKind: string;
};

type PrimitiveScrollResultBase = {
  primitiveExecutionRefs: string[];
  statusMessage: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  primitiveCallId: string;
  primitiveStartedAt: string;
  primitiveEndedAt: string;
  timeoutDecision: PrimitiveTimeoutDecision;
  abortDecision: PrimitiveAbortDecision;
  circuitBreakerState: PrimitiveCircuitBreakerState;
  portHangDetected: boolean;
  primitivePortKind: string;
  perIterationPrimitiveProofs: PrimitiveIterationProof[];
  dataQualityFlags: string[];
};

export type PrimitiveScrollSuccessResult = PrimitiveScrollResultBase & {
  ok: true;
  primitiveDecision: "succeeded";
};

export type PrimitiveScrollFailureResult = PrimitiveScrollResultBase & {
  ok: false;
  primitiveExecutionRef: string | null;
  primitiveDecision: "failed" | "threw" | "aborted";
  failureReason: PrimitiveScrollFailureReason;
};

export type PrimitiveScrollResult = PrimitiveScrollSuccessResult | PrimitiveScrollFailureResult;

export const buildPrimitiveIterationProof = (input: PrimitiveIterationProof): PrimitiveIterationProof => input;

export const buildPrimitiveScrollSuccessResult = (input: PrimitiveScrollSuccessResult): PrimitiveScrollSuccessResult => input;

export const buildPrimitiveScrollFailureResult = (input: PrimitiveScrollFailureResult): PrimitiveScrollFailureResult => input;