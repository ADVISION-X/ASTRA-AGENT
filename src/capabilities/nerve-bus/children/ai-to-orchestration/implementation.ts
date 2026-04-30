import type { NerveBusChildDefinition } from "../../shared/nerve-bus-channel.js";
import type { AiToOrchestrationEnvelope, AiToOrchestrationResult } from "./contract.js";
import { AiToOrchestrationEnvelopeSchema, AiToOrchestrationResultSchema } from "./schema.js";

export const AI_TO_ORCHESTRATION_CHILD: NerveBusChildDefinition<AiToOrchestrationEnvelope, AiToOrchestrationResult> = {
  childCapabilityId: "ai-to-orchestration",
  channelId: "ai-to-orchestration",
  inputSchema: AiToOrchestrationEnvelopeSchema,
  outputSchema: AiToOrchestrationResultSchema,
  async execute(input) {
    return {
      kind: "handled",
      resultEnvelope: AiToOrchestrationResultSchema.parse(input.envelope),
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
