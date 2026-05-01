type PrimitiveScrollFailureReason =
  | "primitive_failed"
  | "primitive_threw"
  | "primitive_timeout"
  | "primitive_execution_ref_missing"
  | "primitive_circuit_open"
  | "primitive_concurrency_guard"
  | "primitive_aborted";

type PrimitiveTimeoutDecision = "within_limit" | "timed_out";
type PrimitiveAbortDecision = "not_requested" | "timeout_abort_requested";
type PrimitiveCircuitBreakerState = "closed" | "open";
type PrimitiveIterationStatus = "failed" | "threw" | "aborted" | "succeeded";

type PrimitiveIterationProof = {
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

type PrimitiveScrollSuccessResult = PrimitiveScrollResultBase & {
  ok: true;
  primitiveDecision: "succeeded";
};

type PrimitiveScrollFailureResult = PrimitiveScrollResultBase & {
  ok: false;
  primitiveExecutionRef: string | null;
  primitiveDecision: "failed" | "threw" | "aborted";
  failureReason: PrimitiveScrollFailureReason;
};

type PrimitiveScrollResult = PrimitiveScrollSuccessResult | PrimitiveScrollFailureResult;

const buildPrimitiveIterationProof = (input: PrimitiveIterationProof): PrimitiveIterationProof => input;

const buildPrimitiveScrollSuccessResult = (input: PrimitiveScrollSuccessResult): PrimitiveScrollSuccessResult => input;

const buildPrimitiveScrollFailureResult = (input: PrimitiveScrollFailureResult): PrimitiveScrollFailureResult => input;

export {
  buildPrimitiveIterationProof,
  buildPrimitiveScrollFailureResult,
  buildPrimitiveScrollSuccessResult,
};

export type {
  PrimitiveAbortDecision,
  PrimitiveCircuitBreakerState,
  PrimitiveIterationProof,
  PrimitiveIterationStatus,
  PrimitiveScrollFailureReason,
  PrimitiveScrollFailureResult,
  PrimitiveScrollResult,
  PrimitiveScrollSuccessResult,
  PrimitiveTimeoutDecision,
};
