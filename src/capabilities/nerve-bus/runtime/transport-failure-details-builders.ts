import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { ExecutionClockSnapshot, ExecutionFailureDetails, NerveBusChildOutcome } from "./transport-failure-types.js";
import { finalizeFailure } from "./transport-failure-finalizer.js";
import type { SupportedEnvelope, SupportedResultEnvelope, NerveBusChildDefinition } from "../shared/nerve-bus-channel.js";

export function buildGuardFailureDetails(
  input: { envelope: SupportedEnvelope },
  started: ExecutionClockSnapshot,
  details: Omit<ExecutionFailureDetails, "handlerDecision" | "handlerCallId" | "handlerStartedAt" | "handlerEndedAt" | "handlerDurationMs" | "reviewRequiredReason"> & { reviewRequiredReason?: string | null },
): ExecutionFailureDetails {
  return {
    ...details,
    handlerDecision: "not_invoked",
    reviewRequiredReason: details.reviewRequiredReason ?? null,
    handlerCallId: input.envelope.envelopeId,
    handlerStartedAt: started.iso,
    handlerEndedAt: started.iso,
    handlerDurationMs: 0,
  };
}

export function buildHandlerFailureDetails<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(outcome: Extract<NerveBusChildOutcome<TEnvelope, TResult>, { kind: "handler_failed" }>): ExecutionFailureDetails {
  const timedOut = outcome.handlerDecision === "timed_out";

  return {
    failureReason: outcome.failureReason,
    integrityDecision: "valid",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "accepted",
    queueDecision: "acquired",
    timeoutDecision: outcome.timeoutDecision,
    handlerDecision: outcome.handlerDecision,
    policyDecision: "allowed",
    status: timedOut ? "review_required" : "failed",
    reviewRequiredReason: timedOut ? "Transport handler exceeded the channel timeout and requires operator review." : null,
    transportDecision: "executed",
    handlerCallId: outcome.handlerCallId,
    handlerStartedAt: outcome.handlerStartedAt,
    handlerEndedAt: outcome.handlerEndedAt,
    handlerDurationMs: outcome.handlerDurationMs,
  };
}

export function buildUnexpectedFailureDetails(
  input: { envelope: SupportedEnvelope },
  started: ExecutionClockSnapshot,
  failedAt: ExecutionClockSnapshot,
  error: unknown,
): ExecutionFailureDetails {
  return {
    failureReason: error instanceof Error ? error.message : "Nerve Bus child execution failed.",
    integrityDecision: "valid",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "accepted",
    queueDecision: "acquired",
    timeoutDecision: "within_timeout",
    handlerDecision: "threw",
    policyDecision: "allowed",
    status: "failed",
    reviewRequiredReason: null,
    transportDecision: "executed",
    handlerCallId: input.envelope.envelopeId,
    handlerStartedAt: started.iso,
    handlerEndedAt: failedAt.iso,
    handlerDurationMs: Math.max(0, failedAt.monotonicMs - started.monotonicMs),
  };
}

export function buildQueueRejectedFailureDetails(
  input: { envelope: SupportedEnvelope },
  started: ExecutionClockSnapshot,
): ExecutionFailureDetails {
  return {
    failureReason: "Transport queue is saturated.",
    integrityDecision: "valid",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "accepted",
    queueDecision: "queue_rejected",
    timeoutDecision: "not_started",
    handlerDecision: "not_invoked",
    policyDecision: "allowed",
    status: "review_required",
    reviewRequiredReason: "Transport queue rejected the envelope due to backpressure.",
    transportDecision: "queue_rejected",
    handlerCallId: input.envelope.envelopeId,
    handlerStartedAt: started.iso,
    handlerEndedAt: started.iso,
    handlerDurationMs: 0,
  };
}

export function buildDuplicateInFlightFailureDetails(
  input: { envelope: SupportedEnvelope },
  started: ExecutionClockSnapshot,
  failureReason: string,
): ExecutionFailureDetails {
  return {
    failureReason,
    integrityDecision: "valid",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "not_started",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    handlerDecision: "not_invoked",
    policyDecision: "allowed",
    status: "review_required",
    reviewRequiredReason: "Transport replay was rejected because the idempotency key is already in flight.",
    transportDecision: "replay_rejected",
    handlerCallId: input.envelope.envelopeId,
    handlerStartedAt: started.iso,
    handlerEndedAt: started.iso,
    handlerDurationMs: 0,
  };
}

export function buildSemanticGateFailureDetails<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(
  outcome: Exclude<NerveBusChildOutcome<TEnvelope, TResult>, { kind: "handler_failed" }>,
  failureReason: string,
): ExecutionFailureDetails {
  return {
    failureReason,
    integrityDecision: "mismatched_result",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "accepted",
    queueDecision: "acquired",
    timeoutDecision: outcome.timeoutDecision,
    handlerDecision: "invalid_result",
    policyDecision: "allowed",
    status: "failed",
    reviewRequiredReason: null,
    transportDecision: "executed",
    handlerCallId: outcome.handlerCallId,
    handlerStartedAt: outcome.handlerStartedAt,
    handlerEndedAt: outcome.handlerEndedAt,
    handlerDurationMs: outcome.handlerDurationMs,
  };
}

export const finalizeExecutionFailure = async (
  input: { envelope: SupportedEnvelope; context: NerveBusRuntimeContext },
  started: ExecutionClockSnapshot,
  details: ExecutionFailureDetails,
) => finalizeFailure({
  envelope: input.envelope,
  context: input.context,
  startedAt: started.iso,
  startedMs: started.monotonicMs,
  failureReason: details.failureReason,
  integrityDecision: details.integrityDecision,
  idempotencyDecision: details.idempotencyDecision,
  sequenceDecision: details.sequenceDecision,
  queueDecision: details.queueDecision,
  timeoutDecision: details.timeoutDecision,
  handlerDecision: details.handlerDecision,
  policyDecision: details.policyDecision,
  status: details.status,
  reviewRequiredReason: details.reviewRequiredReason,
  handlerCallId: details.handlerCallId,
  handlerStartedAt: details.handlerStartedAt,
  handlerEndedAt: details.handlerEndedAt,
  handlerDurationMs: details.handlerDurationMs,
  circuitBreakerState: "closed",
  ...(details.transportDecision ? { transportDecision: details.transportDecision } : {}),
});
