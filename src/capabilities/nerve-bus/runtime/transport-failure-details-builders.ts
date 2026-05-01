import type { NerveBusRuntimeContext } from "./transport-context.js";
import { finalizeFailure } from "./transport-failure-finalizer.js";
import type { SupportedEnvelope, SupportedResultEnvelope, NerveBusChildDefinition } from "../shared/nerve-bus-channel.js";

export type ExecutionClockSnapshot = {
  iso: string;
  monotonicMs: number;
};

export type NerveBusChildOutcome<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope> = Awaited<ReturnType<NerveBusChildDefinition<TEnvelope, TResult>["execute"]>>;

export type ExecutionFailureDetails = {
  failureReason: string;
  integrityDecision: "valid" | "missing_payload_ref" | "missing_input_ref" | "stale" | "expired" | "out_of_order" | "payload_ref_policy_failed";
  idempotencyDecision: "executed" | "duplicate_skipped" | "replay_rejected";
  sequenceDecision: "accepted" | "out_of_order" | "duplicate" | "not_started";
  queueDecision: "acquired" | "queue_rejected" | "not_started";
  timeoutDecision: "within_timeout" | "timed_out" | "not_started";
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted" | "not_invoked";
  policyDecision: "allowed" | "forbidden_route";
  status: "failed" | "review_required";
  reviewRequiredReason: string | null;
  transportDecision?: "executed" | "duplicate_skipped" | "replay_rejected" | "queue_rejected";
  handlerCallId: string;
  handlerStartedAt: string;
  handlerEndedAt: string;
  handlerDurationMs: number;
};

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
    idempotencyDecision: "executed",
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
    idempotencyDecision: "executed",
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
    idempotencyDecision: "executed",
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
