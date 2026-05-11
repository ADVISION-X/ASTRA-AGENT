import { getModelRoleConfig, loadLocalAiModelConfig } from "../../lib/local-ai/model-config.js";
import { OllamaRuntimeAdapter } from "../../lib/local-ai/runtime-adapters/ollama-runtime-adapter.js";
import type {
  AiAbilityGroup,
  CreateConfiguredAiAbilityGroupInput,
} from "./contract.js";
import { AiAbilityInputSchema } from "./schema.js";
import { executeVisualMissionJudgeOnce } from "./children/visual-mission-judge-once.js";
import { findAiPromptContractCatalogEntry } from "./registry.js";

const createConfiguredAiAbilityGroup = (input: CreateConfiguredAiAbilityGroupInput = {}): AiAbilityGroup => {
  let lastTaskType: string | null = null;
  let lastInvocationStatus: string | null = null;
  let lastFailureReason: string | null = null;

  return {
    async execute(rawInput, options) {
      const request = AiAbilityInputSchema.parse(rawInput);
      const promptContract = findAiPromptContractCatalogEntry(request.promptContractId);

      if (!promptContract || promptContract.taskType !== request.taskType || promptContract.outputSchemaRef !== request.expectedOutputSchema) {
        throw new Error(`AI prompt contract mismatch for ${request.promptContractId}.`);
      }

      const result = await executeVisualMissionJudgeOnce({
        request,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(input.emitDebugEvent ? { emitDebugEvent: input.emitDebugEvent } : {}),
      });

      lastTaskType = result.taskType;
      lastInvocationStatus = result.status;
      lastFailureReason = result.failureReason ?? result.reviewRequiredReason ?? null;
      return result;
    },

    async getHealth() {
      try {
        const config = await loadLocalAiModelConfig();
        const roleConfig = getModelRoleConfig(config, "vision");
        const adapter = new OllamaRuntimeAdapter();
        const health = await adapter.getHealth();
        return {
          ok: health.status === "ready",
          detail: health.status === "ready"
            ? `local model ${roleConfig.model} is ready`
            : health.detail,
        };
      } catch (error) {
        return {
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async getRuntimeHealth() {
      return {
        lastTaskType,
        lastInvocationStatus,
        lastFailureReason,
      };
    },
  };
};

export { createConfiguredAiAbilityGroup };