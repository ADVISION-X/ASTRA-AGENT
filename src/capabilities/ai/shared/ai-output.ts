import type { z } from "zod";

import type {
  AiAbilityInput,
  AiCommentSignalSummaryOutput,
  AiEvidencePacketAnalysisOutput,
  AiOcrCleanupOutput,
  AiPagePreparationOutput,
  AiProductSignalSummaryOutput,
  AiSchemaValidationOnlyOutput,
  AiVisualOutput,
  AiVisualTargetCandidateOutput,
} from "../contract.js";
import type { MapAuthoringFallbackOutput } from "./ai-map-authoring-fallback.js";
import { buildMapAuthoringFallback } from "./ai-map-authoring-fallback.js";
import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
} from "../../../map-plugins/shared/startup-preparation.constants.js";
import { PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL } from "../../../map-plugins/route-plans/product-discovery-route-plan.constants.js";

function buildPagePreparationFallback(reason: string): AiPagePreparationOutput {
  return {
    decision: "no",
    routeLabel: STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
    nonExecutableSummary: "当前页面准备工作未完成，必须 fail-closed。",
    confidence: 0,
    reason,
    evidenceObservations: [],
    readinessSignals: [],
    blockingSignals: [reason],
    mustReview: false,
  };
}

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
    routeLabel: PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
    nonExecutableSummary: "当前证据未证明产品展示，选择非产品路线标签。",
    confidence: 0,
    visibleProductTypes: [],
    evidenceObservations: [],
    reason,
    frameLevelObservations: [],
    aggregateReason: reason,
    uncertainty: [reason],
    mustReview: false,
  };
}

function buildVisualTargetCandidateFallback(reason: string): AiVisualTargetCandidateOutput {
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
    targetCandidates: [],
    nonExecutableSummary: "当前截图中未识别到可治理的下一项候选目标。",
    confidence: 0,
    evidenceObservations: [],
    reason,
    uncertainty: [reason],
    mustReview: false,
  };
}

function buildFallbackByTaskType(reason: string) {
  return {
    page_preparation_judgment: buildPagePreparationFallback(reason),
    product_presence_judgment: buildVisualFallback(reason),
    visual_observation: buildVisualFallback(reason),
    visual_target_candidate_analysis: buildVisualTargetCandidateFallback(reason),
    ocr_cleanup: { cleanedComments: [], uncertainText: [reason], confidence: 0 },
    comment_signal_summary: { purchaseIntent: "low", painPoints: [], complaints: [], demandTerms: [], confidence: 0 },
    product_signal_summary: { category: "unknown", useCase: "unknown", sellingPoints: [], painPoints: [], purchaseIntent: "low", risk: "high", score: 0, rationale: reason },
    evidence_packet_analysis: { packetSummary: reason, evidenceIds: [], notes: [reason] },
    map_authoring: buildMapAuthoringFallback(reason),
    schema_validation_only: { valid: false, issues: [reason] },
  } as const;
}

export function buildNonAuthoritativeOutput(taskType: AiAbilityInput["taskType"], reason: string): AiPagePreparationOutput | AiVisualOutput | AiVisualTargetCandidateOutput | AiOcrCleanupOutput | AiCommentSignalSummaryOutput | AiProductSignalSummaryOutput | AiEvidencePacketAnalysisOutput | MapAuthoringFallbackOutput | AiSchemaValidationOnlyOutput {
  return buildFallbackByTaskType(reason)[taskType];
}
