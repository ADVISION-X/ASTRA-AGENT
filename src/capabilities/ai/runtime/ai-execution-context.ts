import type { AiExecutionContext } from "../contract.js";
import { createAiModelRosterPort } from "../model-roster.js";
import { createLocalAiRuntimePort } from "../runtime-adapters/local-ai-runtime-adapter.js";
import { createSystemAiClock } from "./ai-clock.js";
import { createAiPromptRegistry } from "./ai-prompt-registry.js";

export function createAiExecutionContext(): AiExecutionContext {
  return {
    runtime: createLocalAiRuntimePort(),
    clock: createSystemAiClock(),
    modelRoster: createAiModelRosterPort(),
    promptRegistry: createAiPromptRegistry(),
  };
}
