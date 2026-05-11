import { randomUUID } from "node:crypto";
import { checkLocalAiReadiness, loadLocalAiConfig } from "../../lib/local-ai/index.js";
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
        ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
        traceContext: input.traceContext ?? {
          traceId: request.missionId,
          spanId: request.roundId ?? request.capabilityCallId,
          parentSpanId: request.nerveBusEnvelopeId,
        },
      });

      lastTaskType = result.taskType;
      lastInvocationStatus = result.status;
      lastFailureReason = result.failureReason ?? result.reviewRequiredReason ?? null;
      return result;
    },

    async getHealth() {
      try {
        const config = await loadLocalAiConfig();
        const readiness = await checkLocalAiReadiness(config);
        return {
          ok: readiness.status === "ready",
          detail: readiness.detail,
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