import { createHash, randomUUID } from "node:crypto";

import { callLocalModel, loadLocalAiConfig } from "../../../lib/local-ai/index.js";
import type { AiAbilityInput } from "../contract.js";
import { resolveAiDispatchTimeoutMs } from "../registry.js";
import { buildVisualMissionJudgePrompt } from "../prompt/visual-mission-judge-prompt.js";
import type { RuntimeLogger, TraceContext } from "../../../lib/runtime-logs/index.js";
import { RuntimeLogEventType } from "../../../lib/runtime-logs/index.js";

const buildHash = (value: string) => createHash("sha256").update(value).digest("hex");

const resolveImagePaths = (input: AiAbilityInput) =>
  input.inputRefs
    .map((entry) => entry.filePath)
    .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);

async function callLocalVisualMissionModel(input: {
  request: AiAbilityInput;
  signal?: AbortSignal;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
}) {
  const config = await loadLocalAiConfig();
  const prompt = buildVisualMissionJudgePrompt(input.request.input);
  const imagePaths = resolveImagePaths(input.request);
  const timeoutMs = resolveAiDispatchTimeoutMs(input.request.taskType);
  const logger = input.runtimeLogger;
  const trace = input.traceContext;
  const spanId = randomUUID();

  if (imagePaths.length === 0) {
    throw new Error("AI visual mission judgment requires at least one governed image input with filePath.");
  }

  const promptHash = buildHash(prompt.fullPrompt);
  const configHash = buildHash(JSON.stringify(config));

  // ── AI_REQUEST_DEBUG ──────────────────────────────────────────────────────
  logger?.emit({
    eventType: RuntimeLogEventType.AI_REQUEST_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "ai-capability",
    traceId: trace?.traceId ?? randomUUID(),
    spanId,
    ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
    hashes: {
      promptHash,
      modelConfigHash: configHash,
    },
    preview: {
      promptPreview: prompt.fullPrompt.slice(0, 200).replace(/\s+/g, " ").trim(),
      promptContractId: input.request.promptContractId,
    },
    refs: {
      modelName: config.modelName,
      runtimeName: config.runtimeName,
      imagePaths: imagePaths.join(";"),
    },
    metrics: {
      imageCount: imagePaths.length,
      timeoutMs,
      promptLength: prompt.fullPrompt.length,
    },
  });

  const result = await callLocalModel({
    requestId: input.request.missionId ?? "unknown",
    ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
    promptText: prompt.fullPrompt,
    imagePaths,
    timeoutMs,
    ...(input.signal ? { abortSignal: input.signal } : {}),
    ...(logger ? { runtimeLogger: logger } : {}),
    ...(trace ? { traceContext: { ...trace, spanId } } : {}),
  });

  if (result.status === "failed") {
    // ── AI_ERROR_DEBUG (model layer failure) ─────────────────────────────
    logger?.emit({
      eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
      level: "error",
      modeVisibility: ["DEBUG", "TRACE"],
      owner: "ai-capability",
      traceId: trace?.traceId ?? randomUUID(),
      spanId,
      ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
      status: "failed",
      reason: "model_call_failed",
      actionableMessage: result.failureReason,
    });
    throw new Error(result.failureReason);
  }

  if (result.status === "review_required") {
    // ── AI_ERROR_DEBUG (review required) ─────────────────────────────────
    logger?.emit({
      eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
      level: "warn",
      modeVisibility: ["DEBUG", "TRACE"],
      owner: "ai-capability",
      traceId: trace?.traceId ?? randomUUID(),
      spanId,
      ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
      status: "review_required",
      reason: "model_call_review_required",
      actionableMessage: result.reviewRequiredReason,
    });
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
    promptHash: buildHash(prompt.fullPrompt),
    configHash,
    spanId,
    ...(trace?.traceId ? { traceId: trace.traceId } : {}),
  };
}

export { buildHash, callLocalVisualMissionModel };
export type { RuntimeLogger, TraceContext };