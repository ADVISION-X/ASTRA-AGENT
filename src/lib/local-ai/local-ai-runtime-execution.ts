import { createHash } from "node:crypto";

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
import { buildVisionPromptParts } from "./local-ai-runtime-vision-prompt.js";

const MODEL_TIMEOUT_MS = {
  text: 30_000,
  ocr: 30_000,
} as const;

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isFullAiIoDebugEnabled(): boolean {
  return process.env.GRASSEYE_DEBUG_AI_IO === "full";
}

function buildPromptPreview(value: string): string {
  return truncatePreview(value, 320);
}

const buildCommentPromptParts = (request: Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>) => {
  const contract = getPromptContract(request.taskType);
  const userPrompt = [
    "Analyze the cleaned comments and return JSON only.",
    `Schema: ${JSON.stringify({ purchaseIntent: "low|medium|high", painPoints: ["string"], complaints: ["string"], demandTerms: ["string"], confidence: "0..1" })}`,
    `Forbidden outputs: ${contract.forbiddenOutputs.join("; ")}`,
    `Comments: ${JSON.stringify(request.input.cleanedComments)}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.purpose,
    userPrompt,
    fullPrompt: [contract.purpose, userPrompt].join("\n\n"),
  };
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
  const promptParts = buildVisionPromptParts(request);
  const prompt = promptParts.fullPrompt;
  const promptFullText = isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined;
  const sourceScreenshotEvidenceId = typeof request.input.screenshotEvidenceId === "string" ? request.input.screenshotEvidenceId : undefined;
  const aiInputArtifactRef = request.input.contactSheetEvidenceId ?? request.input.multiFrameEvidenceSetId ?? request.evidenceRefs[0]?.id;
  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${prompt.length}; imageCount=${imagePaths.length}`,
    taskType: request.taskType,
    promptContractId: "vision.productPresence.v1",
    promptVersion: request.promptVersion,
    outputSchemaRef: request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: request.modelRole,
    runtime: input.roleConfig.runtime,
    systemPromptText: promptParts.systemPrompt,
    userPromptText: promptParts.userPrompt,
    systemPromptHash: hashText(promptParts.systemPrompt),
    userPromptHash: hashText(promptParts.userPrompt),
    promptPreview: buildPromptPreview(promptParts.fullPrompt),
    ...(promptFullText ? { promptFullText } : {}),
    ...(sourceScreenshotEvidenceId ? { sourceScreenshotEvidenceId } : {}),
    ...(aiInputArtifactRef ? { aiInputArtifactRef } : {}),
    imageInputs: request.evidenceRefs.map((ref) => ({
      refId: ref.id,
      filePath: ref.filePath ?? "",
    })),
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
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.isProductVideo === true ? "product_yes" : payload.isProductVideo === false ? "product_no" : "product_uncertain",
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
  const ocrInputArtifactRef = request.evidenceRefs[0]?.id;
  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=${MODEL_TIMEOUT_MS.ocr}; imageCount=1`,
    taskType: request.taskType,
    promptContractId: request.promptVersion,
    promptVersion: request.promptVersion,
    outputSchemaRef: request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: request.modelRole,
    runtime: input.roleConfig.runtime,
    ...(ocrInputArtifactRef ? { aiInputArtifactRef: ocrInputArtifactRef } : {}),
    imageInputs: request.evidenceRefs.map((ref) => ({
      refId: ref.id,
      filePath: ref.filePath ?? "",
    })),
  });
  const ocrText = await input.ocrAdapter.invokeOcrTask({
    toolName: input.roleConfig.model,
    imagePath,
    timeoutMs: MODEL_TIMEOUT_MS.ocr,
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const payload = normalizeOcrText(ocrText);
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; cleanedComments=${payload.cleanedComments.length}; uncertainText=${payload.uncertainText.length}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.cleanedComments.length > 0 ? "ocr_cleaned" : "ocr_empty",
  });
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
  const request = input.request as Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>;
  const promptParts = buildCommentPromptParts(request);
  const promptFullText = isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined;
  const aiInputArtifactRef = request.evidenceRefs[0]?.id;
  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=${MODEL_TIMEOUT_MS.text}; commentCount=${request.input.cleanedComments.length}`,
    taskType: request.taskType,
    promptContractId: request.promptVersion,
    promptVersion: request.promptVersion,
    outputSchemaRef: request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: request.modelRole,
    runtime: input.roleConfig.runtime,
    systemPromptText: promptParts.systemPrompt,
    userPromptText: promptParts.userPrompt,
    systemPromptHash: hashText(promptParts.systemPrompt),
    userPromptHash: hashText(promptParts.userPrompt),
    promptPreview: buildPromptPreview(promptParts.fullPrompt),
    ...(promptFullText ? { promptFullText } : {}),
    ...(aiInputArtifactRef ? { aiInputArtifactRef } : {}),
  });
  const responseText = await input.ollamaAdapter.invokeTextTask({
    modelName: input.roleConfig.model,
    prompt: promptParts.fullPrompt,
    timeoutMs: MODEL_TIMEOUT_MS.text,
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const payload = toJsonPayload(responseText, CommentSignalPayloadSchema, input.request.taskType);
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; purchaseIntent=${payload.purchaseIntent}; confidence=${payload.confidence}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.purchaseIntent,
  });
  return CommentSignalTaskResultSchema.parse({
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