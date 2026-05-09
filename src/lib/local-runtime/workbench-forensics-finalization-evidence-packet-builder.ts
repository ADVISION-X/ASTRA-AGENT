import {
  DEFAULT_EXPORT_VERSION,
  buildEvidenceRef,
  buildForensicsBaseInput,
  buildRoundStructuralDecision,
  buildVideoFrames,
} from "./workbench-forensics-dispatch-builders.js";
import {
  isRecord,
  readNumber,
  readString,
  requirePositiveInt,
} from "./workbench-forensics-dispatch-values.js";
import {
  type WorkbenchForensicsEnvelope,
  type WorkbenchForensicsEvidencePacketInput,
} from "./workbench-forensics-dispatch-types.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import { resolveEvidencePacketContext, type EvidencePacketContext } from "./workbench-forensics-finalization-evidence-packet-support.js";

const buildEvidencePacketInputRefs = (context: EvidencePacketContext) => [
  context.refs.screenshotEvidenceRef,
  context.refs.commentsEvidenceRef,
  context.refs.productPresenceAiResultRef,
  ...(context.refs.commentCleanupAiResultRef ? [context.refs.commentCleanupAiResultRef] : []),
  ...(context.refs.pagePreparationAiResultRef ? [context.refs.pagePreparationAiResultRef] : []),
  context.refs.commentsClickActionRef,
  ...(context.refs.commentsOpenVerificationRef ? [context.refs.commentsOpenVerificationRef] : []),
];

const buildEvidencePacketRoundEvidenceRefs = (context: EvidencePacketContext) => [
  buildEvidenceRef({ id: context.ids.videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: context.videoHandoff.sourceStorageRef }),
  buildEvidenceRef({ id: context.ids.commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: context.commentsHandoff.sourceStorageRef }),
];

const buildEvidencePacketEvidenceRefs = (context: EvidencePacketContext) => [
  ...buildEvidencePacketRoundEvidenceRefs(context),
  buildEvidenceRef({ id: context.productPresenceSummary.aiResultRef, kind: "ai-result", summary: "Product presence AI judgment result." }),
  ...(context.commentCleanupSummary ? [buildEvidenceRef({ id: context.commentCleanupSummary.aiResultRef, kind: "ai-result", summary: "Comment OCR cleanup result." })] : []),
];

const buildEvidencePacketAiResultRefs = (context: EvidencePacketContext) => [
  ...(context.pagePreparationSummary ? [context.pagePreparationSummary.aiResultRef] : []),
  context.productPresenceSummary.aiResultRef,
  ...(context.commentCleanupSummary ? [context.commentCleanupSummary.aiResultRef] : []),
];

const buildEvidencePacketPageState = (context: EvidencePacketContext) => ({
  currentUrl: context.targetUrl,
  loginState: context.pagePreparationSummary?.output.routeLabel === "startup-fail-closed" ? "blocked_or_unknown" : "ready_or_unchecked",
  safetyState: context.pagePreparationSummary?.output.decision === "no" ? "blocked_or_unknown" : "clear_or_unchecked",
  feedReadyStatus: context.pagePreparationSummary?.output.decision === "yes" ? "ready" : "unknown",
  videoStableStatus: context.productPresenceSummary.input.validFrameCount > 0 ? "observed" : "unknown",
  geometryStatus: context.refs.commentsOpenVerificationRef ? "comments_panel_verified" : "comments_button_clicked",
  reviewRequiredReason: null,
});

const buildEvidencePacketVideoEvidence = (context: EvidencePacketContext) => {
  const videoProof = isRecord(context.videoHandoff.sourceProof) ? context.videoHandoff.sourceProof : null;
  return {
    multiFrameEvidenceSetId: context.productPresenceSummary.input.multiFrameEvidenceSetId ?? `${context.envelope.sessionId}:${context.ids.roundId}:${context.ids.videoVisitId}:multiframe`,
    frames: buildVideoFrames({
      frameEvidenceIds: context.productPresenceSummary.input.frameEvidenceIds,
      screenshotEvidenceId: context.productPresenceSummary.input.screenshotEvidenceId,
      samplingStrategy: context.productPresenceSummary.input.samplingStrategy,
      capturedAt: context.productPresenceSummary.capturedAt,
      width: requirePositiveInt(readNumber(videoProof, "sourceWidth"), "video screenshot width"),
      height: requirePositiveInt(readNumber(videoProof, "sourceHeight"), "video screenshot height"),
      storageRef: context.videoHandoff.sourceStorageRef,
    }),
    contactSheetEvidenceId: context.productPresenceSummary.input.contactSheetEvidenceId,
    samplingStrategy: context.productPresenceSummary.input.samplingStrategy,
    validFrameCount: context.productPresenceSummary.input.validFrameCount,
  };
};

