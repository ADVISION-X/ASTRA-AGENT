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
      kind: "handled",
      resultEnvelope: AbilityToOrchestrationResultSchema.parse(input.envelope),
      outputPayload: input.inputPayload,
      handlerDecision: "executed",
      failureReason: input.envelope.failureReason,
      reviewRequiredReason: input.envelope.reviewRequiredReason,
      timeoutDecision: "within_timeout",
      handlerCallId: input.envelope.envelopeId,
      handlerStartedAt: input.envelope.createdAt,
      handlerEndedAt: input.envelope.createdAt,
      handlerDurationMs: 0,
      circuitBreakerState: "closed",
    };
  },
};
