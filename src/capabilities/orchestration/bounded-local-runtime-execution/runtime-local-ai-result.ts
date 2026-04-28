import {
  CommentSignalTaskResultSchema,
  OcrTaskResultSchema,
  ProductSignalTaskResultSchema,
  VisionTaskResultSchema,
  type LocalAiTaskResult,
} from "../../../types/local-ai.js";
import type { AiAbilityResult } from "../../ai/contract.js";

function extractVisionOutput(result: AiAbilityResult) {
  const output = result.output as Record<string, unknown>;
  return {
    inputMode: output.inputMode,
    multiFrameEvidenceSetId: output.multiFrameEvidenceSetId,
    contactSheetEvidenceId: output.contactSheetEvidenceId,
    frameEvidenceIds: output.frameEvidenceIds,
    screenshotEvidenceId: output.screenshotEvidenceId,
    sampledFrameCount: output.sampledFrameCount,
    validFrameCount: output.validFrameCount,
    expectedFrameCount: output.expectedFrameCount,
    fallbackReason: output.fallbackReason,
    missingFrames: output.missingFrames,
    isProductVideo: output.isProductVideo,
    confidence: output.confidence,
    visibleProductTypes: output.visibleProductTypes,
    evidenceObservations: output.evidenceObservations,
    reason: output.reason,
    frameLevelObservations: output.frameLevelObservations,
    aggregateReason: output.aggregateReason,
    suggestedNextAction: output.suggestedNextAction,
    uncertainty: output.uncertainty,
    mustReview: output.mustReview,
  };
}

export function toRuntimeLocalAiTaskResult(result: AiAbilityResult): LocalAiTaskResult {
  switch (result.taskType) {
    case "product_presence_judgment":
      return VisionTaskResultSchema.parse({
        id: result.runtimeProof.outputRefs[0] ?? `${result.createdAt}:vision`,
        taskType: "vision.productPresence",
        modelRole: "vision",
        provider: "local",
        runtime: result.runtime,
        model: result.modelName,
        implementationStatus: result.implementationStatus,
        promptVersion: result.promptVersion,
        schemaVersion: result.schemaVersion,
        evidenceRefs: result.evidenceRefs,
        confidence: result.confidence ?? 0,
        createdAt: result.createdAt,
        result: {
          taskType: "vision.productPresence",
          promptId: result.promptVersion === "v1" ? "vision.productPresence.v1" : result.promptVersion,
          promptVersion: result.promptVersion,
          schemaVersion: result.schemaVersion,
          ...extractVisionOutput(result),
        },
      });
    case "ocr_cleanup":
      return OcrTaskResultSchema.parse({
        id: result.runtimeProof.outputRefs[0] ?? `${result.createdAt}:ocr`,
        taskType: "comments.ocr_cleanup",
        modelRole: "ocr",
        provider: "local",
        runtime: result.runtime,
        model: result.modelName,
        implementationStatus: result.implementationStatus,
        promptVersion: result.promptVersion,
        schemaVersion: result.schemaVersion,
        evidenceRefs: result.evidenceRefs,
        confidence: result.confidence ?? 0,
        createdAt: result.createdAt,
        result: result.output,
      });
    case "comment_signal_summary":
      return CommentSignalTaskResultSchema.parse({
        id: result.runtimeProof.outputRefs[0] ?? `${result.createdAt}:comment`,
        taskType: "comments.intent_analysis",
        modelRole: "commentUnderstanding",
        provider: "local",
        runtime: result.runtime,
        model: result.modelName,
        implementationStatus: result.implementationStatus,
        promptVersion: result.promptVersion,
        schemaVersion: result.schemaVersion,
        evidenceRefs: result.evidenceRefs,
        confidence: result.confidence ?? 0,
        createdAt: result.createdAt,
        result: result.output,
      });
    case "product_signal_summary":
      return ProductSignalTaskResultSchema.parse({
        id: result.runtimeProof.outputRefs[0] ?? `${result.createdAt}:product`,
        taskType: "product.signal_summary",
        modelRole: "productSignal",
        provider: "local",
        runtime: result.runtime,
        model: result.modelName,
        implementationStatus: result.implementationStatus,
        promptVersion: result.promptVersion,
        schemaVersion: result.schemaVersion,
        evidenceRefs: result.evidenceRefs,
        confidence: result.confidence ?? 0,
        createdAt: result.createdAt,
        result: result.output,
      });
    default:
      throw new Error(`Mission runtime cannot translate ${result.taskType} into the current LocalAiTaskResult storage shape.`);
  }
}