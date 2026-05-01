import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";
import { buildRunDurationMs } from "./primitive-scroll-frame.js";
import { buildPrimitiveScrollFailureResult, type PrimitiveAbortDecision, type PrimitiveScrollFailureReason, type PrimitiveScrollResult, type PrimitiveTimeoutDecision } from "./primitive-scroll-runner-result.js";
import type { PrimitiveCallFrame, PrimitiveClockSnapshot, PrimitiveExecutionStore } from "./primitive-scroll-runner-types.js";
import { closeCircuitIfExpired, getPrimitiveCircuitBreakerState, isPrimitiveConcurrencyBlocked, isPrimitiveCircuitOpen } from "./primitive-scroll-runner-state.js";

type BuildFailureResultInput = {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  store: PrimitiveExecutionStore;
  primitiveExecutionRef: string | null;
  primitiveDecision: "failed" | "threw" | "aborted";
  failureReason: PrimitiveScrollFailureReason;
  statusMessage: string;
  timeoutDecision: PrimitiveTimeoutDecision;
  abortDecision: PrimitiveAbortDecision;
  portHangDetected: boolean;
  primitivePortKind: string;
  dataQualityFlags: string[];
};

export const buildFailureResult = (input: BuildFailureResultInput) => {
  return buildPrimitiveScrollFailureResult({
    ok: false,
    primitiveExecutionRefs: input.store.primitiveExecutionRefs,
    primitiveExecutionRef: input.primitiveExecutionRef,
    primitiveDecision: input.primitiveDecision,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    startedAt: input.frame.primitiveStartedAt,
    endedAt: input.endedSnapshot.isoTimestamp,
    durationMs: buildRunDurationMs(input.frame, input.endedSnapshot),
    clock: {
      startedMonotonicMs: input.frame.startedSnapshot.monotonicMs,
      endedMonotonicMs: input.endedSnapshot.monotonicMs,
    },
    dataQualityFlags: input.dataQualityFlags,
    primitiveCallId: input.frame.primitiveCallId,
    primitiveStartedAt: input.frame.primitiveStartedAt,
    primitiveEndedAt: input.endedSnapshot.isoTimestamp,
    timeoutDecision: input.timeoutDecision,
    abortDecision: input.abortDecision,
    circuitBreakerState: getPrimitiveCircuitBreakerState(input.endedSnapshot.monotonicMs),
    portHangDetected: input.portHangDetected,
    primitivePortKind: input.primitivePortKind,
    perIterationPrimitiveProofs: input.store.perIterationPrimitiveProofs,
  });
};

const buildImmediateRejectionFailure = (
  frame: PrimitiveCallFrame,
  context: MouseScrollExecutionContext,
  failureReason: PrimitiveScrollFailureReason,
  statusMessage: string,
) => {
  return buildFailureResult({
    frame,
    endedSnapshot: context.clock.now(),
    store: { primitiveExecutionRefs: [], perIterationPrimitiveProofs: [] },
    primitiveExecutionRef: null,
    primitiveDecision: "failed",
    failureReason,
    statusMessage,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    portHangDetected: false,
    primitivePortKind: "browser-controller",
    dataQualityFlags: [failureReason],
  });
};

export const buildImmediateRejection = (frame: PrimitiveCallFrame, context: MouseScrollExecutionContext): PrimitiveScrollResult | null => {
  closeCircuitIfExpired(frame.startedSnapshot.monotonicMs);
  if (isPrimitiveCircuitOpen(frame.startedSnapshot.monotonicMs)) {
    return buildImmediateRejectionFailure(frame, context, "primitive_circuit_open", "Mouse Scroll primitive circuit breaker is open.");
  }
  if (isPrimitiveConcurrencyBlocked()) {
    return buildImmediateRejectionFailure(frame, context, "primitive_concurrency_guard", "Mouse Scroll primitive concurrency guard rejected the call.");
  }
  return null;
};