const buildEvidencePacketProductPresenceAI = (context: EvidencePacketContext) => ({
  promptId: context.productPresenceSummary.promptContractId,
  promptVersion: context.productPresenceSummary.promptContractVersion,
  schemaVersion: context.productPresenceSummary.outputSchemaRef,
  inputMode: context.productPresenceSummary.input.inputMode,
  sampledFrameCount: context.productPresenceSummary.input.sampledFrameCount,
  validFrameCount: context.productPresenceSummary.input.validFrameCount,
  modelRole: context.productPresenceSummary.modelRole,
  modelNameOrToolName: context.productPresenceSummary.modelName,
  isProductVideo: context.productPresenceSummary.output.isProductVideo,
  confidence: context.productPresenceSummary.output.confidence,
  visibleProductTypes: context.productPresenceSummary.output.visibleProductTypes,
  evidenceObservations: context.productPresenceSummary.output.evidenceObservations,
  frameLevelObservations: context.productPresenceSummary.output.frameLevelObservations,
  aggregateReason: context.productPresenceSummary.output.aggregateReason,
  reason: context.productPresenceSummary.output.reason,
  uncertainty: context.productPresenceSummary.output.uncertainty,
  mustReview: context.productPresenceSummary.output.mustReview,
});

const buildEvidencePacketPreActionMetrics = () => ({ likeCount: null, commentCount: null, shareCount: null, saveCount: null, metricCaptureStage: "pre_action", unavailableReasons: ["route-plan-metrics-not-captured"] });

const buildEvidencePacketActions = (context: EvidencePacketContext) => [{
  actionLogId: context.ids.actionLogId,
  actionType: "click-browser-coordinate",
  actionPurpose: "collect_comment_evidence",
  triggerSource: "local_ai_output",
  beforeEvidenceId: context.ids.videoEvidenceId,
  afterEvidenceId: context.ids.commentsEvidenceId,
  result: "success",
  failureReason: null,
  createdAt: context.clickSummary?.endedAt ?? context.evidence.packetCapturedAt,
}];

const buildEvidencePacketCommentEvidence = (context: EvidencePacketContext) => ({
  commentPanelOpened: true,
  commentScreenshotEvidenceIds: [context.ids.commentsEvidenceId],
  ocrTextRecordIds: [],
  rawCommentBlocks: context.evidence.rawCommentBlocks,
  cleanedComments: context.evidence.cleanedComments,
  uncertainText: context.evidence.uncertainText,
  extractionConfidence: context.commentCleanupSummary?.output.confidence ?? null,
  visibleCommentCount: context.evidence.cleanedComments.length,
  commentCaptureLimit: Math.max(context.evidence.rawCommentBlocks.length, 1),
  failureReason: context.evidence.commentFailureReason,
});

const buildEvidencePacketAdvancedAIAnalysisPlaceholder = () => ({ downstreamAnalysisPending: true, pendingAnalysisScopes: ["comment_purchase_intent", "comment_pain_points", "comment_demand_terms", "commercial_viability"], reason: "local_ai_evidence_only_boundary" });

const buildEvidencePacketCandidate = (context: EvidencePacketContext) => ({ candidateId: null, status: "pending_analysis", candidateType: "richer_candidate", evidenceRefs: buildEvidencePacketEvidenceRefs(context) });

const buildEvidencePacketExportForAdvancedAI = () => ({ included: true, exportVersion: DEFAULT_EXPORT_VERSION, allowedUse: ["candidate-review", "browse-ledger-indexing"], forbiddenUse: ["direct-platform-action", "ungoverned-semantic-rewrite"] });

