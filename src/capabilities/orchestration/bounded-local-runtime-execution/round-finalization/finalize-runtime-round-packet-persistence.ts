import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createId } from "../../../../lib/local-runtime/ids.js";
import { ProductDiscoveryEvidencePacketSchema, type EvidencePacketDataQualityFlag } from "../../../../types/evidence-packet.js";
import type { EvidenceRef, ImageEvidence, OcrTextResult } from "../../../../types/evidence.js";
import type { ProductOpportunityCandidate } from "../../../../types/product-opportunity.js";
import type { FinalizeRoundArtifactsInput, CommentSignalTaskResult, ProductPresenceTaskResult } from "./finalize-runtime-round.js";

const COMMENT_CAPTURE_LIMIT = 3;

async function calculateFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function buildFallbackFrame(videoEvidence: ImageEvidence, screenshotHash: string) {
  return { label: "adaptive_first" as const, targetTimestampSec: null, actualTimestampSec: null, screenshotEvidenceId: videoEvidence.id, screenshotHash, storageRef: videoEvidence.filePath, width: videoEvidence.width, height: videoEvidence.height, capturedAt: videoEvidence.createdAt, unavailableReason: null };
}

function buildCommentSignals(result: CommentSignalTaskResult | null) {
  if (!result) {
    return { whereToBuyQuestions: [], priceQuestions: [], purchaseIntent: [], qualityConcerns: [], problemComplaints: [], repeatedDemandTerms: [], confidence: 0, uncertainty: ["comment_signals_unavailable"] };
  }

  return {
    whereToBuyQuestions: result.result.purchaseIntent === "high" ? ["where can I buy"] : [],
    priceQuestions: [],
    purchaseIntent: result.result.purchaseIntent === "low" ? [] : [result.result.purchaseIntent],
    qualityConcerns: result.result.complaints,
    problemComplaints: result.result.complaints,
    repeatedDemandTerms: result.result.demandTerms,
    confidence: result.result.confidence,
    uncertainty: [],
  };
}

function buildPacketVideoEvidence(input: {
  videoEvidence: ImageEvidence;
  productPresenceResult: ProductPresenceTaskResult;
  screenshotHash: string;
}) {
  return {
    multiFrameEvidenceSetId: input.productPresenceResult.result.multiFrameEvidenceSetId ?? createId("multi_frame_evidence"),
    frames: [buildFallbackFrame(input.videoEvidence, input.screenshotHash)],
    contactSheetEvidenceId: input.productPresenceResult.result.contactSheetEvidenceId,
    samplingStrategy: input.productPresenceResult.result.sampledFrameCount > 1 ? "fixed_3_6_10" : "single_frame_fallback",
    validFrameCount: input.productPresenceResult.result.validFrameCount,
  } as const;
}

function buildPageState(finalizerInput: FinalizeRoundArtifactsInput) {
  return {
    currentUrl: finalizerInput.currentUrl,
    loginState: finalizerInput.decision === "blocked_login" ? "blocked_login" : "not_detected",
    safetyState: finalizerInput.decision === "blocked_captcha" ? "captcha" : finalizerInput.decision === "blocked_safety_page" ? "safety_page" : "clear",
    feedReadyStatus: finalizerInput.pageReadyStatus,
    videoStableStatus: finalizerInput.roundOutcome === "skipped_unstable_video" ? "unstable" : "stable",
    geometryStatus: finalizerInput.geometryStatus,
    reviewRequiredReason: finalizerInput.roundOutcome === "review_required" ? finalizerInput.decisionReason : null,
  };
}

function buildProductPresenceAi(input: {
  promptId: string;
  productPresenceResult: ProductPresenceTaskResult;
}) {
  return {
    promptId: input.promptId,
    promptVersion: input.productPresenceResult.promptVersion,
    schemaVersion: input.productPresenceResult.schemaVersion,
    inputMode: input.productPresenceResult.result.inputMode,
    sampledFrameCount: input.productPresenceResult.result.sampledFrameCount,
    validFrameCount: input.productPresenceResult.result.validFrameCount,
    modelRole: input.productPresenceResult.modelRole,
    modelNameOrToolName: input.productPresenceResult.model,
    isProductVideo: input.productPresenceResult.result.isProductVideo,
    confidence: input.productPresenceResult.result.confidence,
    visibleProductTypes: input.productPresenceResult.result.visibleProductTypes,
    evidenceObservations: input.productPresenceResult.result.evidenceObservations,
    frameLevelObservations: input.productPresenceResult.result.frameLevelObservations,
    aggregateReason: input.productPresenceResult.result.aggregateReason,
    reason: input.productPresenceResult.result.reason,
    uncertainty: input.productPresenceResult.result.uncertainty,
    mustReview: input.productPresenceResult.result.mustReview,
  };
}

function buildActionRecords(finalizerInput: FinalizeRoundArtifactsInput) {
  return finalizerInput.actionLogs.map((item) => ({ actionLogId: item.id, actionType: item.actionType, actionPurpose: item.actionPurpose, triggerSource: item.triggerSource, beforeEvidenceId: item.beforeEvidenceId, afterEvidenceId: item.afterEvidenceId, result: item.status, failureReason: item.failureReason, createdAt: item.createdAt }));
}

