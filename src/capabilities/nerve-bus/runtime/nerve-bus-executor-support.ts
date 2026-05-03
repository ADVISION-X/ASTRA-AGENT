import { buildTransportProof } from "./transport-proof-builder.js";
import { buildSuccessTransportResult } from "./transport-success-result.js";
import { buildGuardFailureDetails } from "./transport-failure-details-builders.js";
import type { ExecutionClockSnapshot, ExecutionFailureDetails } from "./transport-failure-types.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

const buildSuccessfulExecutionProof = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  resultEnvelope: TResult;
  outputRef: string | null;
  context: NerveBusRuntimeContext;
  outcome: {
    timeoutDecision: "within_timeout" | "timed_out";
    handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted";
    handlerCallId: string;
    handlerStartedAt: string;
    handlerEndedAt: string;
    handlerDurationMs: number;
    circuitBreakerState: "closed";
    failureReason: string | null;
    reviewRequiredReason: string | null;
  };
}, started: ExecutionClockSnapshot) => {
  const ended = input.context.clock.now();
  return buildTransportProof({
    envelope: input.envelope,
    resultEnvelope: input.resultEnvelope,
    startedAt: started.iso,
    endedAt: ended.iso,
    durationMs: ended.monotonicMs - started.monotonicMs,
    policyDecision: "allowed",
    integrityDecision: "valid",
    idempotencyDecision: "executed",
    sequenceDecision: "accepted",
    queueDecision: "acquired",
    timeoutDecision: input.outcome.timeoutDecision,
    handlerDecision: input.outcome.handlerDecision,
    handlerCallId: input.outcome.handlerCallId,
    handlerStartedAt: input.outcome.handlerStartedAt,
    handlerEndedAt: input.outcome.handlerEndedAt,
    handlerDurationMs: input.outcome.handlerDurationMs,
    circuitBreakerState: input.outcome.circuitBreakerState,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.resultEnvelope.diagnosticPayloadRef,
    status: input.resultEnvelope.status,
    failureReason: input.outcome.failureReason,
    reviewRequiredReason: input.outcome.reviewRequiredReason,
    semanticDecision: "passed",
    dataQualityFlags: input.outcome.handlerDecision === "executed" ? [] : ["transport_handler_degraded"],
  });
};

const buildSuccessfulTransportResult = (input: Parameters<typeof buildSuccessTransportResult>[0]) => {
  return buildSuccessTransportResult(input);
};

const buildInputGateFailureDetails = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot, inputGate: { reason: string; integrityDecision: "missing_payload_ref" | "missing_input_ref" }) => {
  return buildGuardFailureDetails(input, started, {
    failureReason: inputGate.reason,
    integrityDecision: inputGate.integrityDecision,
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "not_started",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "allowed",
    status: "failed",
  });
};

const buildPolicyGateFailureDetails = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot, policyGate: { reason: string }) => {
  return buildGuardFailureDetails(input, started, {
    failureReason: policyGate.reason,
    integrityDecision: "valid",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "not_started",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "forbidden_route",
    status: "failed",
  });
};

const buildIntegrityGateFailureDetails = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot, integrityGate: {
  reason: string;
  integrityDecision: "stale" | "expired" | "payload_ref_policy_failed";
}) => {
  return buildGuardFailureDetails(input, started, {
    failureReason: integrityGate.reason,
    integrityDecision: integrityGate.integrityDecision,
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "not_started",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "allowed",
    status: "failed",
  });
};

const buildTimeoutGateFailureDetails = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot, timeoutGate: { reason: string }) => {
  return buildGuardFailureDetails(input, started, {
    failureReason: timeoutGate.reason,
    integrityDecision: "valid",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: "not_started",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "allowed",
    status: "failed",
  });
};

const buildSequenceGateFailureDetails = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot, sequenceGate: { reason: string; sequenceDecision: "duplicate" | "out_of_order" }) => {
  return buildGuardFailureDetails(input, started, {
    failureReason: sequenceGate.reason,
    integrityDecision: "out_of_order",
    idempotencyDecision: "replay_rejected",
    sequenceDecision: sequenceGate.sequenceDecision,
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "allowed",
    status: "failed",
  });
};

export const nerveBusExecutorSupport = {
  buildSuccessfulExecutionProof,
  buildSuccessfulTransportResult,
  buildInputGateFailureDetails,
  buildPolicyGateFailureDetails,
  buildIntegrityGateFailureDetails,
  buildTimeoutGateFailureDetails,
  buildSequenceGateFailureDetails,
};