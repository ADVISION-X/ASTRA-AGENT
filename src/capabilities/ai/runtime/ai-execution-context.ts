import type { AiExecutionContext } from "../contract.js";
import { createAiModelRosterPort } from "../model-roster.js";
import { createProviderAwareAiRuntimePort } from "../runtime-adapters/provider-aware-ai-runtime-adapter.js";
import { createSystemAiClock } from "./ai-clock.js";
import { createAiPromptRegistry } from "./ai-prompt-registry.js";

export function createAiExecutionContext(): AiExecutionContext {
  return {
    runtime: createProviderAwareAiRuntimePort(),
    clock: createSystemAiClock(),
    modelRoster: createAiModelRosterPort(),
    promptRegistry: createAiPromptRegistry(),
  };
}
