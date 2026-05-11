import {
  AbilityResultEnvelopeSchema,
  AiResponseEnvelopeSchema,
  HumanCommandResultEnvelopeSchema,
  NERVE_BUS_ABILITY_GROUP_ID,
  NerveBusPayloadDocumentSchema,
} from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { AbilityCommandEnvelope, AiRequestEnvelope, HumanCommandEnvelope } from "../shared/nerve-bus-envelope.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";

type GovernedFailureStatus = "failed" | "review_required";

type GovernedFailureEnvelopeInput = {
  envelope: SupportedEnvelope;
  failureReason: string;
  reviewRequiredReason?: string | null;
  status?: GovernedFailureStatus;
  proofRef: string;
  createdAt: string;
  diagnosticPayloadRef: { outputRef: string; payloadRefs: string[] };
};

const isForwardEnvelope = (envelope: SupportedEnvelope): envelope is AbilityCommandEnvelope | AiRequestEnvelope | HumanCommandEnvelope => (
  envelope.envelopeKind === "ability_command"
  || envelope.envelopeKind === "ai_request"
  || envelope.envelopeKind === "human_command"
);

export const buildProofRefForEnvelope = (envelope: SupportedEnvelope): string => {
  if (envelope.envelopeKind === "ai_request") {
    return `${envelope.envelopeId}:response:proof`;
  }

  if (envelope.envelopeKind === "ability_command" || envelope.envelopeKind === "human_command") {
    return `${envelope.envelopeId}:result:proof`;
  }

  return `${envelope.envelopeId}:dispatch:proof`;
};

export function buildFailurePayloadDocument(input: {
  envelope: SupportedEnvelope;
  failureReason: string;
}): NerveBusPayloadDocument {
  return NerveBusPayloadDocumentSchema.parse({
    documentType: "transport_failure",
    documentRef: `${input.envelope.channelId}:${input.envelope.envelopeId}:failure`,
    summary: input.failureReason,
    entityRefs: [input.envelope.missionId, input.envelope.mapId, input.envelope.stepId],
    evidenceRefs: [],
    contentBlocks: [
      { key: "failureReason", value: input.failureReason },
      { key: "channelId", value: input.envelope.channelId },
    ],
  });
}

