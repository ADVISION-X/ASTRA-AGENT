import type { NerveBusChildDefinition } from "../../shared/nerve-bus-channel.js";
import type { OrchestrationToAbilityEnvelope, OrchestrationToAbilityResult } from "./contract.js";
import { OrchestrationToAbilityEnvelopeSchema, OrchestrationToAbilityResultSchema } from "./schema.js";
import { runTransportHandler } from "../../runtime/transport-runner.js";

export const ORCHESTRATION_TO_ABILITY_CHILD: NerveBusChildDefinition<OrchestrationToAbilityEnvelope, OrchestrationToAbilityResult> = {
  childCapabilityId: "orchestration-to-ability",
  channelId: "orchestration-to-ability",
  inputSchema: OrchestrationToAbilityEnvelopeSchema,
  outputSchema: OrchestrationToAbilityResultSchema,
  async execute(input) {
    return runTransportHandler<OrchestrationToAbilityResult>({
      envelope: input.envelope,
      inputPayload: input.inputPayload,
      context: input.context,
      timeoutMs: input.registryEntry.maxDurationMs,
      resultSchema: OrchestrationToAbilityResultSchema,
      invoke: (_signal) => input.context.handlerPort.dispatchAbilityCommand({
        envelope: input.envelope,
        inputPayload: input.inputPayload,
      }),
    });
  },
};
