import { createAiAbilityGroup } from "./ability-group.js";
import { createAiModelRosterPort } from "./model-roster.js";
import { createSystemAiClock } from "./runtime/ai-clock.js";
import { createAiPromptRegistry } from "./runtime/ai-prompt-registry.js";
import {
  createProviderAwareAiRuntimePort,
  type ProviderAwareAiRuntimeInput,
} from "./runtime-adapters/provider-aware-ai-runtime-adapter.js";

export type CreateAiAbilityGroupInput = {
  emitDebugEvent?: ProviderAwareAiRuntimeInput["emitDebugEvent"];
  dataDir?: string | null;
};

export const createConfiguredAiAbilityGroup = (
  input: CreateAiAbilityGroupInput = {},
) => {
  return createAiAbilityGroup({
    runtime: createProviderAwareAiRuntimePort({
      emitDebugEvent: input.emitDebugEvent,
      dataDir: input.dataDir ?? null,
    }),
    clock: createSystemAiClock(),
    modelRoster: createAiModelRosterPort(),
    promptRegistry: createAiPromptRegistry(),
    emitDebugEvent: input.emitDebugEvent,
  });
};
