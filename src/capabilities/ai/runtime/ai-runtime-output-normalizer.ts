import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import type { AiAbilityInput, AiAbilityResult, AiTaskType } from "../contract.js";

type AiGatewayExecutionResult = {
  taskType: AiTaskType;
  result: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function toPublicAiOutput(result: AiGatewayExecutionResult): unknown {
  if (
    !["product_presence_judgment", "visual_observation", "visual_target_candidate_analysis"].includes(result.taskType)
    || !isRecord(result.result)
  ) {
    return result.result;
  }

  const { taskType: _taskType, promptId: _promptId, promptVersion: _promptVersion, schemaVersion: _schemaVersion, ...output } = result.result;
  return output;
}

export function buildDefaultAiOutput(input: AiAbilityInput, reason: string): AiAbilityResult["output"] {
  switch (input.taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis": {
      const visionInput = VisionProductPresenceRequestInputSchema.parse(input.input);
      return {
        inputMode: visionInput.inputMode,
        multiFrameEvidenceSetId: visionInput.multiFrameEvidenceSetId,
        contactSheetEvidenceId: visionInput.contactSheetEvidenceId,
        frameEvidenceIds: visionInput.frameEvidenceIds,
        screenshotEvidenceId: visionInput.screenshotEvidenceId,
        sampledFrameCount: visionInput.sampledFrameCount,
        validFrameCount: visionInput.validFrameCount,
        expectedFrameCount: visionInput.expectedFrameCount,
        fallbackReason: visionInput.fallbackReason,
        missingFrames: visionInput.missingFrames,
        isProductVideo: null,
        confidence: 0,
        visibleProductTypes: [],
        evidenceObservations: [],
        reason,
        frameLevelObservations: [],
        aggregateReason: reason,
        suggestedNextAction: "review_required",
        uncertainty: [reason],
        mustReview: true,
      };
    }
    case "ocr_cleanup":
      return { cleanedComments: [], uncertainText: [reason], confidence: 0 };
    case "comment_signal_summary":
      return { purchaseIntent: "low", painPoints: [], complaints: [], demandTerms: [], confidence: 0 };
    case "product_signal_summary":
      return {
        category: "unavailable",
        useCase: "unavailable",
        sellingPoints: [],
        painPoints: [],
        purchaseIntent: "low",
        risk: "high",
        score: 0,
        rationale: reason,
      };
    case "evidence_packet_analysis":
      return { summary: reason, notableEvidenceRefs: [], reviewNotes: [reason] };
    case "schema_validation_only":
      return { valid: false, issues: [reason] };
  }
}