const buildFailurePayloadMetadata = (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => ({
  summary: input.failureReason,
  entityRefs: input.diagnosticPayloadRef.payloadRefs,
  evidenceRefs: input.diagnosticPayloadRef.payloadRefs,
  tags: [input.envelope.channelId, status],
  attributes: [],
});

const buildTraceableDiagnosticPayloadRefs = (input: GovernedFailureEnvelopeInput) => {
  const refs = [input.diagnosticPayloadRef.outputRef, ...input.diagnosticPayloadRef.payloadRefs];
  return [...new Set(refs.filter((value) => typeof value === "string" && value.length > 0))];
};

const buildTransportChainFields = (input: GovernedFailureEnvelopeInput, channelId: SupportedResultEnvelope["channelId"]) => ({
  abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
  channelId,
  transportId: input.envelope.transportId,
  traceId: input.envelope.traceId,
  spanId: `${input.envelope.stepId}:${channelId}`,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  runId: input.envelope.runId,
  sessionId: input.envelope.sessionId,
  roundId: input.envelope.roundId,
  videoVisitId: input.envelope.videoVisitId,
  mapId: input.envelope.mapId,
  bindingPackageId: input.envelope.bindingPackageId,
  bindingPackageVersion: input.envelope.bindingPackageVersion,
  selectedBindingId: input.envelope.selectedBindingId,
  bindingVersion: input.envelope.bindingVersion,
});

const buildExecutionChainFields = (input: GovernedFailureEnvelopeInput) => ({
  bindingActivationRef: input.envelope.bindingActivationRef,
  bindingSnapshotRef: input.envelope.bindingSnapshotRef,
  stepId: input.envelope.stepId,
  capabilityCallId: input.envelope.capabilityCallId,
  sourceRef: input.envelope.sourceRef,
  idempotencyKey: input.envelope.idempotencyKey,
  sequenceNo: input.envelope.sequenceNo,
  inputRef: input.envelope.inputRef,
  payloadRef: buildTraceableDiagnosticPayloadRefs(input),
  payload: buildFailurePayloadMetadata(input, input.status ?? "failed"),
  createdAt: input.createdAt,
  expiresAt: input.envelope.expiresAt,
});

const buildCorrelationFields = (input: GovernedFailureEnvelopeInput) => ({
  correlationEnvelopeId: isForwardEnvelope(input.envelope)
    ? input.envelope.envelopeId
    : input.envelope.correlationEnvelopeId,
  correlationCapabilityCallId: isForwardEnvelope(input.envelope)
    ? input.envelope.capabilityCallId
    : input.envelope.correlationCapabilityCallId,
  correlationInputRef: isForwardEnvelope(input.envelope)
    ? input.envelope.inputRef
    : input.envelope.correlationInputRef,
});

const buildFailureOutcomeFields = (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => ({
  status,
  outputRef: null,
  diagnosticPayloadRef: input.diagnosticPayloadRef.outputRef,
  proofRef: input.proofRef,
  failureReason: status === "failed" ? input.failureReason : null,
  reviewRequiredReason: status === "review_required" ? input.reviewRequiredReason ?? input.failureReason : null,
});

const buildGovernedFailureCommon = (
  input: GovernedFailureEnvelopeInput,
  channelId: SupportedResultEnvelope["channelId"],
  status: GovernedFailureStatus,
) => ({
  ...buildTransportChainFields(input, channelId),
  ...buildExecutionChainFields({ ...input, status }),
  ...buildCorrelationFields(input),
  ...buildFailureOutcomeFields(input, status),
});

const buildAbilityFailureEnvelope = (
  input: GovernedFailureEnvelopeInput & { envelope: AbilityCommandEnvelope },
  status: GovernedFailureStatus,
) => AbilityResultEnvelopeSchema.parse({
  ...buildGovernedFailureCommon(input, "ability-to-orchestration", status),
  envelopeKind: "ability_result",
  envelopeId: `${input.envelope.envelopeId}:result`,
  nerveBusEnvelopeId: `${input.envelope.envelopeId}:result`,
  resultId: `${input.envelope.commandId}:result`,
  from: input.envelope.targetAbilityGroupId,
  to: "orchestration",
  targetAbilityGroupId: input.envelope.targetAbilityGroupId,
  targetChildCapabilityId: input.envelope.targetChildCapabilityId,
});

const buildMirroredAbilityFailureEnvelope = (
  input: GovernedFailureEnvelopeInput & { envelope: Extract<SupportedEnvelope, { envelopeKind: "ability_result" }> },
  status: GovernedFailureStatus,
) => AbilityResultEnvelopeSchema.parse({
  ...buildGovernedFailureCommon(input, "ability-to-orchestration", status),
  envelopeKind: "ability_result",
  envelopeId: input.envelope.envelopeId,
  nerveBusEnvelopeId: input.envelope.nerveBusEnvelopeId,
  resultId: input.envelope.resultId,
  from: input.envelope.from,
  to: input.envelope.to,
  targetAbilityGroupId: input.envelope.targetAbilityGroupId,
  targetChildCapabilityId: input.envelope.targetChildCapabilityId,
});

const buildAiFailureEnvelope = (
  input: GovernedFailureEnvelopeInput & { envelope: AiRequestEnvelope },
  status: GovernedFailureStatus,
) => AiResponseEnvelopeSchema.parse({
  ...buildGovernedFailureCommon(input, "ai-to-orchestration", status),
  envelopeKind: "ai_response",
  envelopeId: `${input.envelope.envelopeId}:response`,
  nerveBusEnvelopeId: `${input.envelope.envelopeId}:response`,
  responseId: `${input.envelope.requestId}:response`,
  from: "ai",
  to: "orchestration",
  decision: "transport_failed",
  confidence: null,
});

const buildMirroredAiFailureEnvelope = (
  input: GovernedFailureEnvelopeInput & { envelope: Extract<SupportedEnvelope, { envelopeKind: "ai_response" }> },
  status: GovernedFailureStatus,
) => AiResponseEnvelopeSchema.parse({
  ...buildGovernedFailureCommon(input, "ai-to-orchestration", status),
  envelopeKind: "ai_response",
  envelopeId: input.envelope.envelopeId,
  nerveBusEnvelopeId: input.envelope.nerveBusEnvelopeId,
  responseId: input.envelope.responseId,
  from: input.envelope.from,
  to: input.envelope.to,
  decision: input.envelope.decision,
  confidence: input.envelope.confidence,
});

const buildHumanFailureEnvelope = (
  input: GovernedFailureEnvelopeInput & { envelope: HumanCommandEnvelope },
  status: GovernedFailureStatus,
) => HumanCommandResultEnvelopeSchema.parse({
  ...buildGovernedFailureCommon(input, "orchestration-to-commander", status),
  envelopeKind: "human_command_result",
  envelopeId: `${input.envelope.envelopeId}:result`,
  nerveBusEnvelopeId: `${input.envelope.envelopeId}:result`,
  resultId: `${input.envelope.commandId}:result`,
  from: "orchestration",
  to: "commander-console",
});

const buildMirroredHumanFailureEnvelope = (
  input: GovernedFailureEnvelopeInput & { envelope: Extract<SupportedEnvelope, { envelopeKind: "human_command_result" }> },
  status: GovernedFailureStatus,
) => HumanCommandResultEnvelopeSchema.parse({
  ...buildGovernedFailureCommon(input, "orchestration-to-commander", status),
  envelopeKind: "human_command_result",
  envelopeId: input.envelope.envelopeId,
  nerveBusEnvelopeId: input.envelope.nerveBusEnvelopeId,
  resultId: input.envelope.resultId,
  from: input.envelope.from,
  to: input.envelope.to,
});

const FAILURE_ENVELOPE_BUILDERS = {
  ability_command: (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => buildAbilityFailureEnvelope({ ...input, envelope: input.envelope as AbilityCommandEnvelope }, status),
  ai_request: (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => buildAiFailureEnvelope({ ...input, envelope: input.envelope as AiRequestEnvelope }, status),
  human_command: (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => buildHumanFailureEnvelope({ ...input, envelope: input.envelope as HumanCommandEnvelope }, status),
  ability_result: (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => buildMirroredAbilityFailureEnvelope({ ...input, envelope: input.envelope as Extract<SupportedEnvelope, { envelopeKind: "ability_result" }> }, status),
  ai_response: (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => buildMirroredAiFailureEnvelope({ ...input, envelope: input.envelope as Extract<SupportedEnvelope, { envelopeKind: "ai_response" }> }, status),
  human_command_result: (input: GovernedFailureEnvelopeInput, status: GovernedFailureStatus) => buildMirroredHumanFailureEnvelope({ ...input, envelope: input.envelope as Extract<SupportedEnvelope, { envelopeKind: "human_command_result" }> }, status),
} as const;

export function buildGovernedFailureEnvelope(input: GovernedFailureEnvelopeInput): SupportedResultEnvelope {
  const status = input.status ?? "failed";
  return FAILURE_ENVELOPE_BUILDERS[input.envelope.envelopeKind](input, status);
}