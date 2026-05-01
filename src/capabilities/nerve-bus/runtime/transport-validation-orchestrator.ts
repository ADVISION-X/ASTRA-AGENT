import { enforceChannelPolicyGate } from "./channel-policy-gate.js";
import { enforceEnvelopeInputGate } from "./envelope-input-gate.js";
import { enforceEnvelopeIntegrityGate } from "./envelope-integrity-gate.js";
import { enforceTransportSequencePolicy } from "./transport-sequence-policy.js";
import { resolveTransportTimeoutGate } from "./transport-timeout-gate.js";
import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import type { NerveBusRuntimeContext } from "./transport-context.js";
import { buildGuardFailureDetails, type ExecutionClockSnapshot, type ExecutionFailureDetails } from "./transport-failure-details-builders.js";

export const runInitialValidationGates = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot): Promise<ExecutionFailureDetails | null> => {
  const inputGate = enforceEnvelopeInputGate({ envelope: input.envelope, registryEntry: input.registryEntry });
  if (!inputGate.ok) {
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
  }

  const policyGate = enforceChannelPolicyGate({ envelope: input.envelope, registryEntry: input.registryEntry });
  if (!policyGate.ok) {
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
  }

  const integrityGate = enforceEnvelopeIntegrityGate({
    envelope: input.envelope,
    registryEntry: input.registryEntry,
    clock: input.context.clock,
  });
  if (!integrityGate.ok) {
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
  }

  return null;
};

export const runPostIdempotencyValidationGates = async <TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  child: NerveBusChildDefinition<TEnvelope, TResult>;
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  context: NerveBusRuntimeContext;
}, started: ExecutionClockSnapshot): Promise<ExecutionFailureDetails | null> => {
  const timeoutGate = resolveTransportTimeoutGate(input.registryEntry.maxDurationMs);
  if (!timeoutGate.ok) {
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
  }

  const sequenceGate = enforceTransportSequencePolicy({
    missionId: input.envelope.missionId,
    mapId: input.envelope.mapId,
    stepId: input.envelope.stepId,
    channelId: input.envelope.channelId,
    sequenceNo: input.envelope.sequenceNo,
  });
  if (!sequenceGate.ok) {
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
  }

  return null;
};
