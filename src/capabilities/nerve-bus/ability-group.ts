import { AbilityCommandDispatchInputSchema, AiRequestDispatchInputSchema, HumanCommandDispatchInputSchema } from "./schema.js";
import type { CreateNerveBusAbilityGroupInput, NerveBusAbilityGroup } from "./contract.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "./shared/nerve-bus-result.js";
import { executeNerveBusChild } from "./runtime/nerve-bus-executor.js";
import { createNerveBusRuntimeContext } from "./runtime/transport-context.js";
import { getNerveBusChannelRegistryEntry, getNerveBusChild, listNerveBusChildren } from "./registry.js";

export function createNerveBusAbilityGroup(input: CreateNerveBusAbilityGroupInput): NerveBusAbilityGroup {
  const context = createNerveBusRuntimeContext({ handlerPort: input.handlerPort });

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
        envelope: parsedInput.envelope,
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
        envelope: parsedInput.envelope,
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
        envelope: parsedInput.envelope,
        inputPayload: parsedInput.inputPayload,
        registryEntry,
        context,
      }) as Promise<AiTransportResult>;
    },
  };
}
