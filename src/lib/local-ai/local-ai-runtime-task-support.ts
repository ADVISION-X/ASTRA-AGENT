import { createHash } from "node:crypto";
import { z } from "zod";

import type {
  CommentSignalPayloadSchema,
  LocalAiTaskRequest,
  OcrCleanupPayload,
} from "../../types/local-ai.js";
import type { LocalModelRoleConfig } from "./model-config.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import type { LocalAiDebugHook, LocalAiRuntimeAdapter } from "./runtime-adapters/local-ai-runtime-adapter.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { getPromptContract } from "./prompt-registry.js";

const MODEL_TIMEOUT_MS = {
  text: 30_000,
  ocr: 30_000,
} as const;

type RuntimeExecutionInput = {
  request: LocalAiTaskRequest;
  roleConfig: LocalModelRoleConfig;
  ollamaAdapter: LocalAiRuntimeAdapter;
  ocrAdapter: LocalAiRuntimeAdapter;
  signal?: AbortSignal;
  debugHook?: LocalAiDebugHook;
};

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isFullAiIoDebugEnabled(): boolean {
  return process.env.GRASSEYE_DEBUG_AI_IO === "full";
}

function truncatePreview(value: string, maxLength = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function buildPromptPreview(value: string): string {
  return truncatePreview(value, 320);
}

function parseRuntimeJsonOutput(text: string, taskType: string): unknown {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for ${taskType}: ${message}`, text);
  }
}

function toJsonPayload<TOutput>(text: string, schema: z.ZodSchema<TOutput>, taskType: string): TOutput {
  const parsed = parseRuntimeJsonOutput(text, taskType);
  try {
    return schema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI output failed schema validation for ${taskType}: ${message}`, extractFirstJsonObject(text));
  }
}

function normalizeOcrText(ocrText: string): OcrCleanupPayload {
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
}

function buildCommentPromptParts(request: Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>) {
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
}


export { MODEL_TIMEOUT_MS, hashText, isFullAiIoDebugEnabled, truncatePreview, buildPromptPreview, parseRuntimeJsonOutput, toJsonPayload, normalizeOcrText, buildCommentPromptParts };
export type { RuntimeExecutionInput };
