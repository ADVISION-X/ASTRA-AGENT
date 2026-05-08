import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import {
  resolveAiCommentSignalOutputSummary,
  resolveAiPagePreparationOutputSummary,
  resolveAiProductPresenceOutputSummary,
} from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { getActiveMapChain } from "./workbench-map-chain-support.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";
import { buildForensicsStructuredRuntimeEvent } from "./workbench-forensics-runtime-event-support.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";

type WorkbenchForensicsRuntimeEventInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["writeStructuredRuntimeEvent"]>[0];
type WorkbenchForensicsImageEvidenceInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["writeImageEvidence"]>[0];
type WorkbenchForensicsEvidencePacketInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["finalizeEvidencePacket"]>[0];
type WorkbenchForensicsBrowseLedgerInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["finalizeBrowseLedger"]>[0];

type JsonRecord = Record<string, unknown>;

const DEFAULT_EXPORT_VERSION = "product-discovery-evidence-packet.v1";

const FRAME_LABELS_BY_STRATEGY = {
  fixed_3_6: ["frame_3s", "frame_6s"],
  fixed_3_6_10: ["frame_3s", "frame_6s", "frame_10s"],
  adaptive_short_video: ["adaptive_first", "adaptive_mid", "adaptive_late"],
  route_plan_or_ability_owned_sampling: ["adaptive_first", "adaptive_mid", "adaptive_late"],
  single_frame_fallback: ["adaptive_first"],
} as const;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonRecord | null | undefined, key: string): string | null => {
  if (!value) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

const readNumber = (value: JsonRecord | null | undefined, key: string): number | null => {
  if (!value) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
};

const requireString = (value: string | null | undefined, label: string): string => {
  if (!value) {
    throw new Error(`Workbench forensics dispatch is missing ${label}.`);
  }
  return value;
};

const requirePositiveInt = (value: number | null | undefined, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Workbench forensics dispatch is missing valid ${label}.`);
  }
  return value;
};

const resolvePayloadString = (payload: ReturnType<typeof payloadDocumentToObject>, key: string): string | null =>
  payloadValueToString(payload[key]);

const buildForensicsBaseInput = (input: {
  envelope: AbilityCommandEnvelope;
  childCapabilityId: string;
  recordType: string;
  inputRefs: string[];
  promptContractId?: string | null;
  promptContractVersion?: string | null;
  promptCatalogVersion?: string | null;
  decisionRef?: string | null;
  actionRef?: string | null;
  postActionVerificationRef?: string | null;
  dataQualityFlags?: string[];
}) => {
  const mapChain = getActiveMapChain(input.envelope.mapId);
  return {
    abilityGroupId: "forensics-persistence" as const,
    childCapabilityId: input.childCapabilityId,
    recordType: input.recordType,
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: input.envelope.commandName,
    missionId: input.envelope.missionId,
    runId: input.envelope.runId,
    sessionId: input.envelope.sessionId,
    roundId: requireString(input.envelope.roundId, "roundId"),
    videoVisitId: input.envelope.videoVisitId ?? null,
    stepId: input.envelope.stepId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: input.envelope.selectedMapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: input.envelope.commandId,
    inputRefs: input.inputRefs,
    outputRefs: input.envelope.payloadRef,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append" as const, allowPartialRefs: true },
    ...(input.promptContractId ? { promptContractId: input.promptContractId } : {}),
    ...(input.promptContractVersion ? { promptContractVersion: input.promptContractVersion } : {}),
    ...(input.promptCatalogVersion ? { promptCatalogVersion: input.promptCatalogVersion } : {}),
    ...(input.decisionRef ? { decisionRef: input.decisionRef } : {}),
    ...(input.actionRef ? { actionRef: input.actionRef } : {}),
    ...(input.postActionVerificationRef ? { postActionVerificationRef: input.postActionVerificationRef } : {}),
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
};

const buildEvidenceRef = (input: {
  id: string;
  kind: "video-screenshot" | "comment-screenshot" | "ai-result" | "action-log";
  summary: string;
  filePath?: string | null;
}) => ({
  id: input.id,
  kind: input.kind,
  summary: input.summary,
  ...(input.filePath ? { filePath: input.filePath } : {}),
});

const buildProductPresenceDecision = (decision: "product_yes" | "product_no" | null, mustReview: boolean) => {
  if (mustReview) {
    return "review_required" as const;
  }
  if (decision === "product_yes") {
    return "product_yes_high_confidence" as const;
  }
  if (decision === "product_no") {
    return "product_no_high_confidence" as const;
  }
  return "not_asked" as const;
};

const buildRoundStructuralDecision = (decision: "product_yes" | "product_no" | null, mustReview: boolean) => {
  if (mustReview) {
    return "review_required" as const;
  }
  if (decision === "product_yes") {
    return "product_yes_high_confidence" as const;
  }
  if (decision === "product_no") {
    return "product_no_high_confidence" as const;
  }
  return "not_asked" as const;
};

const buildVideoFrames = (input: {
  frameEvidenceIds: string[];
  screenshotEvidenceId: string | null;
  samplingStrategy: keyof typeof FRAME_LABELS_BY_STRATEGY;
  capturedAt: string;
  width: number;
  height: number;
  storageRef: string | null;
}) => {
  const evidenceIds = input.frameEvidenceIds.length > 0
    ? input.frameEvidenceIds
    : input.screenshotEvidenceId ? [input.screenshotEvidenceId] : [];
  const labels = FRAME_LABELS_BY_STRATEGY[input.samplingStrategy] ?? FRAME_LABELS_BY_STRATEGY.route_plan_or_ability_owned_sampling;
  return evidenceIds.map((evidenceId, index) => ({
    label: labels[index] ?? "adaptive_late",
    targetTimestampSec: null,
    actualTimestampSec: null,
    screenshotEvidenceId: evidenceId,
    screenshotHash: null,
    storageRef: index === 0 ? input.storageRef : null,
    width: input.width,
    height: input.height,
    capturedAt: input.capturedAt,
    unavailableReason: null,
  }));
};

export const buildForensicsRuntimeEventInput = (
  envelope: AbilityCommandEnvelope,
): WorkbenchForensicsRuntimeEventInput => {
  const mapChain = getActiveMapChain(envelope.mapId);
  return JSON.parse(JSON.stringify({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    missionId: envelope.missionId,
    runId: envelope.transportId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    stepId: envelope.stepId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: envelope.mapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: envelope.commandId,
    inputRefs: [envelope.inputRef],
    outputRefs: envelope.payloadRef,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: buildForensicsStructuredRuntimeEvent(envelope),
    },
  }));
};

export const buildForensicsEvidenceRecordInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): WorkbenchForensicsImageEvidenceInput => {
  const payload = payloadDocumentToObject(inputPayload);
  const requestedPlatformId = requireString(resolvePayloadString(payload, "requestedPlatformId"), "requestedPlatformId");
  const targetUrl = requireString(resolvePayloadString(payload, "targetUrl"), "targetUrl");
  const commentsEvidenceRef = requireString(resolvePayloadString(payload, "commentsEvidenceRef"), "commentsEvidenceRef");
  const commentsHandoff = resolveScreenshotSourceHandoff([commentsEvidenceRef]);
  if (!commentsHandoff) {
    throw new Error("Workbench forensics dispatch could not resolve comments screenshot handoff.");
  }

  const sourceProof = isRecord(commentsHandoff.sourceProof) ? commentsHandoff.sourceProof : null;
  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "write-evidence-record",
      recordType: "evidence_record",
      inputRefs: [commentsEvidenceRef],
      dataQualityFlags: ["comment_screenshot_ok"],
    }),
    payload: {
      imageEvidenceInput: {
        kind: "comment-screenshot",
        taskRunId: envelope.runId,
        roundId: requireString(envelope.roundId, "roundId"),
        platformId: requestedPlatformId,
        sourceId: readString(sourceProof, "sourceScreenshotEvidenceId") ?? commentsEvidenceRef,
        sourceUrl: targetUrl,
        regionLabel: "comments-panel",
        regionType: "comment_panel",
        summary: "Comments panel screenshot evidence for seeding candidate review.",
        width: requirePositiveInt(readNumber(sourceProof, "sourceWidth"), "comments screenshot width"),
        height: requirePositiveInt(readNumber(sourceProof, "sourceHeight"), "comments screenshot height"),
        sourceFilePath: commentsHandoff.sourceStorageRef,
      },
    },
  }));
};

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
  const commentIntentAiResultRef = requireString(resolvePayloadString(payload, "commentIntentAiResultRef"), "commentIntentAiResultRef");
  const commentsClickActionRef = requireString(resolvePayloadString(payload, "commentsClickActionRef"), "commentsClickActionRef");
  const commentsOpenVerificationRef = resolvePayloadString(payload, "commentsOpenVerificationRef");
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(productPresenceAiResultRef);
  const commentSignalSummary = resolveAiCommentSignalOutputSummary(commentIntentAiResultRef);
  const pagePreparationSummary = resolveAiPagePreparationOutputSummary(pagePreparationAiResultRef);
  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary.");
  }
  if (!commentSignalSummary) {
    throw new Error("Workbench forensics dispatch could not resolve comment signal AI summary.");
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
  const dataQualityFlags = [
    videoEvidenceId ? "video_screenshot_ok" : "video_screenshot_missing",
    commentsEvidenceId ? "comment_screenshot_ok" : "comment_screenshot_missing",
    "metrics_partially_unavailable",
    "local_ai_ok",
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
        commentIntentAiResultRef,
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
        capturedAt: commentSignalSummary.capturedAt,
        roundOutcome: "candidate_created",
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
            createdAt: (clickSummary?.endedAt as string | null | undefined) ?? commentSignalSummary.capturedAt,
          },
        ],
        commentEvidence: {
          commentPanelOpened: true,
          commentScreenshotEvidenceIds: [commentsEvidenceId],
          ocrTextRecordIds: [],
          visibleCommentCount: commentSignalSummary.input.cleanedComments.length,
          commentCaptureLimit: Math.max(commentSignalSummary.input.cleanedComments.length, 1),
          failureReason: null,
        },
        commentSignals: {
          whereToBuyQuestions: [],
          priceQuestions: [],
          purchaseIntent: commentSignalSummary.output.purchaseIntent === "low" ? [] : [commentSignalSummary.output.purchaseIntent],
          qualityConcerns: commentSignalSummary.output.painPoints,
          problemComplaints: commentSignalSummary.output.complaints,
          repeatedDemandTerms: commentSignalSummary.output.demandTerms,
          confidence: commentSignalSummary.output.confidence,
          uncertainty: [],
        },
        candidate: {
          candidateId: null,
          status: "pending_analysis",
          candidateType: "richer_candidate",
          evidenceRefs: [
            buildEvidenceRef({ id: videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: videoHandoff.sourceStorageRef }),
            buildEvidenceRef({ id: commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: commentsHandoff.sourceStorageRef }),
            buildEvidenceRef({ id: productPresenceSummary.aiResultRef, kind: "ai-result", summary: "Product presence AI judgment result." }),
            buildEvidenceRef({ id: commentSignalSummary.aiResultRef, kind: "ai-result", summary: "Comment signal AI analysis result." }),
          ],
        },
        evidenceRefs: [
          buildEvidenceRef({ id: videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: videoHandoff.sourceStorageRef }),
          buildEvidenceRef({ id: commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: commentsHandoff.sourceStorageRef }),
          buildEvidenceRef({ id: productPresenceSummary.aiResultRef, kind: "ai-result", summary: "Product presence AI judgment result." }),
          buildEvidenceRef({ id: commentSignalSummary.aiResultRef, kind: "ai-result", summary: "Comment signal AI analysis result." }),
        ],
        actionLogRefs: [actionLogId],
        aiResultRefs: [
          ...(pagePreparationSummary ? [pagePreparationSummary.aiResultRef] : []),
          productPresenceSummary.aiResultRef,
          commentSignalSummary.aiResultRef,
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
        roundOutcome: "candidate_created",
        decisionReason: productPresenceSummary.output.reason,
        nextStep: "continue_discovery",
        startTime: pagePreparationSummary?.capturedAt ?? productPresenceSummary.capturedAt,
        endTime: commentSignalSummary.capturedAt,
        evidenceRefs: [
          buildEvidenceRef({ id: videoEvidenceId, kind: "video-screenshot", summary: "Current video screenshot evidence.", filePath: videoHandoff.sourceStorageRef }),
          buildEvidenceRef({ id: commentsEvidenceId, kind: "comment-screenshot", summary: "Comments panel screenshot evidence.", filePath: commentsHandoff.sourceStorageRef }),
        ],
        actionLogRefs: [actionLogId],
        aiResultRefs: [
          ...(pagePreparationSummary ? [pagePreparationSummary.aiResultRef] : []),
          productPresenceSummary.aiResultRef,
          commentSignalSummary.aiResultRef,
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