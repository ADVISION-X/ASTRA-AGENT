type PrimitiveClockSnapshot = {
  isoTimestamp: string;
  monotonicMs: number;
};

type PrimitiveFailureReason =
  | "primitive_failed"
  | "primitive_timeout"
  | "primitive_execution_ref_missing"
  | "primitive_threw"
  | "primitive_circuit_open"
  | "primitive_concurrency_guard"
  | "primitive_aborted";

type PrimitiveFailureDecision = "failed" | "threw" | "aborted";

type PrimitiveCommonFrame = {
  primitiveExecutionRef: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  primitiveCallId: string;
  primitiveStartedAt: string;
  primitiveEndedAt: string;
  primitivePortKind: string;
};

type PrimitiveFrameInput = {
  startedSnapshot: PrimitiveClockSnapshot;
  endedSnapshot: PrimitiveClockSnapshot;
  primitiveCallId: string;
  primitiveStartedAt: string;
  primitiveExecutionRef: string | null;
  primitivePortKind: string;
};

type PrimitiveFailureInput = PrimitiveFrameInput & {
  failureReason: PrimitiveFailureReason;
  primitiveDecision: PrimitiveFailureDecision;
  statusMessage: string;
  dataQualityFlags: string[];
  timeoutTriggered: boolean;
  circuitOpenUntilMs: number;
};

type PrimitiveSuccessInput = PrimitiveFrameInput & {
  primitiveExecutionRef: string;
  statusMessage: string;
};

export type PrimitiveClickSuccessResult = {
  ok: true;
  primitiveExecutionRef: string;
  primitiveDecision: "succeeded";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  statusMessage: string;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  primitiveCallId: string;
  primitiveStartedAt: string;
  primitiveEndedAt: string;
  timeoutDecision: "within_limit";
  abortDecision: "not_requested";
  circuitBreakerState: "closed";
  portHangDetected: false;
  primitivePortKind: string;
};

export type PrimitiveClickFailureResult = {
  ok: false;
  failureReason: PrimitiveFailureReason;
  primitiveDecision: PrimitiveFailureDecision;
  primitiveExecutionRef: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  statusMessage: string;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  dataQualityFlags: string[];
  primitiveCallId: string;
  primitiveStartedAt: string;
  primitiveEndedAt: string;
  timeoutDecision: "within_limit" | "timed_out";
  abortDecision: "not_requested" | "timeout_abort_requested";
  circuitBreakerState: "closed" | "open";
  portHangDetected: boolean;
  primitivePortKind: string;
};

export type PrimitiveClickResult = PrimitiveClickSuccessResult | PrimitiveClickFailureResult;

const buildPrimitiveCommonFrame = (input: PrimitiveFrameInput): PrimitiveCommonFrame => ({
  primitiveExecutionRef: input.primitiveExecutionRef,
  startedAt: input.startedSnapshot.isoTimestamp,
  endedAt: input.endedSnapshot.isoTimestamp,
  durationMs: Math.max(0, Math.round(input.endedSnapshot.monotonicMs - input.startedSnapshot.monotonicMs)),
  clock: {
    startedMonotonicMs: input.startedSnapshot.monotonicMs,
    endedMonotonicMs: input.endedSnapshot.monotonicMs,
  },
  primitiveCallId: input.primitiveCallId,
  primitiveStartedAt: input.primitiveStartedAt,
  primitiveEndedAt: input.endedSnapshot.isoTimestamp,
  primitivePortKind: input.primitivePortKind,
});

const resolveCircuitBreakerState = (circuitOpenUntilMs: number, endedSnapshot: PrimitiveClockSnapshot): "closed" | "open" => {
  return circuitOpenUntilMs > endedSnapshot.monotonicMs ? "open" : "closed";
};

export const buildPrimitiveFailureResult = (input: PrimitiveFailureInput): PrimitiveClickFailureResult => ({
  ok: false,
  failureReason: input.failureReason,
  primitiveDecision: input.primitiveDecision,
  statusMessage: input.statusMessage,
  dataQualityFlags: input.dataQualityFlags,
  timeoutDecision: input.timeoutTriggered ? "timed_out" : "within_limit",
  abortDecision: input.timeoutTriggered ? "timeout_abort_requested" : "not_requested",
  circuitBreakerState: resolveCircuitBreakerState(input.circuitOpenUntilMs, input.endedSnapshot),
  portHangDetected: input.timeoutTriggered,
  ...buildPrimitiveCommonFrame(input),
});

export const buildPrimitiveSuccessResult = (input: PrimitiveSuccessInput): PrimitiveClickSuccessResult => ({
  ok: true,
  primitiveExecutionRef: input.primitiveExecutionRef,
  primitiveDecision: "succeeded",
  statusMessage: input.statusMessage,
  timeoutDecision: "within_limit",
  abortDecision: "not_requested",
  circuitBreakerState: "closed",
  portHangDetected: false,
  ...buildPrimitiveCommonFrame(input),
});