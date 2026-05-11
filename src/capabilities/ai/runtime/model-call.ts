import { createHash } from "node:crypto";

import { callLocalModel, loadLocalAiConfig } from "../../../lib/local-ai/index.js";
import type { LocalAiDebugHook } from "../../../lib/local-ai/index.js";
import type { AiAbilityInput } from "../contract.js";
import { resolveAiDispatchTimeoutMs } from "../registry.js";
import { buildVisualMissionJudgePrompt } from "../prompt/visual-mission-judge-prompt.js";

const buildHash = (value: string) => createHash("sha256").update(value).digest("hex");

const resolveImagePaths = (input: AiAbilityInput) =>
  input.inputRefs
    .map((entry) => entry.filePath)
    .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);

async function callLocalVisualMissionModel(input: {
  request: AiAbilityInput;
  signal?: AbortSignal;
  emitDebugEvent?: LocalAiDebugHook;
}) {
  const config = await loadLocalAiConfig();
  const prompt = buildVisualMissionJudgePrompt(input.request.input);
  const imagePaths = resolveImagePaths(input.request);
  const timeoutMs = resolveAiDispatchTimeoutMs(input.request.taskType);

  if (imagePaths.length === 0) {
    throw new Error("AI visual mission judgment requires at least one governed image input with filePath.");
  }

  await input.emitDebugEvent?.({
    eventType: "ai_prompt_prepared",
    detail: `Prepared visual mission judgment prompt for ${input.request.missionId}.`,
    modelName: config.modelName,
    runtimeName: config.runtimeName,
  });

  const result = await callLocalModel({
    requestId: input.request.missionId ?? "unknown",
    ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
    promptText: prompt.fullPrompt,
    imagePaths,
    timeoutMs,
    ...(input.signal ? { abortSignal: input.signal } : {}),
    ...(input.emitDebugEvent ? { debugHook: input.emitDebugEvent } : {}),
  });

  if (result.status === "failed") {
    throw new Error(result.failureReason);
  }

  if (result.status === "review_required") {
    throw new Error(result.reviewRequiredReason);
  }

  return {
    rawOutputText: result.rawText,
    prompt,
    modelName: result.modelName,
    runtime: result.runtimeName,
    timeoutMs,
    promptVersion: "v1",
    modelConfig: config,
  };
}

export { buildHash, callLocalVisualMissionModel };