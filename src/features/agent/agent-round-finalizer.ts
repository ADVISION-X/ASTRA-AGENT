import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { getVisionProductPresencePromptContract } from "../../lib/local-ai/prompt-registry.js";
import { createId } from "../../lib/local-runtime/ids.js";
import type { EvidenceRef, ImageEvidence, OcrTextResult } from "../../types/evidence.js";
import {
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundStructuralLogSchema,
  type BrowseLedgerOutcome,
  type EvidencePacketDataQualityFlag,
  type EvidencePacketRoundOutcome,
  type RoundArtifactKind,
  type RoundStructuralDecision,
} from "../../types/evidence-packet.js";
import type { LocalAiTaskResult } from "../../types/local-ai.js";
import type { ActionLog } from "../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../types/product-opportunity.js";
import type { AgentRound } from "../../types/task-run.js";
import type { EvidenceStoreService } from "../local-data/evidence-store-service.js";

type ProductPresenceTaskResult = Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>;
type CommentSignalTaskResult = Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>;

type FinalizeRoundArtifactsInput = {
  evidenceStore: EvidenceStoreService;
  taskRunId: string;
  round: AgentRound;
  sourcePlatform: string;
  sourceUrl: string;
  currentUrl: string;
  pageReadyStatus: string;
  geometryStatus: string;
  decision: RoundStructuralDecision;
  roundOutcome: EvidencePacketRoundOutcome;
  browseOutcome: BrowseLedgerOutcome | null;
  decisionReason: string;
  nextStep: string;
  artifactKind: RoundArtifactKind;
  exportIncluded: boolean;
  videoEvidence?: ImageEvidence | null;
  productPresenceResult?: ProductPresenceTaskResult | null;
  actionLogs: ActionLog[];
  preActionMetricsUnavailableReason: string;
  commentEvidence?: ImageEvidence | null;
  commentEvidenceFailureReason?: string | null;
  ocrResult?: OcrTextResult | null;
  commentSignalResult?: CommentSignalTaskResult | null;
  candidate?: ProductOpportunityCandidate | null;
  additionalDataQualityFlags?: EvidencePacketDataQualityFlag[];
};

const COMMENT_CAPTURE_LIMIT = 3;

async function calculateFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function buildDataQualityFlags(input: {
  decision: RoundStructuralDecision;
  videoEvidence: ImageEvidence | null;
  productPresenceResult: ProductPresenceTaskResult | null;
  geometryStatus: string;
  commentEvidence: ImageEvidence | null;
  commentEvidenceFailureReason: string | null;
  ocrResult: OcrTextResult | null;
  candidate: ProductOpportunityCandidate | null;
  additionalDataQualityFlags: EvidencePacketDataQualityFlag[];
}): EvidencePacketDataQualityFlag[] {
  const flags: EvidencePacketDataQualityFlag[] = ["metrics_partially_unavailable"];

  if (input.videoEvidence) {
    flags.push("video_screenshot_ok");
  } else {
    flags.push("video_screenshot_missing");
  }

  if (input.productPresenceResult) {
    flags.push("local_ai_ok");
    if (input.productPresenceResult.result.isProductVideo === null || input.productPresenceResult.result.confidence < 0.75) {
      flags.push("local_ai_low_confidence");
    }
  } else if (input.decision === "local_ai_unavailable") {
    flags.push("local_ai_unavailable");
  }

  flags.push(input.geometryStatus.toLowerCase().includes("mismatch") ? "geometry_mismatch" : "geometry_calibrated");

  if (input.commentEvidence) {
    flags.push("comment_screenshot_ok");
  } else {
    flags.push("comment_screenshot_missing");
  }

  if (input.commentEvidenceFailureReason) {
    flags.push("comment_panel_failed");
  }

  if (input.ocrResult) {
    flags.push(input.ocrResult.confidence >= 0.7 ? "ocr_ok" : "ocr_low_quality");
  }

  if (input.candidate) {
    flags.push(input.commentEvidence ? "richer_candidate" : "video_only_candidate");
  }

  if (input.decision === "review_required") {
    flags.push("review_required");
  }

  flags.push(...input.additionalDataQualityFlags);

  return [...new Set(flags)];
}

