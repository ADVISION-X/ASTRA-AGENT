import type { z } from "zod";

import type {
  AiAbilityInput,
  AiCommentSignalSummaryOutput,
  AiEvidencePacketAnalysisOutput,
  AiOcrCleanupOutput,
  AiProductSignalSummaryOutput,
  AiSchemaValidationOnlyOutput,
  AiVisualOutput,
} from "../contract.js";

export function buildNonAuthoritativeOutput(taskType: AiAbilityInput["taskType"], reason: string): AiVisualOutput | AiOcrCleanupOutput | AiCommentSignalSummaryOutput | AiProductSignalSummaryOutput | AiEvidencePacketAnalysisOutput | AiSchemaValidationOnlyOutput {
  switch (taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis":
      return {
        inputMode: "single_frame_fallback",
        multiFrameEvidenceSetId: null,
        contactSheetEvidenceId: null,
        frameEvidenceIds: [],
        screenshotEvidenceId: null,
        sampledFrameCount: 1,
        validFrameCount: 0,
        expectedFrameCount: 1,
        fallbackReason: reason,
        missingFrames: [],
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
    case "ocr_cleanup":
      return {
        cleanedComments: [],
        uncertainText: [reason],
        confidence: 0,
      };
    case "comment_signal_summary":
      return {
        purchaseIntent: "low",
        painPoints: [],
        complaints: [],
        demandTerms: [],
        confidence: 0,
      };
    case "product_signal_summary":
      return {
        category: "unknown",
        useCase: "unknown",
        sellingPoints: [],
        painPoints: [],
        purchaseIntent: "low",
        risk: "high",
        score: 0,
        rationale: reason,
      };
    case "evidence_packet_analysis":
      return {
        summary: reason,
        notableEvidenceRefs: [],
        reviewNotes: [reason],
      };
    case "schema_validation_only":
      return {
        valid: false,
        issues: [reason],
      };
  }
}
