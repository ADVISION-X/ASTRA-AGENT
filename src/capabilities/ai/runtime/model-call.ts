import { createHash, randomUUID } from "node:crypto";

import { GeminiVisualMissionResponseSchema, invokeGemini, loadOnlineAiProviderConfig } from "../../../lib/online-ai/index.js";
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

async function callOnlineVisualMissionModel(input: {
  dataDir: string;
  request: AiAbilityInput;
  signal?: AbortSignal;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
}) {
  const config = await loadOnlineAiProviderConfig(input.dataDir);
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
    traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
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
      runtimeName: "gemini-api",
      imagePaths: imagePaths.join(";"),
    },
    metrics: {
      imageCount: imagePaths.length,
      timeoutMs,
      promptLength: prompt.fullPrompt.length,
    },
  });

  const result = await invokeGemini({
    config,
    ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
    ...(input.request.roundId ? { roundId: input.request.roundId } : {}),
    promptText: prompt.fullPrompt,
    imagePaths,
    timeoutMs,
    responseSchema: GeminiVisualMissionResponseSchema,
    ...(input.signal ? { abortSignal: input.signal } : {}),
    ...(logger ? { runtimeLogger: logger } : {}),
    ...(trace ? { traceContext: { ...trace, spanId } } : {}),
  });

  return {
    rawOutputText: result.rawText,
    prompt,
    modelName: result.modelName,
    runtime: "gemini-api",
    timeoutMs,
    promptVersion: "v1",
    modelConfig: {
      providerCompany: config.providerCompany,
      providerKind: config.providerKind,
      modelName: config.modelName,
      endpoint: config.endpoint,
    },
    promptHash: buildHash(prompt.fullPrompt),
    configHash,
    runtimeCallId: result.runtimeCallId,
    spanId,
    ...(trace?.traceId ? { traceId: trace.traceId } : {}),
  };
}

export { buildHash, callOnlineVisualMissionModel };
export type { RuntimeLogger, TraceContext };
