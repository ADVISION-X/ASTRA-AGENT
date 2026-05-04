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
import { executeTransportInput } from "./ability-group-transport-dispatch.js";
import { createNerveBusRuntimeContext } from "./runtime/transport-context.js";
import { listNerveBusChildren } from "./registry.js";

type RuntimeContext = ReturnType<typeof createNerveBusRuntimeContext>;
type TransportExecutionInput = Parameters<NerveBusAbilityGroup["transportEnvelope"]>[0];

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
