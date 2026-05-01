import {
  AiCommentSignalSummaryInputSchema,
  AiOcrCleanupInputSchema,
  AiProductSignalSummaryInputSchema,
  AiRuntimeHealthSchema,
  AiVisionRequestInputSchema,
} from "../schema.js";
import {
  CommentSignalTaskRequestSchema,
  OcrTaskRequestSchema,
  ProductSignalTaskRequestSchema,
  VisionTaskRequestSchema,
  type LocalAiHealth,
  type LocalAiTaskRequest,
  type LocalAiTaskType,
} from "../../../types/local-ai.js";
import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import type { AiRuntimeHealth, AiTaskType, ParsedAiAbilityInput } from "../contract.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";

const AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.productPresence": "product_presence_judgment",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

type VisionBridgeInput = Extract<
  ParsedAiAbilityInput,
  { taskType: "product_presence_judgment" | "visual_observation" | "visual_target_candidate_analysis" }
>;

type OcrBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "ocr_cleanup" }>;
type CommentSignalBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "comment_signal_summary" }>;
type ProductSignalBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "product_signal_summary" }>;

function buildVisionTaskRequest(input: VisionBridgeInput): LocalAiTaskRequest {
  return VisionTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "vision.productPresence",
    modelRole: "vision",
    promptVersion: "v1",
    schemaVersion: "vision.productPresence.schema.v1",
    evidenceRefs: input.inputRefs,
    input: VisionProductPresenceRequestInputSchema.parse(AiVisionRequestInputSchema.parse(input.input)),
  });
}

function buildOcrTaskRequest(input: OcrBridgeInput): LocalAiTaskRequest {
  return OcrTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "comments.ocr_cleanup",
    modelRole: "ocr",
    promptVersion: "comments.ocr_cleanup.v1",
    schemaVersion: "ocr-text.v1",
    evidenceRefs: input.inputRefs,
    input: AiOcrCleanupInputSchema.parse(input.input),
  });
}

function buildCommentSignalTaskRequest(input: CommentSignalBridgeInput): LocalAiTaskRequest {
  return CommentSignalTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "comments.intent_analysis",
    modelRole: "commentUnderstanding",
    promptVersion: "comments.intent_analysis.v1",
    schemaVersion: "comment-signal.v1",
    evidenceRefs: input.inputRefs,
    input: AiCommentSignalSummaryInputSchema.parse(input.input),
  });
}

function buildProductSignalTaskRequest(input: ProductSignalBridgeInput): LocalAiTaskRequest {
  const typedInput = AiProductSignalSummaryInputSchema.parse(input.input);
  return ProductSignalTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "product.signal_summary",
    modelRole: "productSignal",
    promptVersion: "product.signal_summary.v1",
    schemaVersion: "product-opportunity-candidate.v1",
    evidenceRefs: input.inputRefs,
    input: {
      videoSummary: typedInput.videoSummary,
      productPresence: {
        taskType: "vision.productPresence",
        promptId: "vision.productPresence.v1",
        promptVersion: "v1",
        schemaVersion: "vision.productPresence.schema.v1",
        ...typedInput.productPresence,
      },
      commentSignals: typedInput.commentSignals,
    },
  });
}

function describeHealth(health: AiRuntimeHealth): string {
  return JSON.stringify({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: health.dependencies,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function toAiRuntimeHealth(health: LocalAiHealth): AiRuntimeHealth {
  return AiRuntimeHealthSchema.parse({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: {
      gateway: health.ollamaStatus,
      vision: health.visionModelStatus,
      text: health.textModelStatus,
      ocr: health.ocrStatus,
    },
    configuredModels: health.configuredModels,
    availableModels: health.availableModels,
    lastCheckedAt: health.lastCheckedAt,
    failureReason: health.failureReason,
    lastTaskType: health.lastTaskType ? AI_TASK_BY_LEGACY[health.lastTaskType] : null,
    lastFailureReason: health.lastFailureReason,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function coerceRuntimeOutput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = parseExtractedJson(value);
  return parsed.ok ? parsed.value : value;
}

function toLocalAiTaskRequest(input: ParsedAiAbilityInput): { ok: true; request: LocalAiTaskRequest } | { ok: false; message: string } {
  switch (input.taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis":
      return { ok: true, request: buildVisionTaskRequest(input) };
    case "ocr_cleanup":
      return { ok: true, request: buildOcrTaskRequest(input) };
    case "comment_signal_summary":
      return { ok: true, request: buildCommentSignalTaskRequest(input) };
    case "product_signal_summary":
      return { ok: true, request: buildProductSignalTaskRequest(input) };
  }

  return {
    ok: false,
    message: `Local AI runtime adapter is not authorized to execute ${input.taskType}.`,
  };
}

export {
  describeHealth,
  toAiRuntimeHealth,
  coerceRuntimeOutput,
  toLocalAiTaskRequest,
};