import { AbilityCommandDispatchInputSchema, AiRequestDispatchInputSchema, HumanCommandDispatchInputSchema } from "./schema.js";
import type { CreateNerveBusAbilityGroupInput, NerveBusAbilityGroup } from "./contract.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "./shared/nerve-bus-result.js";
import { createSystemNerveBusClockPort } from "./ports/nerve-bus-clock-port.js";
import { createInMemoryNerveBusIdempotencyPort } from "./ports/nerve-bus-idempotency-port.js";
import { createInMemoryNerveBusQueuePort } from "./ports/nerve-bus-queue-port.js";
import { createInMemoryNerveBusTransportPort } from "./ports/nerve-bus-transport-port.js";
import { executeNerveBusChild } from "./runtime/nerve-bus-executor.js";
import { getNerveBusChannelRegistryEntry, getNerveBusChild, listNerveBusChildren } from "./registry.js";

export function createNerveBusAbilityGroup(input: CreateNerveBusAbilityGroupInput): NerveBusAbilityGroup {
  const context = {
    clock: input.clock ?? createSystemNerveBusClockPort(),
    transport: input.transport ?? createInMemoryNerveBusTransportPort(),
    idempotency: input.idempotency ?? createInMemoryNerveBusIdempotencyPort(),
    queue: input.queue ?? createInMemoryNerveBusQueuePort(),
    handlerPort: input.handlerPort,
  };

  return {
    listChannelIds() {
      return listNerveBusChildren() as ReturnType<NerveBusAbilityGroup["listChannelIds"]>;
    },
    async dispatchHumanCommand(executionInput) {
      const parsedInput = HumanCommandDispatchInputSchema.parse(executionInput);
      const child = getNerveBusChild("commander-to-orchestration");
      const registryEntry = getNerveBusChannelRegistryEntry("commander-to-orchestration");
      return executeNerveBusChild({
        child,
        envelope: child.inputSchema.parse(parsedInput.envelope),
        inputPayload: parsedInput.inputPayload,
        registryEntry,
        context,
      }) as Promise<HumanCommandTransportResult>;
    },
    async dispatchAbilityCommand(executionInput) {
      const parsedInput = AbilityCommandDispatchInputSchema.parse(executionInput);
      const child = getNerveBusChild("orchestration-to-ability");
      const registryEntry = getNerveBusChannelRegistryEntry("orchestration-to-ability");
      return executeNerveBusChild({
        child,
        envelope: child.inputSchema.parse(parsedInput.envelope),
        inputPayload: parsedInput.inputPayload,
        registryEntry,
        context,
      }) as Promise<AbilityTransportResult>;
    },
    async requestAi(executionInput) {
      const parsedInput = AiRequestDispatchInputSchema.parse(executionInput);
      const child = getNerveBusChild("orchestration-to-ai");
      const registryEntry = getNerveBusChannelRegistryEntry("orchestration-to-ai");
      return executeNerveBusChild({
        child,
        envelope: child.inputSchema.parse(parsedInput.envelope),
        inputPayload: parsedInput.inputPayload,
        registryEntry,
        context,
      }) as Promise<AiTransportResult>;
    },
  };
}
