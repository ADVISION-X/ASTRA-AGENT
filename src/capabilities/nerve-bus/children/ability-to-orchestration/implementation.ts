import type { NerveBusChildDefinition } from "../../shared/nerve-bus-channel.js";
import type { AbilityToOrchestrationEnvelope, AbilityToOrchestrationResult } from "./contract.js";
import { AbilityToOrchestrationEnvelopeSchema, AbilityToOrchestrationResultSchema } from "./schema.js";

export const ABILITY_TO_ORCHESTRATION_CHILD: NerveBusChildDefinition<AbilityToOrchestrationEnvelope, AbilityToOrchestrationResult> = {
  childCapabilityId: "ability-to-orchestration",
  channelId: "ability-to-orchestration",
  inputSchema: AbilityToOrchestrationEnvelopeSchema,
  outputSchema: AbilityToOrchestrationResultSchema,
  async execute(input) {
    return {
      resultEnvelope: AbilityToOrchestrationResultSchema.parse(input.envelope),
      outputPayload: input.inputPayload,
      handlerDecision: "executed",
      failureReason: input.envelope.failureReason,
      reviewRequiredReason: input.envelope.reviewRequiredReason,
    };
  },
};
