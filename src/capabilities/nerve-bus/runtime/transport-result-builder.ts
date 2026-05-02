import { createId } from "../../../lib/local-runtime/ids.js";

import {
  AbilityResultEnvelopeSchema,
  AbilityTransportResultSchema,
  AiResponseEnvelopeSchema,
  AiTransportResultSchema,
  HumanCommandResultEnvelopeSchema,
  HumanCommandTransportResultSchema,
  NERVE_BUS_ABILITY_GROUP_ID,
  NerveBusPayloadDocumentSchema,
} from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { AbilityCommandEnvelope, AiRequestEnvelope, HumanCommandEnvelope } from "../shared/nerve-bus-envelope.js";
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";

type GovernedFailureInput = {
  envelope: SupportedEnvelope;
  failureReason: string;
  reviewRequiredReason?: string | null;
  status?: "failed" | "review_required";
  proof: NerveBusTransportProof;
  diagnosticPayloadRef: { outputRef: string; payloadRefs: string[] };
  transportDecision?: "executed" | "duplicate_skipped" | "replay_rejected" | "queue_rejected";
};

function buildFailurePayloadDocument(input: {
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

const buildGovernedFailureCommon = (input: GovernedFailureInput, status: "failed" | "review_required") => ({
  abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
  transportId: input.envelope.transportId,
  traceId: input.envelope.traceId,
  spanId: input.envelope.spanId,
  attemptId: input.envelope.attemptId,
  missionId: input.envelope.missionId,
  mapId: input.envelope.mapId,
  stepId: input.envelope.stepId,
  idempotencyKey: input.envelope.idempotencyKey,
  sequenceNo: input.envelope.sequenceNo,
  inputRef: input.envelope.inputRef,
  payloadRef: input.diagnosticPayloadRef.payloadRefs,
  payload: input.envelope.payload,
  createdAt: input.proof.endedAt,
  expiresAt: input.envelope.expiresAt,
  outputRef: null,
  diagnosticPayloadRef: input.diagnosticPayloadRef.outputRef,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  status,
} as const);

const buildAbilityFailureEnvelope = (input: GovernedFailureInput & { envelope: AbilityCommandEnvelope }, common: ReturnType<typeof buildGovernedFailureCommon>) => {
  return AbilityResultEnvelopeSchema.parse({
    ...common,
    envelopeKind: "ability_result",
    channelId: "ability-to-orchestration",
    envelopeId: `${input.envelope.envelopeId}:result`,
    resultId: `${input.envelope.commandId}:result`,
    from: input.envelope.to,
    to: "orchestration",
  });
};

const buildAbilityFailureResult = (input: GovernedFailureInput & { envelope: AbilityCommandEnvelope }, resultEnvelope: ReturnType<typeof buildAbilityFailureEnvelope>) => {
  return AbilityTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: resultEnvelope.status,
    transportDecision: input.transportDecision ?? "executed",
    commandEnvelope: input.envelope,
    resultEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  });
};

const buildAiFailureEnvelope = (input: GovernedFailureInput & { envelope: AiRequestEnvelope }, common: ReturnType<typeof buildGovernedFailureCommon>) => {
  return AiResponseEnvelopeSchema.parse({
    ...common,
    envelopeKind: "ai_response",
    channelId: "ai-to-orchestration",
    envelopeId: `${input.envelope.envelopeId}:response`,
    responseId: `${input.envelope.requestId}:response`,
    from: "ai",
    to: "orchestration",
    decision: "transport_failed",
    confidence: null,
  });
};

const buildAiFailureResult = (input: GovernedFailureInput & { envelope: AiRequestEnvelope }, responseEnvelope: ReturnType<typeof buildAiFailureEnvelope>) => {
  return AiTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: responseEnvelope.status,
    transportDecision: input.transportDecision ?? "executed",
    requestEnvelope: input.envelope,
    responseEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  });
};

const buildHumanFailureEnvelope = (input: GovernedFailureInput & { envelope: HumanCommandEnvelope }, common: ReturnType<typeof buildGovernedFailureCommon>) => {
  return HumanCommandResultEnvelopeSchema.parse({
    ...common,
    envelopeKind: "human_command_result",
    channelId: "orchestration-to-commander",
    envelopeId: `${input.envelope.envelopeId}:result`,
    resultId: `${input.envelope.commandId}:result`,
    from: "orchestration",
    to: "commander-console",
  });
};

const buildHumanFailureResult = (input: GovernedFailureInput & { envelope: HumanCommandEnvelope }, resultEnvelope: ReturnType<typeof buildHumanFailureEnvelope>) => {
  return HumanCommandTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: resultEnvelope.status,
    transportDecision: input.transportDecision ?? "executed",
    commandEnvelope: input.envelope,
    resultEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  });
};

export function buildGovernedFailureEnvelope(input: GovernedFailureInput): SupportedResultEnvelope {
  const status = input.status ?? "failed";
  const common = buildGovernedFailureCommon(input, status);

  if (input.envelope.envelopeKind === "ability_command") {
    return buildAbilityFailureEnvelope({ ...input, envelope: input.envelope }, common);
  }

  if (input.envelope.envelopeKind === "ai_request") {
    return buildAiFailureEnvelope({ ...input, envelope: input.envelope }, common);
  }

  return buildHumanFailureEnvelope({ ...input, envelope: input.envelope }, common);
}

export async function buildGovernedFailureResult(input: GovernedFailureInput) {
  const resultEnvelope = buildGovernedFailureEnvelope(input);

  if (input.envelope.envelopeKind === "ability_command") {
    return buildAbilityFailureResult({ ...input, envelope: input.envelope }, resultEnvelope as ReturnType<typeof buildAbilityFailureEnvelope>);
  }

  if (input.envelope.envelopeKind === "ai_request") {
    return buildAiFailureResult({ ...input, envelope: input.envelope }, resultEnvelope as ReturnType<typeof buildAiFailureEnvelope>);
  }

  return buildHumanFailureResult({ ...input, envelope: input.envelope }, resultEnvelope as ReturnType<typeof buildHumanFailureEnvelope>);
}

export { buildFailurePayloadDocument };
