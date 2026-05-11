import { createId } from "../../../lib/local-runtime/ids.js";

import { NERVE_BUS_ABILITY_GROUP_ID, NerveBusTransportProofSchema } from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";

const isForwardEnvelope = (envelope: SupportedEnvelope): envelope is Extract<SupportedEnvelope, {
  envelopeKind: "ability_command" | "ai_request" | "human_command";
}> => (
  envelope.envelopeKind === "ability_command"
  || envelope.envelopeKind === "ai_request"
  || envelope.envelopeKind === "human_command"
);

const resolveProofId = (input: { envelope: SupportedEnvelope; resultEnvelope: SupportedResultEnvelope }): string => {
  if (isForwardEnvelope(input.envelope)) {
    return input.resultEnvelope.proofRef;
  }

  return createId("nerve_bus_proof");
};

const resolveTargetAbilityGroupId = (input: { envelope: SupportedEnvelope; resultEnvelope: SupportedResultEnvelope }) => {
  if ("targetAbilityGroupId" in input.envelope) {
    return input.envelope.targetAbilityGroupId;
  }

  if ("targetAbilityGroupId" in input.resultEnvelope) {
    return input.resultEnvelope.targetAbilityGroupId;
  }

  return null;
};

const resolveTargetChildCapabilityId = (input: { envelope: SupportedEnvelope; resultEnvelope: SupportedResultEnvelope }) => {
  if ("targetChildCapabilityId" in input.envelope) {
    return input.envelope.targetChildCapabilityId;
  }

  if ("targetChildCapabilityId" in input.resultEnvelope) {
    return input.resultEnvelope.targetChildCapabilityId;
  }

  return null;
};

const resolvePromptContractId = (envelope: SupportedEnvelope) => {
  return envelope.envelopeKind === "ai_request" ? envelope.promptContractId : null;
};

const resolvePromptContractVersion = (envelope: SupportedEnvelope) => {
  return envelope.envelopeKind === "ai_request" ? envelope.promptContractVersion : null;
};

const resolveOutputSchemaRef = (envelope: SupportedEnvelope) => {
  if (envelope.envelopeKind === "ai_request") {
    return envelope.outputSchemaRef;
  }

  if (envelope.envelopeKind === "ability_command") {
    return envelope.expectedOutputSchemaRef;
  }

  return null;
};

type BuildTransportProofInput = {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  policyDecision: "allowed" | "forbidden_route";
  integrityDecision: "valid" | "invalid_schema" | "missing_payload_ref" | "missing_input_ref" | "stale" | "expired" | "out_of_order" | "mismatched_result" | "payload_ref_policy_failed";
  idempotencyDecision: "executed" | "duplicate_skipped" | "replay_rejected";
  sequenceDecision: "accepted" | "out_of_order" | "duplicate" | "not_started";
  queueDecision: "acquired" | "queue_rejected" | "not_started";
  timeoutDecision: "within_timeout" | "timed_out" | "not_started";
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted" | "not_invoked";
  handlerCallId: string;
  handlerStartedAt: string;
  handlerEndedAt: string;
  handlerDurationMs: number;
  circuitBreakerState: "closed";
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  semanticDecision: "passed" | "failed" | "not_started";
  dataQualityFlags: string[];
};

const buildProofIdentityFields = (input: BuildTransportProofInput) => ({
  proofId: resolveProofId(input),
  abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
  channelId: input.envelope.channelId,
  envelopeKind: input.envelope.envelopeKind,
  envelopeId: input.envelope.envelopeId,
  nerveBusEnvelopeId: input.envelope.nerveBusEnvelopeId,
  correlationEnvelopeId: input.resultEnvelope.correlationEnvelopeId,
});

const buildProofTraceFields = (envelope: SupportedEnvelope) => ({
  transportId: envelope.transportId,
  traceId: envelope.traceId,
  spanId: envelope.spanId,
  attemptId: envelope.attemptId,
  missionId: envelope.missionId,
  runId: envelope.runId,
  sessionId: envelope.sessionId,
  roundId: envelope.roundId,
  videoVisitId: envelope.videoVisitId,
});

const buildProofExecutionChainFields = (envelope: SupportedEnvelope) => ({
  stepId: envelope.stepId,
  bindingPackageId: envelope.bindingPackageId,
  bindingPackageVersion: envelope.bindingPackageVersion,
  selectedBindingId: envelope.selectedBindingId,
  bindingVersion: envelope.bindingVersion,
  bindingActivationRef: envelope.bindingActivationRef,
  bindingSnapshotRef: envelope.bindingSnapshotRef,
  capabilityCallId: envelope.capabilityCallId,
  sourceRef: envelope.sourceRef,
  inputRef: envelope.inputRef,
  payloadRef: envelope.payloadRef,
  from: envelope.from,
  to: envelope.to,
  idempotencyKey: envelope.idempotencyKey,
  sequenceNo: envelope.sequenceNo,
});

const buildProofTargetFields = (input: BuildTransportProofInput) => ({
  outputRef: input.outputRef,
  diagnosticPayloadRef: input.diagnosticPayloadRef,
  targetAbilityGroupId: resolveTargetAbilityGroupId(input),
  targetChildCapabilityId: resolveTargetChildCapabilityId(input),
  promptContractId: resolvePromptContractId(input.envelope),
  promptContractVersion: resolvePromptContractVersion(input.envelope),
  outputSchemaRef: resolveOutputSchemaRef(input.envelope),
});

const buildProofTimingFields = (input: BuildTransportProofInput) => ({
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: Math.max(0, Math.trunc(input.durationMs)),
  handlerCallId: input.handlerCallId,
  handlerStartedAt: input.handlerStartedAt,
  handlerEndedAt: input.handlerEndedAt,
  handlerDurationMs: Math.max(0, Math.trunc(input.handlerDurationMs)),
  circuitBreakerState: input.circuitBreakerState,
});

const buildProofDecisionFields = (input: BuildTransportProofInput) => ({
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  policyDecision: input.policyDecision,
  integrityDecision: input.integrityDecision,
  idempotencyDecision: input.idempotencyDecision,
  sequenceDecision: input.sequenceDecision,
  queueDecision: input.queueDecision,
  timeoutDecision: input.timeoutDecision,
  handlerDecision: input.handlerDecision,
  semanticDecision: input.semanticDecision,
  dataQualityFlags: input.dataQualityFlags,
});

export function buildTransportProof(input: BuildTransportProofInput): NerveBusTransportProof {
  return NerveBusTransportProofSchema.parse({
    ...buildProofIdentityFields(input),
    ...buildProofTraceFields(input.envelope),
    ...buildProofExecutionChainFields(input.envelope),
    ...buildProofTargetFields(input),
    ...buildProofTimingFields(input),
    ...buildProofDecisionFields(input),
  });
}
