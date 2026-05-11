import { createHash } from "node:crypto";

import { getModelRoleConfig, loadLocalAiModelConfig } from "../../../lib/local-ai/model-config.js";
import { OllamaRuntimeAdapter } from "../../../lib/local-ai/runtime-adapters/ollama-runtime-adapter.js";
import type { LocalAiDebugHook } from "../../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";
import type { AiAbilityInput } from "../contract.js";
import { resolveAiDispatchTimeoutMs } from "../registry.js";
import { buildVisualMissionJudgePrompt } from "../prompt/visual-mission-judge-prompt.js";

const buildHash = (value: string) => createHash("sha256").update(value).digest("hex");

const resolveImagePaths = (input: AiAbilityInput) => input.inputRefs
  .map((entry) => entry.filePath)
  .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);

const emitPromptPreparedEvent = async (input: {
  emitDebugEvent?: LocalAiDebugHook;
  request: AiAbilityInput;
  modelName: string;
  prompt: ReturnType<typeof buildVisualMissionJudgePrompt>;
}) => {
  await input.emitDebugEvent?.({
    eventType: "ai_prompt_prepared",
    detail: `Prepared visual mission judgment prompt for ${input.request.missionId}.`,
    taskType: input.request.taskType,
    promptContractId: input.request.promptContractId,
    promptVersion: "v1",
    outputSchemaRef: input.request.expectedOutputSchema,
    modelName: input.modelName,
    modelRole: "vision",
    systemPromptText: input.prompt.systemPrompt,
    userPromptText: input.prompt.userPrompt,
    systemPromptHash: buildHash(input.prompt.systemPrompt),
    userPromptHash: buildHash(input.prompt.userPrompt),
    promptPreview: input.prompt.fullPrompt.slice(0, 320),
    promptFullText: input.prompt.fullPrompt,
    sourceScreenshotEvidenceId: input.originalScreenshotRef,
  });
};

async function callLocalVisualMissionModel(input: {
  request: AiAbilityInput;
  signal?: AbortSignal;
  emitDebugEvent?: LocalAiDebugHook;
}) {
  const modelConfig = await loadLocalAiModelConfig();
  const roleConfig = getModelRoleConfig(modelConfig, "vision");
  const adapter = new OllamaRuntimeAdapter();
  const prompt = buildVisualMissionJudgePrompt(input.request.input);
  const imagePaths = resolveImagePaths(input.request);

  if (imagePaths.length === 0) {
    throw new Error("AI visual mission judgment requires at least one governed image input with filePath.");
  }

  await emitPromptPreparedEvent({
    emitDebugEvent: input.emitDebugEvent,
    request: input.request,
    modelName: roleConfig.model,
    prompt,
  });

  const timeoutMs = resolveAiDispatchTimeoutMs(input.request.taskType);
  const rawOutputText = await adapter.invokeVisionTask({
    modelName: roleConfig.model,
    prompt: prompt.fullPrompt,
    imagePaths,
    timeoutMs,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.emitDebugEvent ? { debugHook: input.emitDebugEvent } : {}),
  });

  return {
    adapter,
    modelConfig,
    prompt,
    rawOutputText,
    roleConfig,
    timeoutMs,
  };
}

export { buildHash, callLocalVisualMissionModel };