function buildCommentEvidence(input: {
  commentEvidence: ImageEvidence | null;
  ocrResult: OcrTextResult | null;
  finalizerInput: FinalizeRoundArtifactsInput;
}) {
  return {
    commentPanelOpened: Boolean(input.commentEvidence),
    commentScreenshotEvidenceIds: input.commentEvidence ? [input.commentEvidence.id] : [],
    ocrTextRecordIds: input.ocrResult ? [input.ocrResult.id] : [],
    visibleCommentCount: input.ocrResult?.cleanedComments.length ?? 0,
    commentCaptureLimit: COMMENT_CAPTURE_LIMIT,
    failureReason: input.finalizerInput.commentEvidenceFailureReason ?? null,
  };
}

function buildCandidate(input: {
  candidate: ProductOpportunityCandidate | null;
  commentEvidence: ImageEvidence | null;
}) {
  return {
    candidateId: input.candidate?.id ?? null,
    status: "pending_analysis" as const,
    candidateType: input.candidate ? (input.commentEvidence ? "richer_candidate" : "video_only") : "none",
    evidenceRefs: input.candidate?.evidenceRefs ?? [],
  };
}

function buildEvidencePacketPayload(input: {
  finalizerInput: FinalizeRoundArtifactsInput;
  packetId: string;
  packetVideoEvidence: ReturnType<typeof buildPacketVideoEvidence>;
  promptId: string;
  productPresenceResult: ProductPresenceTaskResult;
  commentEvidence: ImageEvidence | null;
  commentSignalResult: CommentSignalTaskResult | null;
  ocrResult: OcrTextResult | null;
  candidate: ProductOpportunityCandidate | null;
  evidenceRefs: EvidenceRef[];
  actionLogRefs: string[];
  aiResultRefs: string[];
  dataQualityFlags: EvidencePacketDataQualityFlag[];
}) {
  return ProductDiscoveryEvidencePacketSchema.parse({
    packetId: input.packetId,
    roundId: input.finalizerInput.round.id,
    videoVisitId: input.finalizerInput.round.videoVisitId,
    sourcePlatform: input.finalizerInput.sourcePlatform,
    sourceUrl: input.finalizerInput.sourceUrl,
    capturedAt: new Date().toISOString(),
    roundOutcome: input.finalizerInput.roundOutcome,
    nextStep: input.finalizerInput.nextStep,
    pageState: buildPageState(input.finalizerInput),
    videoEvidence: input.packetVideoEvidence,
    productPresenceAI: buildProductPresenceAi({ promptId: input.promptId, productPresenceResult: input.productPresenceResult }),
    preActionMetrics: { likeCount: null, commentCount: null, shareCount: null, saveCount: null, metricCaptureStage: "pre_action", unavailableReasons: [input.finalizerInput.preActionMetricsUnavailableReason] },
    actions: buildActionRecords(input.finalizerInput),
    commentEvidence: buildCommentEvidence({ commentEvidence: input.commentEvidence, ocrResult: input.ocrResult, finalizerInput: input.finalizerInput }),
    commentSignals: buildCommentSignals(input.commentSignalResult),
    candidate: buildCandidate({ candidate: input.candidate, commentEvidence: input.commentEvidence }),
    evidenceRefs: input.evidenceRefs,
    actionLogRefs: input.actionLogRefs,
    aiResultRefs: input.aiResultRefs,
    dataQualityFlags: input.dataQualityFlags,
    exportForAdvancedAI: { included: input.finalizerInput.exportIncluded, exportVersion: "evidence-packet-export.v1", allowedUse: ["advanced_product_research"], forbiddenUse: ["automatic_procurement", "automatic_ad_decision", "treat_like_as_purchase_intent"] },
  });
}

export async function buildEvidencePacketArtifactPayload(input: {
  finalizerInput: FinalizeRoundArtifactsInput;
  packetId: string;
  videoEvidence: ImageEvidence;
  productPresenceResult: ProductPresenceTaskResult;
  commentEvidence: ImageEvidence | null;
  commentSignalResult: CommentSignalTaskResult | null;
  ocrResult: OcrTextResult | null;
  candidate: ProductOpportunityCandidate | null;
  evidenceRefs: EvidenceRef[];
  actionLogRefs: string[];
  aiResultRefs: string[];
  dataQualityFlags: EvidencePacketDataQualityFlag[];
  allowedUse: string[];
  forbiddenUse: string[];
}) {
  const screenshotHash = await calculateFileHash(input.videoEvidence.filePath);
  const packetVideoEvidence = buildPacketVideoEvidence({ videoEvidence: input.videoEvidence, productPresenceResult: input.productPresenceResult, screenshotHash });
  return ProductDiscoveryEvidencePacketSchema.parse({
    ...buildEvidencePacketPayload({ finalizerInput: input.finalizerInput, packetId: input.packetId, packetVideoEvidence, promptId: input.productPresenceResult.result.promptId, productPresenceResult: input.productPresenceResult, commentEvidence: input.commentEvidence, commentSignalResult: input.commentSignalResult, ocrResult: input.ocrResult, candidate: input.candidate, evidenceRefs: input.evidenceRefs, actionLogRefs: input.actionLogRefs, aiResultRefs: input.aiResultRefs, dataQualityFlags: input.dataQualityFlags }),
    exportForAdvancedAI: {
      included: input.finalizerInput.exportIncluded,
      exportVersion: "evidence-packet-export.v1",
      allowedUse: input.allowedUse,
      forbiddenUse: input.forbiddenUse,
    },
  });
}