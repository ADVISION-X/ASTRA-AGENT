import {
  AbilityCommandDispatchInputSchema,
  AbilityResultDispatchInputSchema,
  AiRequestDispatchInputSchema,
  AiResponseDispatchInputSchema,
  CommanderMessageDispatchInputSchema,
  HumanCommandDispatchInputSchema,
  NerveBusTransportInputSchema,
} from "./schema.js";
import type { CreateNerveBusAbilityGroupInput, NerveBusAbilityGroup } from "./contract.js";
import type {
  AbilityTransportResult,
  AiTransportResult,
  HumanCommandTransportResult,
  NerveBusMirroredTransportResult,
  NerveBusTransportResult,
} from "./shared/nerve-bus-result.js";
import { executeNerveBusChild } from "./runtime/nerve-bus-executor.js";
import { createNerveBusRuntimeContext } from "./runtime/transport-context.js";
import { getNerveBusChannelRegistryEntry, getNerveBusChild, listNerveBusChildren } from "./registry.js";

type RuntimeContext = ReturnType<typeof createNerveBusRuntimeContext>;
type TransportExecutionInput = Parameters<NerveBusAbilityGroup["transportEnvelope"]>[0];
type TransportChannelId = TransportExecutionInput["envelope"]["channelId"];
type TransportExecutionInputByChannel<TChannelId extends TransportChannelId> = Extract<
  TransportExecutionInput,
  { envelope: { channelId: TChannelId } }
>;

const executeTransportInput = async (context: RuntimeContext, executionInput: TransportExecutionInput): Promise<NerveBusTransportResult> => {
  const parsedInput = NerveBusTransportInputSchema.parse(executionInput);

  switch (parsedInput.envelope.channelId) {
    case "commander-to-orchestration": {
      const transportInput = parsedInput as TransportExecutionInputByChannel<"commander-to-orchestration">;
      return executeNerveBusChild({
        child: getNerveBusChild("commander-to-orchestration"),
        envelope: transportInput.envelope,
        inputPayload: transportInput.inputPayload,
        registryEntry: getNerveBusChannelRegistryEntry("commander-to-orchestration"),
        context,
      });
    }
    case "orchestration-to-commander": {
      const transportInput = parsedInput as TransportExecutionInputByChannel<"orchestration-to-commander">;
      return executeNerveBusChild({
        child: getNerveBusChild("orchestration-to-commander"),
        envelope: transportInput.envelope,
        inputPayload: transportInput.inputPayload,
        registryEntry: getNerveBusChannelRegistryEntry("orchestration-to-commander"),
        context,
      });
    }
    case "orchestration-to-ability": {
      const transportInput = parsedInput as TransportExecutionInputByChannel<"orchestration-to-ability">;
      return executeNerveBusChild({
        child: getNerveBusChild("orchestration-to-ability"),
        envelope: transportInput.envelope,
        inputPayload: transportInput.inputPayload,
        registryEntry: getNerveBusChannelRegistryEntry("orchestration-to-ability"),
        context,
      });
    }
    case "ability-to-orchestration": {
      const transportInput = parsedInput as TransportExecutionInputByChannel<"ability-to-orchestration">;
      return executeNerveBusChild({
        child: getNerveBusChild("ability-to-orchestration"),
        envelope: transportInput.envelope,
        inputPayload: transportInput.inputPayload,
        registryEntry: getNerveBusChannelRegistryEntry("ability-to-orchestration"),
        context,
      });
    }
    case "orchestration-to-ai": {
      const transportInput = parsedInput as TransportExecutionInputByChannel<"orchestration-to-ai">;
      return executeNerveBusChild({
        child: getNerveBusChild("orchestration-to-ai"),
        envelope: transportInput.envelope,
        inputPayload: transportInput.inputPayload,
        registryEntry: getNerveBusChannelRegistryEntry("orchestration-to-ai"),
        context,
      });
    }
    case "ai-to-orchestration": {
      const transportInput = parsedInput as TransportExecutionInputByChannel<"ai-to-orchestration">;
      return executeNerveBusChild({
        child: getNerveBusChild("ai-to-orchestration"),
        envelope: transportInput.envelope,
        inputPayload: transportInput.inputPayload,
        registryEntry: getNerveBusChannelRegistryEntry("ai-to-orchestration"),
        context,
      });
    }
  }
};

const createTransportEnvelopeDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["transportEnvelope"]>[0]) => executeTransportInput(context, executionInput);
};

const createHumanCommandDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchHumanCommand"]>[0]) => {
    const parsedInput = HumanCommandDispatchInputSchema.parse(executionInput);
    return executeTransportInput(context, parsedInput) as Promise<HumanCommandTransportResult>;
  };
};

const createAbilityCommandDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchAbilityCommand"]>[0]) => {
    const parsedInput = AbilityCommandDispatchInputSchema.parse(executionInput);
    return executeTransportInput(context, parsedInput) as Promise<AbilityTransportResult>;
  };
};

const createAbilityResultDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchAbilityResult"]>[0]) => {
    const parsedInput = AbilityResultDispatchInputSchema.parse(executionInput);
    return executeTransportInput(context, parsedInput) as Promise<NerveBusMirroredTransportResult>;
  };
};

const createAiDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["requestAi"]>[0]) => {
    const parsedInput = AiRequestDispatchInputSchema.parse(executionInput);
    return executeTransportInput(context, parsedInput) as Promise<AiTransportResult>;
  };
};

const createAiResponseDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchAiResponse"]>[0]) => {
    const parsedInput = AiResponseDispatchInputSchema.parse(executionInput);
    return executeTransportInput(context, parsedInput) as Promise<NerveBusMirroredTransportResult>;
  };
};

const createCommanderMessageDispatcher = (context: RuntimeContext) => {
  return async (executionInput: Parameters<NerveBusAbilityGroup["dispatchCommanderMessage"]>[0]) => {
    const parsedInput = CommanderMessageDispatchInputSchema.parse(executionInput);
    return executeTransportInput(context, parsedInput) as Promise<NerveBusMirroredTransportResult>;
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
    transportEnvelope: createTransportEnvelopeDispatcher(context),
    dispatchHumanCommand: createHumanCommandDispatcher(context),
    dispatchAbilityCommand: createAbilityCommandDispatcher(context),
    dispatchAbilityResult: createAbilityResultDispatcher(context),
    requestAi: createAiDispatcher(context),
    dispatchAiResponse: createAiResponseDispatcher(context),
    dispatchCommanderMessage: createCommanderMessageDispatcher(context),
  };
}
