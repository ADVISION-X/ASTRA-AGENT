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
import type { MapAuthoringFallbackOutput } from "./ai-map-authoring-fallback.js";
import { buildMapAuthoringFallback } from "./ai-map-authoring-fallback.js";

function buildVisualFallback(reason: string): AiVisualOutput {
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
    isProductVideo: false,
    decision: "product_no",
    confidence: 0,
    visibleProductTypes: [],
    evidenceObservations: [],
    reason,
    frameLevelObservations: [],
    aggregateReason: reason,
    suggestedNextAction: "scroll_next",
    uncertainty: [reason],
    mustReview: false,
  };
}

function buildFallbackByTaskType(reason: string) {
  return {
    product_presence_judgment: buildVisualFallback(reason),
    visual_observation: buildVisualFallback(reason),
    visual_target_candidate_analysis: buildVisualFallback(reason),
    ocr_cleanup: { cleanedComments: [], uncertainText: [reason], confidence: 0 },
    comment_signal_summary: { purchaseIntent: "low", painPoints: [], complaints: [], demandTerms: [], confidence: 0 },
    product_signal_summary: { category: "unknown", useCase: "unknown", sellingPoints: [], painPoints: [], purchaseIntent: "low", risk: "high", score: 0, rationale: reason },
    evidence_packet_analysis: { packetSummary: reason, evidenceIds: [], notes: [reason] },
    map_authoring: buildMapAuthoringFallback(reason),
    schema_validation_only: { valid: false, issues: [reason] },
  } as const;
}

export function buildNonAuthoritativeOutput(taskType: AiAbilityInput["taskType"], reason: string): AiVisualOutput | AiOcrCleanupOutput | AiCommentSignalSummaryOutput | AiProductSignalSummaryOutput | AiEvidencePacketAnalysisOutput | MapAuthoringFallbackOutput | AiSchemaValidationOnlyOutput {
  return buildFallbackByTaskType(reason)[taskType];
}
