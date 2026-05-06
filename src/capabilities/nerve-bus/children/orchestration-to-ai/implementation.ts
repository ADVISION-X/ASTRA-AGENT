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
    return runTransportHandler<OrchestrationToAiResult>({
      envelope: input.envelope,
      inputPayload: input.inputPayload,
      context: input.context,
      timeoutMs: input.registryEntry.maxDurationMs,
      parentSignal: input.signal,
      resultSchema: OrchestrationToAiResultSchema,
      invoke: (signal) => input.context.handlerPort.requestAi({
        envelope: input.envelope,
        inputPayload: input.inputPayload,
        signal,
      }),
    });
  },
};
