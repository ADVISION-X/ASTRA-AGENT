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

type OnlineVisualMissionCallState = {
  config: Awaited<ReturnType<typeof loadOnlineAiProviderConfig>>;
  prompt: ReturnType<typeof buildVisualMissionJudgePrompt>;
  imagePaths: string[];
  timeoutMs: number;
  logger?: RuntimeLogger;
  trace?: TraceContext;
  spanId: string;
  promptHash: string;
  configHash: string;
};

async function buildOnlineVisualMissionCallState(input: {
  dataDir: string;
  request: AiAbilityInput;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
}): Promise<OnlineVisualMissionCallState> {
  const config = await loadOnlineAiProviderConfig(input.dataDir);
  const prompt = buildVisualMissionJudgePrompt(input.request.input);
  const imagePaths = resolveImagePaths(input.request);
  if (imagePaths.length === 0) {
    throw new Error("AI visual mission judgment requires at least one governed image input with filePath.");
  }
  return {
    config,
    prompt,
    imagePaths,
    timeoutMs: resolveAiDispatchTimeoutMs(input.request.taskType),
    ...(input.runtimeLogger ? { logger: input.runtimeLogger } : {}),
    ...(input.traceContext ? { trace: input.traceContext } : {}),
    spanId: randomUUID(),
    promptHash: buildHash(prompt.fullPrompt),
    configHash: buildHash(JSON.stringify(config)),
  };
}

function emitOnlineAiRequestDebug(state: OnlineVisualMissionCallState, request: AiAbilityInput): void {
  state.logger?.emit({
    eventType: RuntimeLogEventType.AI_REQUEST_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "ai-capability",
    traceId: state.trace?.traceId ?? request.missionId ?? "no-trace",
    spanId: state.spanId,
    ...(request.missionId ? { missionId: request.missionId } : {}),
    hashes: { promptHash: state.promptHash, modelConfigHash: state.configHash },
    preview: {
      promptPreview: state.prompt.fullPrompt.slice(0, 200).replace(/\s+/g, " ").trim(),
      promptContractId: request.promptContractId,
    },
    refs: { modelName: state.config.modelName, runtimeName: "gemini-api", imagePaths: state.imagePaths.join(";") },
    metrics: { imageCount: state.imagePaths.length, timeoutMs: state.timeoutMs, promptLength: state.prompt.fullPrompt.length },
  });
}

function buildOnlineVisualMissionModelResult(
  state: OnlineVisualMissionCallState,
  result: Awaited<ReturnType<typeof invokeGemini>>,
) {
  return {
    rawOutputText: result.rawText,
    prompt: state.prompt,
    modelName: result.modelName,
    runtime: "gemini-api",
    timeoutMs: state.timeoutMs,
    promptVersion: "v1",
    modelConfig: {
      providerCompany: state.config.providerCompany,
      providerKind: state.config.providerKind,
      modelName: state.config.modelName,
      endpoint: state.config.endpoint,
    },
    promptHash: state.promptHash,
    configHash: state.configHash,
    runtimeCallId: result.runtimeCallId,
    spanId: state.spanId,
    ...(state.trace?.traceId ? { traceId: state.trace.traceId } : {}),
  };
}

async function callOnlineVisualMissionModel(input: {
  dataDir: string;
  request: AiAbilityInput;
  signal?: AbortSignal;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
}) {
  const state = await buildOnlineVisualMissionCallState(input);
  emitOnlineAiRequestDebug(state, input.request);

  const result = await invokeGemini({
    config: state.config,
    ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
    ...(input.request.roundId ? { roundId: input.request.roundId } : {}),
    promptText: state.prompt.fullPrompt,
    imagePaths: state.imagePaths,
    timeoutMs: state.timeoutMs,
    responseSchema: GeminiVisualMissionResponseSchema,
    ...(input.signal ? { abortSignal: input.signal } : {}),
    ...(state.logger ? { runtimeLogger: state.logger } : {}),
    ...(state.trace ? { traceContext: { ...state.trace, spanId: state.spanId } } : {}),
  });

  return buildOnlineVisualMissionModelResult(state, result);
}

export { buildHash, callOnlineVisualMissionModel };
export type { RuntimeLogger, TraceContext };
