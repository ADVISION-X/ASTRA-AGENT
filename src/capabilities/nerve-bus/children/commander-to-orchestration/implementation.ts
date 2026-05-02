import type { NerveBusChildDefinition } from "../../shared/nerve-bus-channel.js";
import type { CommanderToOrchestrationEnvelope, CommanderToOrchestrationResult } from "./contract.js";
import { CommanderToOrchestrationEnvelopeSchema, CommanderToOrchestrationResultSchema } from "./schema.js";
import { runTransportHandler } from "../../runtime/transport-runner.js";

export const COMMANDER_TO_ORCHESTRATION_CHILD: NerveBusChildDefinition<CommanderToOrchestrationEnvelope, CommanderToOrchestrationResult> = {
  childCapabilityId: "commander-to-orchestration",
  channelId: "commander-to-orchestration",
  inputSchema: CommanderToOrchestrationEnvelopeSchema,
  outputSchema: CommanderToOrchestrationResultSchema,
  async execute(input) {
    return runTransportHandler<CommanderToOrchestrationResult>({
      envelope: input.envelope,
      inputPayload: input.inputPayload,
      context: input.context,
      timeoutMs: input.registryEntry.maxDurationMs,
      resultSchema: CommanderToOrchestrationResultSchema,
      invoke: (signal) => input.context.handlerPort.dispatchHumanCommand({
        envelope: input.envelope,
        inputPayload: input.inputPayload,
        signal,
      }),
    });
  },
};
