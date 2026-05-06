import {
  AbilityCommandDispatchInputSchema,
  AbilityResultDispatchInputSchema,
  AiRequestDispatchInputSchema,
  AiResponseDispatchInputSchema,
  CommanderMessageDispatchInputSchema,
  HumanCommandDispatchInputSchema,
  NerveBusTransportInputSchema,
} from "./schema.js";
import type { NerveBusAbilityGroup } from "./contract.js";
import type { NerveBusTransportResult } from "./shared/nerve-bus-result.js";
import { executeNerveBusChild } from "./runtime/nerve-bus-executor.js";
import { createNerveBusRuntimeContext } from "./runtime/transport-context.js";
import { getNerveBusChannelRegistryEntry, getNerveBusChild } from "./registry.js";

type RuntimeContext = ReturnType<typeof createNerveBusRuntimeContext>;
type TransportExecutionInput = Parameters<NerveBusAbilityGroup["transportEnvelope"]>[0];
type TransportChannelId = TransportExecutionInput["envelope"]["channelId"];

function executeCommanderToOrchestration(
  context: RuntimeContext,
  input: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const channelInput = HumanCommandDispatchInputSchema.parse(input);
  return executeNerveBusChild({
    child: getNerveBusChild("commander-to-orchestration"),
    envelope: channelInput.envelope,
    inputPayload: channelInput.inputPayload,
    registryEntry: getNerveBusChannelRegistryEntry("commander-to-orchestration"),
    context,
  });
}

function executeOrchestrationToCommander(
  context: RuntimeContext,
  input: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const channelInput = CommanderMessageDispatchInputSchema.parse(input);
  return executeNerveBusChild({
    child: getNerveBusChild("orchestration-to-commander"),
    envelope: channelInput.envelope,
    inputPayload: channelInput.inputPayload,
    registryEntry: getNerveBusChannelRegistryEntry("orchestration-to-commander"),
    context,
  });
}

function executeOrchestrationToAbility(
  context: RuntimeContext,
  input: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const channelInput = AbilityCommandDispatchInputSchema.parse(input);
  return executeNerveBusChild({
    child: getNerveBusChild("orchestration-to-ability"),
    envelope: channelInput.envelope,
    inputPayload: channelInput.inputPayload,
    registryEntry: getNerveBusChannelRegistryEntry("orchestration-to-ability"),
    context,
  });
}

function executeAbilityToOrchestration(
  context: RuntimeContext,
  input: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const channelInput = AbilityResultDispatchInputSchema.parse(input);
  return executeNerveBusChild({
    child: getNerveBusChild("ability-to-orchestration"),
    envelope: channelInput.envelope,
    inputPayload: channelInput.inputPayload,
    registryEntry: getNerveBusChannelRegistryEntry("ability-to-orchestration"),
    context,
  });
}

function executeOrchestrationToAi(
  context: RuntimeContext,
  input: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const channelInput = AiRequestDispatchInputSchema.parse(input);
  return executeNerveBusChild({
    child: getNerveBusChild("orchestration-to-ai"),
    envelope: channelInput.envelope,
    inputPayload: channelInput.inputPayload,
    registryEntry: getNerveBusChannelRegistryEntry("orchestration-to-ai"),
    context,
    signal: channelInput.signal,
  });
}

function executeAiToOrchestration(
  context: RuntimeContext,
  input: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const channelInput = AiResponseDispatchInputSchema.parse(input);
  return executeNerveBusChild({
    child: getNerveBusChild("ai-to-orchestration"),
    envelope: channelInput.envelope,
    inputPayload: channelInput.inputPayload,
    registryEntry: getNerveBusChannelRegistryEntry("ai-to-orchestration"),
    context,
  });
}

const CHANNEL_EXECUTORS = {
  "commander-to-orchestration": executeCommanderToOrchestration,
  "orchestration-to-commander": executeOrchestrationToCommander,
  "orchestration-to-ability": executeOrchestrationToAbility,
  "ability-to-orchestration": executeAbilityToOrchestration,
  "orchestration-to-ai": executeOrchestrationToAi,
  "ai-to-orchestration": executeAiToOrchestration,
} as const satisfies Record<TransportChannelId, (context: RuntimeContext, input: TransportExecutionInput) => Promise<NerveBusTransportResult>>;

export function executeTransportInput(
  context: RuntimeContext,
  executionInput: TransportExecutionInput,
): Promise<NerveBusTransportResult> {
  const parsedInput = NerveBusTransportInputSchema.parse(executionInput);
  const channelId = parsedInput.envelope.channelId as TransportChannelId;

  return CHANNEL_EXECUTORS[channelId](context, parsedInput);
}
