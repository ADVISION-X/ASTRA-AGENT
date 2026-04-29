import type { NerveBusChildDefinition } from "../../shared/nerve-bus-channel.js";
import type { OrchestrationToAiEnvelope, OrchestrationToAiResult } from "./contract.js";
import { OrchestrationToAiEnvelopeSchema, OrchestrationToAiResultSchema } from "./schema.js";
import { runTransportHandler } from "../../runtime/transport-runner.js";

export const ORCHESTRATION_TO_AI_CHILD: NerveBusChildDefinition<OrchestrationToAiEnvelope, OrchestrationToAiResult> = {
  childCapabilityId: "orchestration-to-ai",
  channelId: "orchestration-to-ai",
  inputSchema: OrchestrationToAiEnvelopeSchema,
  outputSchema: OrchestrationToAiResultSchema,
  async execute(input) {
    return runTransportHandler({
      envelope: input.envelope,
      inputPayload: input.inputPayload,
      context: input.context,
      timeoutMs: input.registryEntry.maxDurationMs,
      resultSchema: input.registryEntry.resultSchema,
      invoke: () => input.context.handlerPort.requestAi({
        envelope: input.envelope,
        inputPayload: input.inputPayload,
      }),
    });
  },
};
