import { randomUUID } from "node:crypto";
import { loadOnlineAiProviderConfig } from "../../lib/online-ai/index.js";
import type {
  AiAbilityGroup,
  CreateConfiguredAiAbilityGroupInput,
} from "./contract.js";
import { AiAbilityInputSchema } from "./schema.js";
import { executeVisualMissionJudgeOnce } from "./children/visual-mission-judge-once.js";
import { findAiPromptContractCatalogEntry } from "./registry.js";

type AiRuntimeState = {
  lastTaskType: string | null;
  lastInvocationStatus: string | null;
  lastFailureReason: string | null;
};

const buildTraceContext = (
  input: CreateConfiguredAiAbilityGroupInput,
  request: Parameters<typeof executeVisualMissionJudgeOnce>[0]["request"],
) =>
  input.traceContext ?? {
    traceId: request.missionId,
    spanId: request.roundId ?? request.capabilityCallId,
    parentSpanId: request.nerveBusEnvelopeId,
  };

const updateRuntimeState = (
  state: AiRuntimeState,
  result: Awaited<ReturnType<typeof executeVisualMissionJudgeOnce>>,
) => {
  state.lastTaskType = result.taskType;
  state.lastInvocationStatus = result.status;
  state.lastFailureReason =
    result.failureReason ?? result.reviewRequiredReason ?? null;
};

const executeAiRequest = async (
  input: CreateConfiguredAiAbilityGroupInput,
  state: AiRuntimeState,
  rawInput: unknown,
  options?: { signal?: AbortSignal },
) => {
  const request = AiAbilityInputSchema.parse(rawInput);
  const promptContract = findAiPromptContractCatalogEntry(request.promptContractId);

  if (
    !promptContract
    || promptContract.taskType !== request.taskType
    || promptContract.outputSchemaRef !== request.expectedOutputSchema
  ) {
    throw new Error(`AI prompt contract mismatch for ${request.promptContractId}.`);
  }

  const result = await executeVisualMissionJudgeOnce({
    dataDir: input.dataDir ?? process.cwd(),
    request,
    ...(options?.signal ? { signal: options.signal } : {}),
    ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
    traceContext: buildTraceContext(input, request),
  });

  updateRuntimeState(state, result);
  return result;
};

const readAiHealth = async (input: CreateConfiguredAiAbilityGroupInput) => {
  try {
    const config = await loadOnlineAiProviderConfig(input.dataDir ?? process.cwd());
    return {
      ok: true,
      detail: `Online AI ready: google/${config.modelName}`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};

const readAiRuntimeHealth = async (state: AiRuntimeState) => ({
  lastTaskType: state.lastTaskType,
  lastInvocationStatus: state.lastInvocationStatus,
  lastFailureReason: state.lastFailureReason,
});

const createConfiguredAiAbilityGroup = (input: CreateConfiguredAiAbilityGroupInput = {}): AiAbilityGroup => {
  const state: AiRuntimeState = {
    lastTaskType: null,
    lastInvocationStatus: null,
    lastFailureReason: null,
  };

  return {
    execute: (rawInput, options) => executeAiRequest(input, state, rawInput, options),
    getHealth: () => readAiHealth(input),
    getRuntimeHealth: () => readAiRuntimeHealth(state),
  };
};

export { createConfiguredAiAbilityGroup };
