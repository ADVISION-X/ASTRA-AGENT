import { AiRuntimeHealthSchema } from "../schema.js";
import type { AiRuntimeHealth, AiTaskType } from "../contract.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import type { LocalAiHealth, LocalAiTaskType } from "../../../types/local-ai.js";

const AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.pagePreparation": "page_preparation_judgment",
  "vision.nextItemAdvanced": "page_preparation_judgment",
  "vision.productPresence": "product_presence_judgment",
  "vision.visualMissionActionPlan": "visual_mission_action_plan",
  "vision.nextItemTargetCandidate": "visual_target_candidate_analysis",
  "vision.commentsEntryTargetCandidate": "visual_target_candidate_analysis",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

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

export {
  describeHealth,
  toAiRuntimeHealth,
  coerceRuntimeOutput,
};