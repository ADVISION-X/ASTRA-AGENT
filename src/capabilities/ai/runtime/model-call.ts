import { createHash, randomUUID } from "node:crypto";

import { callLocalModel, loadLocalAiConfig } from "../../../lib/local-ai/index.js";
import type { AiAbilityInput } from "../contract.js";
import { resolveAiDispatchTimeoutMs } from "../registry.js";
import { buildVisualMissionJudgePrompt } from "../prompt/visual-mission-judge-prompt.js";
import type { RuntimeLogger, TraceContext } from "../../../lib/runtime-logs/index.js";
import { RuntimeLogEventType } from "../../../lib/runtime-logs/index.js";

const buildHash = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * JSON Schema for VisualMissionActionPlanOutput.
 * Passed to Ollama as `format` for grammar-constrained structured output.
 * Ollama uses this to force the model to generate tokens that match the exact schema structure.
 * This is strictly stronger than format:"json" — it constrains both syntax AND structure.
 * Derived from VisualMissionActionPlanOutputSchema (src/visual-mission/action-plan/ai-output.schema.ts).
 * Must be kept in sync with the Zod schema when fields are added/removed.
 */
const VISUAL_MISSION_OUTPUT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["visualMissionActionPlan.v1"] },
    userIntentUnderstanding: {
      type: "object",
      properties: {
        matched: { type: "boolean" },
        summary: { type: "string" },
      },
      required: ["matched", "summary"],
    },
    platform: { type: "string", enum: ["facebook-web", "tiktok-web"] },
    isTargetPlatform: { type: "boolean" },
    surface: { type: "string" },
    isTargetFeed: { type: "boolean" },
    pageStateDecision: { type: "string", enum: ["ready", "recover", "review_required", "blocked"] },
    isProductVideo: { type: "boolean" },
    productDecision: { type: "string", enum: ["product_yes", "product_no", "uncertain"] },
    confidence: { type: "number" },
    visibleProductTypes: { type: "array", items: { type: "string" } },
    visualEvidence: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          actionCode: { type: "string" },
          required: { type: "boolean" },
          targetRole: { type: ["string", "null"] },
          input: {
            type: "object",
            properties: {
              gridCell: { type: "string" },
              cellZone: {
                type: "string",
                enum: [
                  "top_left",
                  "top_center",
                  "top_right",
                  "middle_left",
                  "center",
                  "middle_right",
                  "bottom_left",
                  "bottom_center",
                  "bottom_right",
                ],
              },
            },
          },
          reason: { type: "string" },
        },
        required: ["actionCode", "reason"],
      },
    },
    nonExecutableClickTargets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          gridCell: { type: "string" },
          targetName: { type: "string" },
        },
        required: ["gridCell", "targetName"],
      },
    },
    riskFlags: { type: "array", items: { type: "string" } },
    nonExecutableSummary: { type: "string" },
  },
  required: [
    "schemaVersion",
    "userIntentUnderstanding",
    "platform",
    "isTargetPlatform",
    "surface",
    "isTargetFeed",
    "pageStateDecision",
    "isProductVideo",
    "productDecision",
    "confidence",
    "visualEvidence",
    "reason",
    "actions",
    "nonExecutableSummary",
  ],
};

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
    // outputSchema intentionally not passed: grammar-constrained decoding crashes Metal backend.
    // See VISUAL_MISSION_OUTPUT_JSON_SCHEMA above for the governed schema (future use).
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
      traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
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
      traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
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
