import type { AiExecutionContext } from "../contract.js";
import { createAiModelRosterPort } from "../model-roster.js";
import { createProviderAwareAiRuntimePort } from "../runtime-adapters/provider-aware-ai-runtime-adapter.js";
import { createSystemAiClock } from "./ai-clock.js";
import { createAiPromptRegistry } from "./ai-prompt-registry.js";

export type CreateAiExecutionContextInput = {
  emitDebugEvent?: NonNullable<Parameters<typeof createProviderAwareAiRuntimePort>[0]>["emitDebugEvent"];
  dataDir?: string | null;
};

export function createAiExecutionContext(input: CreateAiExecutionContextInput = {}): AiExecutionContext {
  return {
    runtime: createProviderAwareAiRuntimePort({
      emitDebugEvent: input.emitDebugEvent,
      dataDir: input.dataDir ?? null,
    }),
    clock: createSystemAiClock(),
    modelRoster: createAiModelRosterPort(),
    promptRegistry: createAiPromptRegistry(),
    emitDebugEvent: input.emitDebugEvent,
  };
}