function buildCommentSignals(result: CommentSignalTaskResult | null) {
  if (!result) {
    return {
      whereToBuyQuestions: [],
      priceQuestions: [],
      purchaseIntent: [],
      qualityConcerns: [],
      problemComplaints: [],
      repeatedDemandTerms: [],
      confidence: 0,
      uncertainty: ["comment_signals_unavailable"],
    };
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

function toBrowseDecision(decision: RoundStructuralDecision, productPresenceResult: ProductPresenceTaskResult | null) {
  if (!productPresenceResult || decision === "not_asked") {
    return "not_asked";
  }

  if (decision === "product_yes_high_confidence" || decision === "product_no_high_confidence" || decision === "product_uncertain") {
    return decision;
  }

  return "review_required";
}

function buildFallbackFrame(videoEvidence: ImageEvidence, screenshotHash: string) {
  return {
    label: "adaptive_first" as const,
    targetTimestampSec: null,
    actualTimestampSec: null,
    screenshotEvidenceId: videoEvidence.id,
    screenshotHash,
    storageRef: videoEvidence.filePath,
    width: videoEvidence.width,
    height: videoEvidence.height,
    capturedAt: videoEvidence.createdAt,
    unavailableReason: null,
  };
}

export async function finalizeRoundArtifacts(input: FinalizeRoundArtifactsInput) {
  const createsPacketArtifact = input.artifactKind === "evidence_packet" || input.artifactKind === "failed_packet";
  const packetId = input.artifactKind === "browse_ledger" ? null : createId("packet");
  const videoEvidence = input.videoEvidence ?? null;
  const productPresenceResult = input.productPresenceResult ?? null;
  const commentEvidence = input.commentEvidence ?? null;
  const ocrResult = input.ocrResult ?? null;
  const candidate = input.candidate ?? null;
  const commentSignalResult = input.commentSignalResult ?? null;
  const dataQualityFlags = buildDataQualityFlags({
    decision: input.decision,
    videoEvidence,
    productPresenceResult,
    geometryStatus: input.geometryStatus,
    commentEvidence,
    commentEvidenceFailureReason: input.commentEvidenceFailureReason ?? null,
    ocrResult,
    candidate,
    additionalDataQualityFlags: input.additionalDataQualityFlags ?? [],
  });
  const evidenceRefs: EvidenceRef[] = [];

  if (videoEvidence) {
    evidenceRefs.push(input.evidenceStore.toEvidenceRef(videoEvidence));
  }

  if (commentEvidence) {
    evidenceRefs.push(input.evidenceStore.toEvidenceRef(commentEvidence));
  }
  if (candidate) {
    evidenceRefs.push(input.evidenceStore.toCandidateEvidenceRef(candidate));
  }

  const actionLogRefs = input.actionLogs.map((item) => item.id);
  const aiResultRefs = [
    ...(productPresenceResult ? [productPresenceResult.id] : []),
    ...(commentSignalResult ? [commentSignalResult.id] : []),
  ];

  if (!createsPacketArtifact) {
    await input.evidenceStore.saveBrowseLedgerEntry(
      BrowseLedgerEntrySchema.parse({
        sessionId: input.taskRunId,
        roundId: input.round.id,
        videoVisitId: input.round.videoVisitId,
        observedAt: new Date().toISOString(),
        browseOutcome: input.browseOutcome,
        productPresenceDecision: toBrowseDecision(input.decision, productPresenceResult),
        confidence: productPresenceResult?.result.confidence ?? null,
        skipReason: input.decisionReason,
        actionLogRefs,
        lightweightOnly: true,
      }),
    );
  } else {
    if (!videoEvidence || !productPresenceResult || !packetId) {
      throw new Error("evidence packet finalization requires video evidence, AI result, and packet id");
    }

    const promptContract = getVisionProductPresencePromptContract();
    const screenshotHash = await calculateFileHash(videoEvidence.filePath);
    const packetVideoEvidence = {
      multiFrameEvidenceSetId: productPresenceResult.result.multiFrameEvidenceSetId ?? createId("multi_frame_evidence"),
      frames: [buildFallbackFrame(videoEvidence, screenshotHash)],
      contactSheetEvidenceId: productPresenceResult.result.contactSheetEvidenceId,
      samplingStrategy: productPresenceResult.result.sampledFrameCount > 1 ? "fixed_3_6_10" : "single_frame_fallback",
      validFrameCount: productPresenceResult.result.validFrameCount,
    } as const;

    await input.evidenceStore.saveEvidencePacket(
      ProductDiscoveryEvidencePacketSchema.parse({
        packetId,
        roundId: input.round.id,
        videoVisitId: input.round.videoVisitId,
        sourcePlatform: input.sourcePlatform,
        sourceUrl: input.sourceUrl,
        capturedAt: new Date().toISOString(),
        roundOutcome: input.roundOutcome,
        nextStep: input.nextStep,
        pageState: {
          currentUrl: input.currentUrl,
          loginState: input.decision === "blocked_login" ? "blocked_login" : "not_detected",
          safetyState: input.decision === "blocked_captcha" ? "captcha" : input.decision === "blocked_safety_page" ? "safety_page" : "clear",
          feedReadyStatus: input.pageReadyStatus,
          videoStableStatus: input.roundOutcome === "skipped_unstable_video" ? "unstable" : "stable",
          geometryStatus: input.geometryStatus,
          reviewRequiredReason: input.roundOutcome === "review_required" ? input.decisionReason : null,
        },
        videoEvidence: {
          multiFrameEvidenceSetId: packetVideoEvidence.multiFrameEvidenceSetId,
          frames: packetVideoEvidence.frames,
          contactSheetEvidenceId: packetVideoEvidence.contactSheetEvidenceId,
          samplingStrategy: packetVideoEvidence.samplingStrategy,
          validFrameCount: packetVideoEvidence.validFrameCount,
        },
        productPresenceAI: {
          promptId: promptContract.promptId,
          promptVersion: productPresenceResult.promptVersion,
          schemaVersion: productPresenceResult.schemaVersion,
          inputMode: productPresenceResult.result.inputMode,
          sampledFrameCount: productPresenceResult.result.sampledFrameCount,
          validFrameCount: productPresenceResult.result.validFrameCount,
          modelRole: productPresenceResult.modelRole,
          modelNameOrToolName: productPresenceResult.model,
          isProductVideo: productPresenceResult.result.isProductVideo,
          confidence: productPresenceResult.result.confidence,
          visibleProductTypes: productPresenceResult.result.visibleProductTypes,
          evidenceObservations: productPresenceResult.result.evidenceObservations,
          frameLevelObservations: productPresenceResult.result.frameLevelObservations,
          aggregateReason: productPresenceResult.result.aggregateReason,
          reason: productPresenceResult.result.reason,
          uncertainty: productPresenceResult.result.uncertainty,
          mustReview: productPresenceResult.result.mustReview,
        },
        preActionMetrics: {
          likeCount: null,
          commentCount: null,
          shareCount: null,
          saveCount: null,
          metricCaptureStage: "pre_action",
          unavailableReasons: [input.preActionMetricsUnavailableReason],
        },
        actions: input.actionLogs.map((item) => ({
          actionLogId: item.id,
          actionType: item.actionType,
          actionPurpose: item.actionPurpose,
          triggerSource: item.triggerSource,
          beforeEvidenceId: item.beforeEvidenceId,
          afterEvidenceId: item.afterEvidenceId,
          result: item.status,
          failureReason: item.failureReason,
          createdAt: item.createdAt,
        })),
        commentEvidence: {
          commentPanelOpened: Boolean(commentEvidence),
          commentScreenshotEvidenceIds: commentEvidence ? [commentEvidence.id] : [],
          ocrTextRecordIds: ocrResult ? [ocrResult.id] : [],
          visibleCommentCount: ocrResult?.cleanedComments.length ?? 0,
          commentCaptureLimit: COMMENT_CAPTURE_LIMIT,
          failureReason: input.commentEvidenceFailureReason ?? null,
        },
        commentSignals: buildCommentSignals(commentSignalResult),
        candidate: {
          candidateId: candidate?.id ?? null,
          status: "pending_analysis",
          candidateType: candidate ? (commentEvidence ? "richer_candidate" : "video_only") : "none",
          evidenceRefs: candidate?.evidenceRefs ?? [],
        },
        evidenceRefs,
        actionLogRefs,
        aiResultRefs,
        dataQualityFlags,
        exportForAdvancedAI: {
          included: input.exportIncluded,
          exportVersion: "evidence-packet-export.v1",
          allowedUse: ["advanced_product_research"],
          forbiddenUse: ["automatic_procurement", "automatic_ad_decision", "treat_like_as_purchase_intent"],
        },
      }),
    );
  }

  const roundLog = await input.evidenceStore.saveRoundStructuralLog(
    RoundStructuralLogSchema.parse({
      logId: createId("round_log"),
      sessionId: input.taskRunId,
      taskRunId: input.taskRunId,
      roundId: input.round.id,
      videoVisitId: input.round.videoVisitId,
      packetId,
      finalArtifactKind: input.artifactKind,
      productPresenceDecision: input.decision,
      browseOutcome: input.browseOutcome,
      roundOutcome: input.roundOutcome,
      decisionReason: input.decisionReason,
      nextStep: input.nextStep,
      startTime: input.round.createdAt,
      endTime: new Date().toISOString(),
      evidenceRefs,
      actionLogRefs,
      aiResultRefs,
      candidateId: candidate?.id ?? null,
      dataQualityFlags,
      exportIncluded: input.exportIncluded,
      lightweightOnly: input.artifactKind === "browse_ledger",
    }),
  );

  await input.evidenceStore.rebuildAdvancedAiExportSet(input.taskRunId);

  return roundLog;
}