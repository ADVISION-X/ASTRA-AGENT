import type { NerveBusChildDefinition } from "../../shared/nerve-bus-channel.js";
import type { OrchestrationToCommanderEnvelope, OrchestrationToCommanderResult } from "./contract.js";
import { OrchestrationToCommanderEnvelopeSchema, OrchestrationToCommanderResultSchema } from "./schema.js";

export const ORCHESTRATION_TO_COMMANDER_CHILD: NerveBusChildDefinition<OrchestrationToCommanderEnvelope, OrchestrationToCommanderResult> = {
  childCapabilityId: "orchestration-to-commander",
  channelId: "orchestration-to-commander",
  inputSchema: OrchestrationToCommanderEnvelopeSchema,
  outputSchema: OrchestrationToCommanderResultSchema,
  async execute(input) {
    return {
      resultEnvelope: input.registryEntry.resultSchema.parse(input.envelope),
      outputPayload: input.inputPayload,
      handlerDecision: "executed",
      failureReason: input.envelope.failureReason,
      reviewRequiredReason: input.envelope.reviewRequiredReason,
    };
  },
};
