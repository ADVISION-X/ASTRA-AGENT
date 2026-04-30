import { createAiAbilityGroup } from "./ability-group.js";
import { createAiModelRosterPort } from "./model-roster.js";
import { createSystemAiClock } from "./runtime/ai-clock.js";
import { createAiPromptRegistry } from "./runtime/ai-prompt-registry.js";
import {
  createLocalAiRuntimePort,
  type LocalAiRuntimePortOptions,
} from "./runtime-adapters/local-ai-runtime-adapter.js";

export type CreateAiAbilityGroupInput = {
  emitDebugEvent?: LocalAiRuntimePortOptions["emitDebugEvent"];
};

export const createConfiguredAiAbilityGroup = (
  input: CreateAiAbilityGroupInput = {},
) =>
  createAiAbilityGroup({
    runtime: createLocalAiRuntimePort({ emitDebugEvent: input.emitDebugEvent }),
    clock: createSystemAiClock(),
    modelRoster: createAiModelRosterPort(),
    promptRegistry: createAiPromptRegistry(),
  });