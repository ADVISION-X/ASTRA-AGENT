import { z } from "zod";

import {
  CommentSignalPayloadSchema,
  CommentSignalTaskResultSchema,
  OcrTaskResultSchema,
  VisionTaskResultSchema,
  type LocalAiTaskRequest,
  type LocalAiTaskResult,
  type OcrCleanupPayload,
} from "../../types/local-ai.js";
import type { LocalModelRoleConfig } from "./model-config.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import type { LocalAiDebugHook, LocalAiRuntimeAdapter } from "./runtime-adapters/local-ai-runtime-adapter.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { getPromptContract } from "./prompt-registry.js";
import { parseVisionRuntimeOutput } from "./local-ai-runtime-vision.js";
import { buildVisionPrompt } from "./local-ai-runtime-vision-prompt.js";

const MODEL_TIMEOUT_MS = {
  text: 30_000,
  ocr: 30_000,
} as const;

const buildCommentPrompt = (request: Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>): string => {
  const contract = getPromptContract(request.taskType);
  return [
    contract.purpose,
    "Analyze the cleaned comments and return JSON only.",
    `Schema: ${JSON.stringify({ purchaseIntent: "low|medium|high", painPoints: ["string"], complaints: ["string"], demandTerms: ["string"], confidence: "0..1" })}`,
    `Forbidden outputs: ${contract.forbiddenOutputs.join("; ")}`,
    `Comments: ${JSON.stringify(request.input.cleanedComments)}`,
  ].join("\n\n");
};

const parseRuntimeJsonOutput = (text: string, taskType: string): unknown => {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for ${taskType}: ${message}`, text);
  }
};

const toJsonPayload = <TOutput>(text: string, schema: z.ZodSchema<TOutput>, taskType: string): TOutput => {
  const parsed = parseRuntimeJsonOutput(text, taskType);
  try {
    return schema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI output failed schema validation for ${taskType}: ${message}`, extractFirstJsonObject(text));
  }
};

const normalizeOcrText = (ocrText: string): OcrCleanupPayload => {
  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const cleanedComments = lines.filter((line) => /[\p{L}\p{N}]/u.test(line));
  const uncertainText = lines.filter((line) => line.length > 0 && line.length < 3);
  const confidence = cleanedComments.length > 0 ? Math.min(0.95, 0.4 + cleanedComments.length * 0.08) : 0.1;
  return {
    cleanedComments: cleanedComments.length > 0 ? cleanedComments : [ocrText.trim()].filter((line) => line.length > 0),
    uncertainText,
    confidence,
  };
};

type RuntimeExecutionInput = {
  request: LocalAiTaskRequest;
  roleConfig: LocalModelRoleConfig;
  ollamaAdapter: LocalAiRuntimeAdapter;
  ocrAdapter: LocalAiRuntimeAdapter;
  debugHook?: LocalAiDebugHook;
};

const truncatePreview = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

async function executeVisionRuntimeTask(
  input: RuntimeExecutionInput,
  createdAt: string,
): Promise<LocalAiTaskResult> {
  const request = input.request as Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;
  const imagePaths = request.evidenceRefs.map((ref) => ref.filePath).filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);
  const prompt = buildVisionPrompt(request);
  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${prompt.length}; imageCount=${imagePaths.length}`,
  });
  const responseText = await input.ollamaAdapter.invokeVisionTask({
    modelName: input.roleConfig.model,
    prompt,
    imagePaths,
    timeoutMs: 60_000,
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const visionOutput = parseVisionRuntimeOutput(responseText, request);
  if (visionOutput.adjusted) {
    await input.debugHook?.({
      eventType: "local_ai_output_normalized",
      detail: `taskType=${request.taskType}; normalizedFrameLevelObservations=${visionOutput.normalizedFrameCount}`,
    });
  }
  const payload = visionOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; isProductVideo=${String(payload.isProductVideo)}; reason=${truncatePreview(payload.reason)}`,
  });
  return VisionTaskResultSchema.parse({
    id: request.id,
    taskType: request.taskType,
    modelRole: request.modelRole,
    provider: "local",
    runtime: input.roleConfig.runtime,
    model: input.roleConfig.model,
    implementationStatus: "model_backed",
    promptVersion: request.promptVersion,
    schemaVersion: request.schemaVersion,
    evidenceRefs: request.evidenceRefs,
    confidence: payload.confidence,
    createdAt,
    result: payload,
  });
}

async function executeOcrCleanupRuntimeTask(
  input: RuntimeExecutionInput,
  createdAt: string,
): Promise<LocalAiTaskResult> {
  const request = input.request as Extract<LocalAiTaskRequest, { taskType: "comments.ocr_cleanup" }>;
  const imagePath = request.evidenceRefs.find((ref) => typeof ref.filePath === "string")?.filePath;
  if (!imagePath) {
    throw new LocalAiRuntimeError("missing_evidence", "OCR cleanup requires screenshot evidence with a file path.");
  }
  const ocrText = await input.ocrAdapter.invokeOcrTask({
    toolName: input.roleConfig.model,
    imagePath,
    timeoutMs: MODEL_TIMEOUT_MS.ocr,
  });
  const payload = normalizeOcrText(ocrText);
  return OcrTaskResultSchema.parse({
    id: request.id,
    taskType: request.taskType,
    modelRole: request.modelRole,
    provider: "local",
    runtime: input.roleConfig.runtime,
    model: input.roleConfig.model,
    implementationStatus: "model_backed",
    promptVersion: request.promptVersion,
    schemaVersion: request.schemaVersion,
    evidenceRefs: request.evidenceRefs,
    confidence: payload.confidence,
    createdAt,
    result: payload,
  });
}

async function executeCommentSignalRuntimeTask(input: RuntimeExecutionInput, createdAt: string): Promise<LocalAiTaskResult> {
  const responseText = await input.ollamaAdapter.invokeTextTask({
    modelName: input.roleConfig.model,
    prompt: buildCommentPrompt(input.request as Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>),
    timeoutMs: MODEL_TIMEOUT_MS.text,
  });
  const payload = toJsonPayload(responseText, CommentSignalPayloadSchema, input.request.taskType);
  return CommentSignalTaskResultSchema.parse({
    id: input.request.id,
    taskType: input.request.taskType,
    modelRole: input.request.modelRole,
    provider: "local",
    runtime: input.roleConfig.runtime,
    model: input.roleConfig.model,
    implementationStatus: "model_backed",
    promptVersion: input.request.promptVersion,
    schemaVersion: input.request.schemaVersion,
    evidenceRefs: input.request.evidenceRefs,
    confidence: payload.confidence,
    createdAt,
    result: payload,
  });
}

export async function executeRuntimeTask(input: {
  request: LocalAiTaskRequest;
  roleConfig: LocalModelRoleConfig;
  ollamaAdapter: LocalAiRuntimeAdapter;
  ocrAdapter: LocalAiRuntimeAdapter;
  debugHook?: LocalAiDebugHook;
}): Promise<LocalAiTaskResult> {
  const createdAt = new Date().toISOString();
  if (input.request.taskType === "product.signal_summary") {
    throw new LocalAiRuntimeError("disabled_by_policy", "product.signal_summary is not allowed in phase-03 runtime flow.");
  }

  if (input.request.taskType === "vision.productPresence") {
    return executeVisionRuntimeTask({
      ...input,
      request: input.request,
    }, createdAt);
  }

  if (input.request.taskType === "comments.ocr_cleanup") {
    return executeOcrCleanupRuntimeTask({
      ...input,
      request: input.request,
    }, createdAt);
  }

  return executeCommentSignalRuntimeTask(input, createdAt);
}