import { AbilityCommandDispatchInputSchema, AiRequestDispatchInputSchema, HumanCommandDispatchInputSchema } from "./schema.js";
import type { CreateNerveBusAbilityGroupInput, NerveBusAbilityGroup } from "./contract.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "./shared/nerve-bus-result.js";
import { executeNerveBusChild } from "./runtime/nerve-bus-executor.js";
import { createNerveBusRuntimeContext } from "./runtime/transport-context.js";
import { getNerveBusChannelRegistryEntry, getNerveBusChild, listNerveBusChildren } from "./registry.js";

const createHumanCommandDispatcher = (context: ReturnType<typeof createNerveBusRuntimeContext>) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchHumanCommand"]>[0]) => {
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
  };
};

const createAbilityCommandDispatcher = (context: ReturnType<typeof createNerveBusRuntimeContext>) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchAbilityCommand"]>[0]) => {
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
  };
};

const createAiDispatcher = (context: ReturnType<typeof createNerveBusRuntimeContext>) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["requestAi"]>[0]) => {
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
  };
};

export function createNerveBusAbilityGroup(input: CreateNerveBusAbilityGroupInput): NerveBusAbilityGroup {
  const context = createNerveBusRuntimeContext({
    handlerPort: input.handlerPort,
    ...(input.clockPort ? { clockPort: input.clockPort } : {}),
    ...(input.transportPort ? { transportPort: input.transportPort } : {}),
    ...(input.idempotencyPort ? { idempotencyPort: input.idempotencyPort } : {}),
    ...(input.queuePort ? { queuePort: input.queuePort } : {}),
    ...(input.sequencePort ? { sequencePort: input.sequencePort } : {}),
  });

  return {
    listChannelIds() {
      return listNerveBusChildren() as ReturnType<NerveBusAbilityGroup["listChannelIds"]>;
    },
    dispatchHumanCommand: createHumanCommandDispatcher(context),
    dispatchAbilityCommand: createAbilityCommandDispatcher(context),
    requestAi: createAiDispatcher(context),
  };
}