const buildEvidencePacketRoundStructuralLog = (context: EvidencePacketContext) => ({
  logId: context.ids.roundLogId,
  sessionId: context.envelope.sessionId,
  taskRunId: context.envelope.runId,
  roundId: context.ids.roundId,
  videoVisitId: context.ids.videoVisitId,
  packetId: context.ids.packetId,
  finalArtifactKind: "evidence_packet",
  productPresenceDecision: buildRoundStructuralDecision(context.productPresenceSummary.output.decision, context.productPresenceSummary.output.mustReview),
  browseOutcome: null,
  roundOutcome: context.evidence.roundOutcome,
  decisionReason: context.productPresenceSummary.output.reason,
  nextStep: "continue_discovery",
  startTime: context.pagePreparationSummary?.capturedAt ?? context.productPresenceSummary.capturedAt,
  endTime: context.evidence.packetCapturedAt,
  evidenceRefs: buildEvidencePacketRoundEvidenceRefs(context),
  actionLogRefs: [context.ids.actionLogId],
  aiResultRefs: buildEvidencePacketAiResultRefs(context),
  candidateId: null,
  dataQualityFlags: context.dataQualityFlags,
  exportIncluded: true,
  lightweightOnly: false,
});

const buildEvidencePacketPayload = (context: EvidencePacketContext) => ({
  evidencePacket: {
    packetId: context.ids.packetId,
    roundId: context.ids.roundId,
    videoVisitId: context.ids.videoVisitId,
    sourcePlatform: context.requestedPlatformId,
    sourceUrl: context.targetUrl,
    capturedAt: context.evidence.packetCapturedAt,
    roundOutcome: context.evidence.roundOutcome,
    nextStep: "finalize-browse-ledger",
    pageState: buildEvidencePacketPageState(context),
    videoEvidence: buildEvidencePacketVideoEvidence(context),
    productPresenceAI: buildEvidencePacketProductPresenceAI(context),
    preActionMetrics: buildEvidencePacketPreActionMetrics(),
    actions: buildEvidencePacketActions(context),
    commentEvidence: buildEvidencePacketCommentEvidence(context),
    advancedAIAnalysisPlaceholder: buildEvidencePacketAdvancedAIAnalysisPlaceholder(),
    candidate: buildEvidencePacketCandidate(context),
    evidenceRefs: buildEvidencePacketEvidenceRefs(context),
    actionLogRefs: [context.ids.actionLogId],
    aiResultRefs: buildEvidencePacketAiResultRefs(context),
    dataQualityFlags: context.dataQualityFlags,
    exportForAdvancedAI: buildEvidencePacketExportForAdvancedAI(),
  },
  roundStructuralLog: buildEvidencePacketRoundStructuralLog(context),
  rebuildSessionId: context.envelope.sessionId,
});

export const buildForensicsEvidencePacketInput = (envelope: WorkbenchForensicsEnvelope, inputPayload: Parameters<typeof payloadDocumentToObject>[0]): WorkbenchForensicsEvidencePacketInput => {
  const context = resolveEvidencePacketContext(envelope, inputPayload);
  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "finalize-evidence-packet",
      recordType: "evidence_packet",
      inputRefs: [
        context.refs.screenshotEvidenceRef,
        context.refs.commentsEvidenceRef,
        context.refs.productPresenceAiResultRef,
        ...(context.refs.commentCleanupAiResultRef ? [context.refs.commentCleanupAiResultRef] : []),
        ...(context.refs.pagePreparationAiResultRef ? [context.refs.pagePreparationAiResultRef] : []),
        context.refs.commentsClickActionRef,
        ...(context.refs.commentsOpenVerificationRef ? [context.refs.commentsOpenVerificationRef] : []),
      ],
      promptContractId: context.productPresenceSummary.promptContractId,
      promptContractVersion: context.productPresenceSummary.promptContractVersion,
      promptCatalogVersion: context.productPresenceSummary.promptCatalogVersion,
      decisionRef: context.productPresenceSummary.aiProofRef,
      actionRef: context.refs.commentsClickActionRef,
      postActionVerificationRef: context.refs.commentsOpenVerificationRef,
      dataQualityFlags: context.dataQualityFlags,
    }),
    payload: buildEvidencePacketPayload(context),
  }));
};