import {
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  HumanCommandTransportResultSchema,
  NERVE_BUS_ABILITY_GROUP_ID,
} from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";

type SuccessTransportResultInput = {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  proof: NerveBusTransportProof;
};

export const buildSuccessTransportResult = (input: SuccessTransportResultInput) => {
  if (input.envelope.envelopeKind === "ability_command") {
    return AbilityTransportResultSchema.parse({
      abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
      channelId: input.envelope.channelId,
      status: input.resultEnvelope.status,
      transportDecision: "executed",
      commandEnvelope: input.envelope,
      resultEnvelope: input.resultEnvelope,
      proof: input.proof,
      failureReason: input.resultEnvelope.failureReason,
      reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
    });
  }

  if (input.envelope.envelopeKind === "ai_request") {
    return AiTransportResultSchema.parse({
      abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
      channelId: input.envelope.channelId,
      status: input.resultEnvelope.status,
      transportDecision: "executed",
      requestEnvelope: input.envelope,
      responseEnvelope: input.resultEnvelope,
      proof: input.proof,
      failureReason: input.resultEnvelope.failureReason,
      reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
    });
  }

  return HumanCommandTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: input.resultEnvelope.status,
    transportDecision: "executed",
    commandEnvelope: input.envelope,
    resultEnvelope: input.resultEnvelope,
    proof: input.proof,
    failureReason: input.resultEnvelope.failureReason,
    reviewRequiredReason: input.resultEnvelope.reviewRequiredReason,
  });
};
