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
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";

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

export async function buildGovernedFailureResult(input: {
  envelope: SupportedEnvelope;
  failureReason: string;
  reviewRequiredReason?: string | null;
  status?: "failed" | "review_required";
  proof: NerveBusTransportProof;
  outputPayloadRef: { outputRef: string; payloadRefs: string[] };
}) {
  const status = input.status ?? "failed";
  const common = {
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
    payloadRef: input.outputPayloadRef.payloadRefs,
    payload: input.envelope.payload,
    createdAt: input.proof.endedAt,
    expiresAt: input.envelope.expiresAt,
    outputRef: input.outputPayloadRef.outputRef,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    status,
  } as const;

  if (input.envelope.envelopeKind === "ability_command") {
    const resultEnvelope = AbilityResultEnvelopeSchema.parse({
      ...common,
      envelopeKind: "ability_result",
      channelId: "ability-to-orchestration",
      envelopeId: `${input.envelope.envelopeId}:result`,
      resultId: `${input.envelope.commandId}:result`,
      from: input.envelope.to,
      to: "orchestration",
    });
    return AbilityTransportResultSchema.parse({
      abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
      channelId: input.envelope.channelId,
      status,
      transportDecision: "executed",
      commandEnvelope: input.envelope,
      resultEnvelope,
      proof: input.proof,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason ?? null,
    });
  }

  if (input.envelope.envelopeKind === "ai_request") {
    const responseEnvelope = AiResponseEnvelopeSchema.parse({
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
    return AiTransportResultSchema.parse({
      abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
      channelId: input.envelope.channelId,
      status,
      transportDecision: "executed",
      requestEnvelope: input.envelope,
      responseEnvelope,
      proof: input.proof,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason ?? null,
    });
  }

  const resultEnvelope = HumanCommandResultEnvelopeSchema.parse({
    ...common,
    envelopeKind: "human_command_result",
    channelId: "orchestration-to-commander",
    envelopeId: `${input.envelope.envelopeId}:result`,
    resultId: `${input.envelope.commandId}:result`,
    from: "orchestration",
    to: "commander-console",
  });
  return HumanCommandTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status,
    transportDecision: "executed",
    commandEnvelope: input.envelope,
    resultEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  });
}

export { buildFailurePayloadDocument };
