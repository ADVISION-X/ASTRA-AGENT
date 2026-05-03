import {
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  HumanCommandTransportResultSchema,
  NERVE_BUS_ABILITY_GROUP_ID,
  NerveBusMirroredTransportResultSchema,
} from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";

type SuccessTransportResultInput = {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  proof: NerveBusTransportProof;
};

type AbilityCommandEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ability_command" }>;
type AiRequestEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ai_request" }>;
type HumanCommandEnvelope = Extract<SupportedEnvelope, { envelopeKind: "human_command" }>;
type MirroredEnvelope = Exclude<SupportedEnvelope, AbilityCommandEnvelope | AiRequestEnvelope | HumanCommandEnvelope>;

type AbilityResultEnvelope = Extract<SupportedResultEnvelope, { envelopeKind: "ability_result" }>;
type AiResponseEnvelope = Extract<SupportedResultEnvelope, { envelopeKind: "ai_response" }>;
type HumanCommandResultEnvelope = Extract<SupportedResultEnvelope, { envelopeKind: "human_command_result" }>;

function buildTransportCommon(input: SuccessTransportResultInput) {
  return {
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    status: input.resultEnvelope.status,
    transportDecision: "executed" as const,
    proof: input.proof,
    failureReason: input.resultEnvelope.failureReason,
    reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
  };
}

function buildAbilityTransportResult(input: {
  envelope: AbilityCommandEnvelope;
  resultEnvelope: AbilityResultEnvelope;
  proof: NerveBusTransportProof;
}) {
  return AbilityTransportResultSchema.parse({
    ...buildTransportCommon(input),
    channelId: input.envelope.channelId,
    commandEnvelope: input.envelope,
    resultEnvelope: input.resultEnvelope,
  });
}

function buildAiTransportResult(input: {
  envelope: AiRequestEnvelope;
  resultEnvelope: AiResponseEnvelope;
  proof: NerveBusTransportProof;
}) {
  return AiTransportResultSchema.parse({
    ...buildTransportCommon(input),
    channelId: input.envelope.channelId,
    requestEnvelope: input.envelope,
    responseEnvelope: input.resultEnvelope,
  });
}

function buildHumanCommandTransportResult(input: {
  envelope: HumanCommandEnvelope;
  resultEnvelope: HumanCommandResultEnvelope;
  proof: NerveBusTransportProof;
}) {
  return HumanCommandTransportResultSchema.parse({
    ...buildTransportCommon(input),
    channelId: input.envelope.channelId,
    commandEnvelope: input.envelope,
    resultEnvelope: input.resultEnvelope,
  });
}

function buildMirroredTransportResult(input: {
  envelope: MirroredEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  proof: NerveBusTransportProof;
}) {
  return NerveBusMirroredTransportResultSchema.parse({
    ...buildTransportCommon(input),
    channelId: input.envelope.channelId,
    transportedEnvelope: input.resultEnvelope,
  });
}

export function buildSuccessTransportResult(input: SuccessTransportResultInput) {
  switch (input.envelope.envelopeKind) {
    case "ability_command":
      return buildAbilityTransportResult({ ...input, envelope: input.envelope, resultEnvelope: input.resultEnvelope as AbilityResultEnvelope });
    case "ai_request":
      return buildAiTransportResult({ ...input, envelope: input.envelope, resultEnvelope: input.resultEnvelope as AiResponseEnvelope });
    case "human_command":
      return buildHumanCommandTransportResult({ ...input, envelope: input.envelope, resultEnvelope: input.resultEnvelope as HumanCommandResultEnvelope });
    default:
      return buildMirroredTransportResult({ ...input, envelope: input.envelope as MirroredEnvelope });
  }
}
