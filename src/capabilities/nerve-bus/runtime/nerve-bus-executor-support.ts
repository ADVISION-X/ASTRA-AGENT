import { buildTransportProof } from "./transport-proof-builder.js";
import { buildSuccessTransportResult } from "./transport-success-result.js";
import { buildGuardFailureDetails, type ExecutionClockSnapshot, type ExecutionFailureDetails } from "./transport-failure-details-builders.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

const buildFailureCheckpointProof = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot, details: ExecutionFailureDetails) => {
  const ended = input.context.clock.now();
  return buildTransportProof({
    envelope: input.envelope,
    resultEnvelope: {
      ...input.envelope,
      envelopeKind: input.envelope.envelopeKind,
      status: details.status,
      failureReason: details.failureReason,
      reviewRequiredReason: details.reviewRequiredReason,
      outputRef: null,
      diagnosticPayloadRef: input.envelope.inputRef,
    } as never,
    startedAt: started.iso,
    endedAt: ended.iso,
    durationMs: ended.monotonicMs - started.monotonicMs,
    policyDecision: details.policyDecision,
    integrityDecision: details.integrityDecision,
    idempotencyDecision: details.idempotencyDecision,
    sequenceDecision: details.sequenceDecision,
    queueDecision: details.queueDecision,
    timeoutDecision: details.timeoutDecision,
    handlerDecision: details.handlerDecision,
    handlerCallId: details.handlerCallId,
    handlerStartedAt: details.handlerStartedAt,
    handlerEndedAt: details.handlerEndedAt,
    handlerDurationMs: details.handlerDurationMs,
    circuitBreakerState: "closed",
    outputRef: null,
    diagnosticPayloadRef: input.envelope.inputRef,
    status: details.status,
    failureReason: details.failureReason,
    reviewRequiredReason: details.reviewRequiredReason,
    dataQualityFlags: ["transport_governed_failure"],
  });
};

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
    dataQualityFlags: input.outcome.handlerDecision === "executed" ? [] : ["transport_handler_degraded"],
  });
};

const buildSuccessfulTransportResult = (input: Parameters<typeof buildSuccessTransportResult>[0]) => {
  return buildSuccessTransportResult(input);
};

const createFailureCheckpointDiagnosticPayloadRef = <TEnvelope extends SupportedEnvelope>(envelope: TEnvelope) => ({
  outputRef: envelope.inputRef,
  payloadRefs: envelope.payloadRef,
});

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
    idempotencyDecision: "executed",
    sequenceDecision: "not_started",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "allowed",
    status: "failed",
  });
};

const buildSequenceGateFailureDetails = <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
}, started: ExecutionClockSnapshot, sequenceGate: { reason: string; integrityDecision: "out_of_order" }) => {
  return buildGuardFailureDetails(input, started, {
    failureReason: sequenceGate.reason,
    integrityDecision: "valid",
    idempotencyDecision: "executed",
    sequenceDecision: sequenceGate.integrityDecision === "out_of_order" ? "out_of_order" : "duplicate",
    queueDecision: "not_started",
    timeoutDecision: "not_started",
    policyDecision: "allowed",
    status: "failed",
  });
};

export const nerveBusExecutorSupport = {
  buildFailureCheckpointProof,
  buildSuccessfulExecutionProof,
  buildSuccessfulTransportResult,
  createFailureCheckpointDiagnosticPayloadRef,
  buildInputGateFailureDetails,
  buildPolicyGateFailureDetails,
  buildIntegrityGateFailureDetails,
  buildTimeoutGateFailureDetails,
  buildSequenceGateFailureDetails,
};