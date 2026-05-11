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
import type { VisualMissionActionPlanOutput as AiVisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import { loadMuscleMemoryCatalog } from "../../../muscle-memory/catalog/muscle-memory-catalog.js";

function buildPagePreparationFallback(reason: string): AiPagePreparationOutput {
  return {
    decision: "no",
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
  const catalogVersion = loadMuscleMemoryCatalog().catalogVersion;
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
    taskDecision: "NO_SEEDING_VIDEO_FLOW",
    pageStateDecision: "ready",
    actionPlan: {
      schemaVersion: "visualMissionActionPlan.v1",
      userRequirementRef: "user-requirement:ai-fallback",
      muscleMemoryCatalogVersion: catalogVersion,
      platform: "facebook-web",
      pageStateDecision: "ready",
      taskDecision: "NO_SEEDING_VIDEO_FLOW",
      confidence: 0,
      reason,
      actions: [
        { actionCode: "NO_SEEDING_VIDEO_FLOW", required: true, reason },
      ],
      riskFlags: [reason],
      nonExecutableSummary: "当前证据未显示明确产品展示，直接切到下一条。",
      contextRefs: {
        aiResultRef: null,
        originalScreenshotRef: null,
        coordinateGridScreenshotRef: null,
        gridSpecRef: null,
        visualMissionInputRef: null,
        platformContextRef: null,
      },
    },
    nonExecutableSummary: "当前证据未显示明确产品展示，直接切到下一条。",
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

function buildVisualMissionActionPlanFallback(reason: string): AiVisualMissionActionPlanOutput {
  return {
    schemaVersion: "visualMissionActionPlan.v1",
    userIntentUnderstanding: {
      matched: false,
      summary: "当前视觉任务计划回退到 fail-closed 输出。",
    },
    platform: "facebook-web",
    isTargetPlatform: false,
    surface: "unknown",
    isTargetFeed: false,
    pageStateDecision: "review_required",
    isProductVideo: false,
    productDecision: "uncertain",
    confidence: 0,
    visibleProductTypes: [],
    visualEvidence: [reason],
    reason,
    actions: [{ actionCode: "STOP_REVIEW_REQUIRED", required: true, reason }],
    nonExecutableClickTargets: [],
    riskFlags: ["visual_mission_fallback"],
    nonExecutableSummary: reason,
  };
}

function buildFallbackByTaskType(reason: string): Record<AiAbilityInput["taskType"], unknown> {
  return {
    page_preparation_judgment: buildPagePreparationFallback(reason),
    product_presence_judgment: buildVisualFallback(reason),
    visual_observation: buildVisualFallback(reason),
    visual_mission_action_plan: buildVisualMissionActionPlanFallback(reason),
    visual_target_candidate_analysis: buildVisualTargetCandidateFallback(reason),
    ocr_cleanup: { cleanedComments: [], uncertainText: [reason], confidence: 0 },
    comment_signal_summary: { purchaseIntent: "low", painPoints: [], complaints: [], demandTerms: [], confidence: 0 },
    product_signal_summary: { category: "unknown", useCase: "unknown", sellingPoints: [], painPoints: [], purchaseIntent: "low", risk: "high", score: 0, rationale: reason },
    evidence_packet_analysis: { packetSummary: reason, evidenceIds: [], notes: [reason] },
    schema_validation_only: { valid: false, issues: [reason] },
  };
}

export function buildNonAuthoritativeOutput(taskType: AiAbilityInput["taskType"], reason: string): AiPagePreparationOutput | AiVisualOutput | AiVisualMissionActionPlanOutput | AiVisualTargetCandidateOutput | AiOcrCleanupOutput | AiCommentSignalSummaryOutput | AiProductSignalSummaryOutput | AiEvidencePacketAnalysisOutput | AiSchemaValidationOnlyOutput {
  return buildFallbackByTaskType(reason)[taskType];
}
