import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import {
  resolveAiOcrCleanupOutputSummary,
  resolveAiPagePreparationOutputSummary,
  resolveAiProductPresenceOutputSummary,
} from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import {
  DEFAULT_EXPORT_VERSION,
  buildEvidenceRef,
  buildForensicsBaseInput,
  buildProductPresenceDecision,
  buildRoundStructuralDecision,
  buildVideoFrames,
  isRecord,
  readNumber,
  readString,
  requirePositiveInt,
  requireString,
  resolvePayloadString,
  type WorkbenchForensicsBrowseLedgerInput,
  type WorkbenchForensicsEvidencePacketInput,
} from "./workbench-forensics-dispatch-support.js";

export const buildForensicsEvidencePacketInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): WorkbenchForensicsEvidencePacketInput => {
  const payload = payloadDocumentToObject(inputPayload);
  const requestedPlatformId = requireString(resolvePayloadString(payload, "requestedPlatformId"), "requestedPlatformId");
  const targetUrl = requireString(resolvePayloadString(payload, "targetUrl"), "targetUrl");
  const videoVisitId = requireString(envelope.videoVisitId, "videoVisitId");
  const roundId = requireString(envelope.roundId, "roundId");
  const screenshotEvidenceRef = requireString(resolvePayloadString(payload, "screenshotEvidenceRef"), "screenshotEvidenceRef");
  const commentsEvidenceRef = requireString(resolvePayloadString(payload, "commentsEvidenceRef"), "commentsEvidenceRef");
  const pagePreparationAiResultRef = resolvePayloadString(payload, "pagePreparationAiResultRef");
  const productPresenceAiResultRef = requireString(resolvePayloadString(payload, "productPresenceAiResultRef"), "productPresenceAiResultRef");
  const commentCleanupAiResultRef = resolvePayloadString(payload, "commentCleanupAiResultRef");
  const commentsClickActionRef = requireString(resolvePayloadString(payload, "commentsClickActionRef"), "commentsClickActionRef");
  const commentsOpenVerificationRef = resolvePayloadString(payload, "commentsOpenVerificationRef");
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(productPresenceAiResultRef);
  const commentCleanupSummary = resolveAiOcrCleanupOutputSummary(commentCleanupAiResultRef);
  const pagePreparationSummary = resolveAiPagePreparationOutputSummary(pagePreparationAiResultRef);
  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary.");
  }

  const videoHandoff = resolveScreenshotSourceHandoff([screenshotEvidenceRef]);
  const commentsHandoff = resolveScreenshotSourceHandoff([commentsEvidenceRef]);
  if (!videoHandoff || !commentsHandoff) {
    throw new Error("Workbench forensics dispatch could not resolve screenshot handoff for evidence packet finalization.");
  }

  const videoProof = isRecord(videoHandoff.sourceProof) ? videoHandoff.sourceProof : null;
  const commentsProof = isRecord(commentsHandoff.sourceProof) ? commentsHandoff.sourceProof : null;
  const clickSummary = resolveAbilityResultProofSummary(commentsClickActionRef);
  const packetId = `${envelope.sessionId}:${roundId}:${videoVisitId}:packet`;
  const roundLogId = `${envelope.sessionId}:${roundId}:${videoVisitId}:round-log:evidence-packet`;
  const actionLogId = (clickSummary?.actionExecutionRef as string | null | undefined) ?? commentsClickActionRef;
  const videoEvidenceId = readString(videoProof, "sourceScreenshotEvidenceId") ?? screenshotEvidenceRef;
  const commentsEvidenceId = readString(commentsProof, "sourceScreenshotEvidenceId") ?? commentsEvidenceRef;
  const rawCommentBlocks = commentCleanupSummary?.input.rawCommentBlocks ?? [];
  const cleanedComments = commentCleanupSummary?.output.cleanedComments ?? [];
  const uncertainText = commentCleanupSummary?.output.uncertainText ?? [];
  const hasVisibleComments = cleanedComments.length > 0;
  const roundOutcome = hasVisibleComments ? "candidate_created" : "comments_unavailable_candidate_created";
  const packetCapturedAt = commentCleanupSummary?.capturedAt
    ?? (clickSummary?.endedAt as string | null | undefined)
    ?? productPresenceSummary.capturedAt;
  const commentFailureReason = hasVisibleComments
    ? null
    : commentCleanupSummary ? "no_visible_comments_extracted" : "comment_cleanup_unavailable";
  const dataQualityFlags = [
    videoEvidenceId ? "video_screenshot_ok" : "video_screenshot_missing",
    commentsEvidenceId ? "comment_screenshot_ok" : "comment_screenshot_missing",
    "metrics_partially_unavailable",
    commentCleanupSummary ? "local_ai_ok" : "local_ai_low_confidence",
    hasVisibleComments ? "ocr_ok" : "ocr_low_quality",
    "richer_candidate",
  ];

  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "finalize-evidence-packet",
      recordType: "evidence_packet",
      inputRefs: [
        screenshotEvidenceRef,
        commentsEvidenceRef,
        productPresenceAiResultRef,
        ...(commentCleanupAiResultRef ? [commentCleanupAiResultRef] : []),
        ...(pagePreparationAiResultRef ? [pagePreparationAiResultRef] : []),
        commentsClickActionRef,
        ...(commentsOpenVerificationRef ? [commentsOpenVerificationRef] : []),
      ],
      promptContractId: productPresenceSummary.promptContractId,
      promptContractVersion: productPresenceSummary.promptContractVersion,
      promptCatalogVersion: productPresenceSummary.promptCatalogVersion,
      decisionRef: productPresenceSummary.aiProofRef,
      actionRef: commentsClickActionRef,
      postActionVerificationRef: commentsOpenVerificationRef,
      dataQualityFlags,
    }),
    payload: {
      evidencePacket: {
        packetId,
        roundId,
        videoVisitId,
        sourcePlatform: requestedPlatformId,
        sourceUrl: targetUrl,
        capturedAt: packetCapturedAt,
        roundOutcome,
        nextStep: "finalize-browse-ledger",
        pageState: {
          currentUrl: targetUrl,
          loginState: pagePreparationSummary?.output.routeLabel === "startup-fail-closed" ? "blocked_or_unknown" : "ready_or_unchecked",
          safetyState: pagePreparationSummary?.output.decision === "no" ? "blocked_or_unknown" : "clear_or_unchecked",
          feedReadyStatus: pagePreparationSummary?.output.decision === "yes" ? "ready" : "unknown",
          videoStableStatus: productPresenceSummary.input.validFrameCount > 0 ? "observed" : "unknown",
          geometryStatus: commentsOpenVerificationRef ? "comments_panel_verified" : "comments_button_clicked",
          reviewRequiredReason: null,
        },
        videoEvidence: {
          multiFrameEvidenceSetId: productPresenceSummary.input.multiFrameEvidenceSetId ?? `${envelope.sessionId}:${roundId}:${videoVisitId}:multiframe`,
          frames: buildVideoFrames({
            frameEvidenceIds: productPresenceSummary.input.frameEvidenceIds,
            screenshotEvidenceId: productPresenceSummary.input.screenshotEvidenceId,
            samplingStrategy: productPresenceSummary.input.samplingStrategy,
            capturedAt: productPresenceSummary.capturedAt,
            width: requirePositiveInt(readNumber(videoProof, "sourceWidth"), "video screenshot width"),
            height: requirePositiveInt(readNumber(videoProof, "sourceHeight"), "video screenshot height"),
            storageRef: videoHandoff.sourceStorageRef,
          }),
          contactSheetEvidenceId: productPresenceSummary.input.contactSheetEvidenceId,
          samplingStrategy: productPresenceSummary.input.samplingStrategy,
          validFrameCount: productPresenceSummary.input.validFrameCount,
        },
        productPresenceAI: {
          promptId: productPresenceSummary.promptContractId,
          promptVersion: productPresenceSummary.promptContractVersion,
          schemaVersion: productPresenceSummary.outputSchemaRef,
          inputMode: productPresenceSummary.input.inputMode,
          sampledFrameCount: productPresenceSummary.input.sampledFrameCount,
          validFrameCount: productPresenceSummary.input.validFrameCount,
          modelRole: productPresenceSummary.modelRole,
          modelNameOrToolName: productPresenceSummary.modelName,
          isProductVideo: productPresenceSummary.output.isProductVideo,
          confidence: productPresenceSummary.output.confidence,
          visibleProductTypes: productPresenceSummary.output.visibleProductTypes,
          evidenceObservations: productPresenceSummary.output.evidenceObservations,
          frameLevelObservations: productPresenceSummary.output.frameLevelObservations,
          aggregateReason: productPresenceSummary.output.aggregateReason,
          reason: productPresenceSummary.output.reason,
          uncertainty: productPresenceSummary.output.uncertainty,
          mustReview: productPresenceSummary.output.mustReview,
        },
        preActionMetrics: {
          likeCount: null,
          commentCount: null,
          shareCount: null,
          saveCount: null,
          metricCaptureStage: "pre_action",
          unavailableReasons: ["route-plan-metrics-not-captured"],
        },
        actions: [
          {
            actionLogId,
            actionType: "click-browser-coordinate",
            actionPurpose: "collect_comment_evidence",
            triggerSource: "local_ai_output",
            beforeEvidenceId: videoEvidenceId,
            afterEvidenceId: commentsEvidenceId,
            result: "success",
            failureReason: null,
            createdAt: (clickSummary?.endedAt as string | null | undefined) ?? packetCapturedAt,
          },
        ],
        commentEvidence: {
          commentPanelOpened: true,
          commentScreenshotEvidenceIds: [commentsEvidenceId],
          ocrTextRecordIds: [],
          rawCommentBlocks,
          cleanedComments,
          uncertainText,
          extractionConfidence: commentCleanupSummary?.output.confidence ?? null,
          visibleCommentCount: cleanedComments.length,
          commentCaptureLimit: Math.max(rawCommentBlocks.length, 1),
          failureReason: commentFailureReason,
        },
        advancedAIAnalysisPlaceholder: {
          downstreamAnalysisPending: true,
          pendingAnalysisScopes: [
            "comment_purchase_intent",
            "comment_pain_points",
            "comment_demand_terms",
            "commercial_viability",
          ],
          reason: "local_ai_evidence_only_boundary",
        },
        candidate: {
          candidateId: null,
          status: "pending_analysis",
          candidateType: "richer_candidate",
          evidenceRefs: [
            buildEvidenceRef({ id: videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: videoHandoff.sourceStorageRef }),
            buildEvidenceRef({ id: commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: commentsHandoff.sourceStorageRef }),
            buildEvidenceRef({ id: productPresenceSummary.aiResultRef, kind: "ai-result", summary: "Product presence AI judgment result." }),
            ...(commentCleanupSummary
              ? [buildEvidenceRef({ id: commentCleanupSummary.aiResultRef, kind: "ai-result", summary: "Comment OCR cleanup result." })]
              : []),
          ],
        },
        evidenceRefs: [
          buildEvidenceRef({ id: videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: videoHandoff.sourceStorageRef }),
          buildEvidenceRef({ id: commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: commentsHandoff.sourceStorageRef }),
          buildEvidenceRef({ id: productPresenceSummary.aiResultRef, kind: "ai-result", summary: "Product presence AI judgment result." }),
          ...(commentCleanupSummary
            ? [buildEvidenceRef({ id: commentCleanupSummary.aiResultRef, kind: "ai-result", summary: "Comment OCR cleanup result." })]
            : []),
        ],
        actionLogRefs: [actionLogId],
        aiResultRefs: [
          ...(pagePreparationSummary ? [pagePreparationSummary.aiResultRef] : []),
          productPresenceSummary.aiResultRef,
          ...(commentCleanupSummary ? [commentCleanupSummary.aiResultRef] : []),
        ],
        dataQualityFlags,
        exportForAdvancedAI: {
          included: true,
          exportVersion: DEFAULT_EXPORT_VERSION,
          allowedUse: ["candidate-review", "browse-ledger-indexing"],
          forbiddenUse: ["direct-platform-action", "ungoverned-semantic-rewrite"],
        },
      },
      roundStructuralLog: {
        logId: roundLogId,
        sessionId: envelope.sessionId,
        taskRunId: envelope.runId,
        roundId,
        videoVisitId,
        packetId,
        finalArtifactKind: "evidence_packet",
        productPresenceDecision: buildRoundStructuralDecision(productPresenceSummary.output.decision, productPresenceSummary.output.mustReview),
        browseOutcome: null,
        roundOutcome,
        decisionReason: productPresenceSummary.output.reason,
        nextStep: "continue_discovery",
        startTime: pagePreparationSummary?.capturedAt ?? productPresenceSummary.capturedAt,
        endTime: packetCapturedAt,
        evidenceRefs: [
          buildEvidenceRef({ id: videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: videoHandoff.sourceStorageRef }),
          buildEvidenceRef({ id: commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: commentsHandoff.sourceStorageRef }),
        ],
        actionLogRefs: [actionLogId],
        aiResultRefs: [
          ...(pagePreparationSummary ? [pagePreparationSummary.aiResultRef] : []),
          productPresenceSummary.aiResultRef,
          ...(commentCleanupSummary ? [commentCleanupSummary.aiResultRef] : []),
        ],
        candidateId: null,
        dataQualityFlags,
        exportIncluded: true,
        lightweightOnly: false,
      },
      rebuildSessionId: envelope.sessionId,
    },
  }));
};

export const buildForensicsBrowseLedgerInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): WorkbenchForensicsBrowseLedgerInput => {
  const payload = payloadDocumentToObject(inputPayload);
  const videoVisitId = requireString(envelope.videoVisitId, "videoVisitId");
  const roundId = requireString(envelope.roundId, "roundId");
  const productPresenceAiResultRef = requireString(resolvePayloadString(payload, "productPresenceAiResultRef"), "productPresenceAiResultRef");
  const commentsClickActionRef = resolvePayloadString(payload, "commentsClickActionRef");
  const commentsOpenVerificationRef = resolvePayloadString(payload, "commentsOpenVerificationRef");
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(productPresenceAiResultRef);
  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary for browse ledger finalization.");
  }

  const packetId = `${envelope.sessionId}:${roundId}:${videoVisitId}:packet`;
  const roundLogId = `${envelope.sessionId}:${roundId}:${videoVisitId}:round-log:browse-ledger`;
  const actionLogRefs = commentsClickActionRef ? [commentsClickActionRef] : [];
  const dataQualityFlags = ["local_ai_ok", "richer_candidate"];

  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "finalize-browse-ledger",
      recordType: "browse_ledger_entry",
      inputRefs: [productPresenceAiResultRef, ...actionLogRefs, ...(commentsOpenVerificationRef ? [commentsOpenVerificationRef] : [])],
      promptContractId: productPresenceSummary.promptContractId,
      promptContractVersion: productPresenceSummary.promptContractVersion,
      promptCatalogVersion: productPresenceSummary.promptCatalogVersion,
      decisionRef: productPresenceSummary.aiProofRef,
      actionRef: commentsClickActionRef,
      postActionVerificationRef: commentsOpenVerificationRef,
      dataQualityFlags,
    }),
    payload: {
      browseLedgerEntry: {
        sessionId: envelope.sessionId,
        roundId,
        videoVisitId,
        observedAt: productPresenceSummary.capturedAt,
        browseOutcome: "ordinary_scroll_next",
        productPresenceDecision: buildProductPresenceDecision(productPresenceSummary.output.decision, productPresenceSummary.output.mustReview),
        confidence: productPresenceSummary.output.confidence,
        skipReason: null,
        actionLogRefs,
        lightweightOnly: true,
      },
      roundStructuralLog: {
        logId: roundLogId,
        sessionId: envelope.sessionId,
        taskRunId: envelope.runId,
        roundId,
        videoVisitId,
        packetId,
        finalArtifactKind: "browse_ledger",
        productPresenceDecision: buildRoundStructuralDecision(productPresenceSummary.output.decision, productPresenceSummary.output.mustReview),
        browseOutcome: "ordinary_scroll_next",
        roundOutcome: "browse_ledger_recorded",
        decisionReason: productPresenceSummary.output.reason,
        nextStep: "continue_discovery",
        startTime: productPresenceSummary.capturedAt,
        endTime: productPresenceSummary.capturedAt,
        evidenceRefs: [],
        actionLogRefs,
        aiResultRefs: [productPresenceSummary.aiResultRef],
        candidateId: null,
        dataQualityFlags,
        exportIncluded: true,
        lightweightOnly: true,
      },
      rebuildSessionId: envelope.sessionId,
    },
  }));
};