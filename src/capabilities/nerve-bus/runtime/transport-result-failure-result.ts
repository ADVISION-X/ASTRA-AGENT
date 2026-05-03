import {
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  HumanCommandTransportResultSchema,
  NERVE_BUS_ABILITY_GROUP_ID,
  NerveBusMirroredTransportResultSchema,
} from "../schema.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";
import type { AbilityCommandEnvelope, AiRequestEnvelope, HumanCommandEnvelope } from "../shared/nerve-bus-envelope.js";
import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";

type GovernedFailureResultInput = {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  proof: NerveBusTransportProof;
  failureReason: string;
  reviewRequiredReason?: string | null;
  transportDecision?: "executed" | "duplicate_skipped" | "replay_rejected" | "queue_rejected";
};

const buildAbilityFailureResult = (
  input: GovernedFailureResultInput & { envelope: AbilityCommandEnvelope },
  resultEnvelope: Extract<SupportedResultEnvelope, { envelopeKind: "ability_result" }>,
) => AbilityTransportResultSchema.parse({
  abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
  channelId: "orchestration-to-ability",
  status: resultEnvelope.status,
  transportDecision: input.transportDecision ?? "executed",
  commandEnvelope: input.envelope,
  resultEnvelope,
  proof: input.proof,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
});

const buildAiFailureResult = (
  input: GovernedFailureResultInput & { envelope: AiRequestEnvelope },
  responseEnvelope: Extract<SupportedResultEnvelope, { envelopeKind: "ai_response" }>,
) => AiTransportResultSchema.parse({
  abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
  channelId: "orchestration-to-ai",
  status: responseEnvelope.status,
  transportDecision: input.transportDecision ?? "executed",
  requestEnvelope: input.envelope,
  responseEnvelope,
  proof: input.proof,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
});

const buildHumanFailureResult = (
  input: GovernedFailureResultInput & { envelope: HumanCommandEnvelope },
  resultEnvelope: Extract<SupportedResultEnvelope, { envelopeKind: "human_command_result" }>,
) => HumanCommandTransportResultSchema.parse({
  abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
  channelId: "commander-to-orchestration",
  status: resultEnvelope.status,
  transportDecision: input.transportDecision ?? "executed",
  commandEnvelope: input.envelope,
  resultEnvelope,
  proof: input.proof,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
});

const FAILURE_RESULT_BUILDERS = {
  ability_command: (input: GovernedFailureResultInput) => buildAbilityFailureResult(input as GovernedFailureResultInput & { envelope: AbilityCommandEnvelope }, input.resultEnvelope as Extract<SupportedResultEnvelope, { envelopeKind: "ability_result" }>),
  ai_request: (input: GovernedFailureResultInput) => buildAiFailureResult(input as GovernedFailureResultInput & { envelope: AiRequestEnvelope }, input.resultEnvelope as Extract<SupportedResultEnvelope, { envelopeKind: "ai_response" }>),
  human_command: (input: GovernedFailureResultInput) => buildHumanFailureResult(input as GovernedFailureResultInput & { envelope: HumanCommandEnvelope }, input.resultEnvelope as Extract<SupportedResultEnvelope, { envelopeKind: "human_command_result" }>),
  ability_result: (input: GovernedFailureResultInput) => NerveBusMirroredTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: input.resultEnvelope.status,
    transportDecision: input.transportDecision ?? "executed",
    transportedEnvelope: input.resultEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  }),
  ai_response: (input: GovernedFailureResultInput) => NerveBusMirroredTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: input.resultEnvelope.status,
    transportDecision: input.transportDecision ?? "executed",
    transportedEnvelope: input.resultEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  }),
  human_command_result: (input: GovernedFailureResultInput) => NerveBusMirroredTransportResultSchema.parse({
    abilityGroupId: NERVE_BUS_ABILITY_GROUP_ID,
    channelId: input.envelope.channelId,
    status: input.resultEnvelope.status,
    transportDecision: input.transportDecision ?? "executed",
    transportedEnvelope: input.resultEnvelope,
    proof: input.proof,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  }),
} as const;

export async function buildGovernedFailureResult(input: GovernedFailureResultInput) {
  return FAILURE_RESULT_BUILDERS[input.envelope.envelopeKind](input);
}