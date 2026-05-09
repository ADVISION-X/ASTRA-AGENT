import {
  resolveAiOcrCleanupOutputSummary,
  resolveAiPagePreparationOutputSummary,
  resolveAiProductPresenceOutputSummary,
} from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import { isRecord, readString, requireString, resolvePayloadString, type WorkbenchForensicsEnvelope } from "./workbench-forensics-dispatch-support.js";

type ScreenshotHandoff = NonNullable<ReturnType<typeof resolveScreenshotSourceHandoff>>;
type ProductPresenceSummary = NonNullable<ReturnType<typeof resolveAiProductPresenceOutputSummary>>;
type CommentCleanupSummary = ReturnType<typeof resolveAiOcrCleanupOutputSummary>;
type PagePreparationSummary = ReturnType<typeof resolveAiPagePreparationOutputSummary>;
type ClickSummary = ReturnType<typeof resolveAbilityResultProofSummary>;

type EvidencePacketRequest = {
  screenshotEvidenceRef: string;
  commentsEvidenceRef: string;
  pagePreparationAiResultRef: string | null;
  productPresenceAiResultRef: string;
  commentCleanupAiResultRef: string | null;
  commentsClickActionRef: string;
  commentsOpenVerificationRef: string | null;
};

type EvidencePacketSummaries = {
  productPresenceSummary: ProductPresenceSummary;
  commentCleanupSummary: CommentCleanupSummary;
  pagePreparationSummary: PagePreparationSummary;
  videoHandoff: ScreenshotHandoff;
  commentsHandoff: ScreenshotHandoff;
  clickSummary: ClickSummary;
};

type EvidencePacketEvidenceState = {
  ids: {
    roundId: string;
    videoVisitId: string;
    packetId: string;
    roundLogId: string;
    actionLogId: string;
    videoEvidenceId: string;
    commentsEvidenceId: string;
  };
  evidence: {
    rawCommentBlocks: unknown[];
    cleanedComments: unknown[];
    uncertainText: unknown[];
    packetCapturedAt: string;
    commentFailureReason: string | null;
    roundOutcome: string;
  };
  dataQualityFlags: string[];
};

export type EvidencePacketContext = {
  envelope: WorkbenchForensicsEnvelope;
  requestedPlatformId: string;
  targetUrl: string;
  refs: EvidencePacketRequest;
  productPresenceSummary: ProductPresenceSummary;
  commentCleanupSummary: CommentCleanupSummary;
  pagePreparationSummary: PagePreparationSummary;
  videoHandoff: ScreenshotHandoff;
  commentsHandoff: ScreenshotHandoff;
  clickSummary: ClickSummary;
  ids: EvidencePacketEvidenceState["ids"];
  evidence: EvidencePacketEvidenceState["evidence"];
  dataQualityFlags: string[];
};

const buildEvidencePacketDataQualityFlags = (input: { videoEvidenceId: string; commentsEvidenceId: string; commentCleanupSummary: CommentCleanupSummary; hasVisibleComments: boolean; }) => [
  input.videoEvidenceId ? "video_screenshot_ok" : "video_screenshot_missing",
  input.commentsEvidenceId ? "comment_screenshot_ok" : "comment_screenshot_missing",
  "metrics_partially_unavailable",
  input.commentCleanupSummary ? "local_ai_ok" : "local_ai_low_confidence",
  input.hasVisibleComments ? "ocr_ok" : "ocr_low_quality",
  "richer_candidate",
];

const readEvidencePacketRequest = (inputPayload: Parameters<typeof payloadDocumentToObject>[0]): { requestedPlatformId: string; targetUrl: string } & EvidencePacketRequest => {
  const payload = payloadDocumentToObject(inputPayload);
  return {
    requestedPlatformId: requireString(resolvePayloadString(payload, "requestedPlatformId"), "requestedPlatformId"),
    targetUrl: requireString(resolvePayloadString(payload, "targetUrl"), "targetUrl"),
    screenshotEvidenceRef: requireString(resolvePayloadString(payload, "screenshotEvidenceRef"), "screenshotEvidenceRef"),
    commentsEvidenceRef: requireString(resolvePayloadString(payload, "commentsEvidenceRef"), "commentsEvidenceRef"),
    pagePreparationAiResultRef: resolvePayloadString(payload, "pagePreparationAiResultRef"),
    productPresenceAiResultRef: requireString(resolvePayloadString(payload, "productPresenceAiResultRef"), "productPresenceAiResultRef"),
    commentCleanupAiResultRef: resolvePayloadString(payload, "commentCleanupAiResultRef"),
    commentsClickActionRef: requireString(resolvePayloadString(payload, "commentsClickActionRef"), "commentsClickActionRef"),
    commentsOpenVerificationRef: resolvePayloadString(payload, "commentsOpenVerificationRef"),
  };
};

const resolveEvidencePacketSummaries = (request: EvidencePacketRequest): EvidencePacketSummaries => {
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(request.productPresenceAiResultRef);
  const commentCleanupSummary = resolveAiOcrCleanupOutputSummary(request.commentCleanupAiResultRef);
  const pagePreparationSummary = resolveAiPagePreparationOutputSummary(request.pagePreparationAiResultRef);
  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary.");
  }
  const videoHandoff = resolveScreenshotSourceHandoff([request.screenshotEvidenceRef]);
  const commentsHandoff = resolveScreenshotSourceHandoff([request.commentsEvidenceRef]);
  if (!videoHandoff || !commentsHandoff) {
    throw new Error("Workbench forensics dispatch could not resolve screenshot handoff for evidence packet finalization.");
  }
  return { productPresenceSummary, commentCleanupSummary, pagePreparationSummary, videoHandoff, commentsHandoff, clickSummary: resolveAbilityResultProofSummary(request.commentsClickActionRef) };
};

const resolveEvidencePacketEvidenceState = (envelope: WorkbenchForensicsEnvelope, request: EvidencePacketRequest, summaries: EvidencePacketSummaries): EvidencePacketEvidenceState => {
  const roundId = requireString(envelope.roundId, "roundId");
  const videoVisitId = requireString(envelope.videoVisitId, "videoVisitId");
  const videoProof = isRecord(summaries.videoHandoff.sourceProof) ? summaries.videoHandoff.sourceProof : null;
  const commentsProof = isRecord(summaries.commentsHandoff.sourceProof) ? summaries.commentsHandoff.sourceProof : null;
  const videoEvidenceId = readString(videoProof, "sourceScreenshotEvidenceId") ?? request.screenshotEvidenceRef;
  const commentsEvidenceId = readString(commentsProof, "sourceScreenshotEvidenceId") ?? request.commentsEvidenceRef;
  const rawCommentBlocks = summaries.commentCleanupSummary?.input.rawCommentBlocks ?? [];
  const cleanedComments = summaries.commentCleanupSummary?.output.cleanedComments ?? [];
  const uncertainText = summaries.commentCleanupSummary?.output.uncertainText ?? [];
  const hasVisibleComments = cleanedComments.length > 0;
  const packetCapturedAt = summaries.commentCleanupSummary?.capturedAt ?? summaries.clickSummary?.endedAt ?? summaries.productPresenceSummary.capturedAt;
  const commentFailureReason = hasVisibleComments ? null : summaries.commentCleanupSummary ? "no_visible_comments_extracted" : "comment_cleanup_unavailable";
  const actionLogId = summaries.clickSummary?.actionExecutionRef ?? request.commentsClickActionRef;
  const roundOutcome = hasVisibleComments ? "candidate_created" : "comments_unavailable_candidate_created";
  return {
    ids: { roundId, videoVisitId, packetId: `${envelope.sessionId}:${roundId}:${videoVisitId}:packet`, roundLogId: `${envelope.sessionId}:${roundId}:${videoVisitId}:round-log:evidence-packet`, actionLogId, videoEvidenceId, commentsEvidenceId },
    evidence: { rawCommentBlocks, cleanedComments, uncertainText, packetCapturedAt, commentFailureReason, roundOutcome },
    dataQualityFlags: buildEvidencePacketDataQualityFlags({ videoEvidenceId, commentsEvidenceId, commentCleanupSummary: summaries.commentCleanupSummary, hasVisibleComments }),
  };
};

export const resolveEvidencePacketContext = (envelope: WorkbenchForensicsEnvelope, inputPayload: Parameters<typeof payloadDocumentToObject>[0]): EvidencePacketContext => {
  const refs = readEvidencePacketRequest(inputPayload);
  const summaries = resolveEvidencePacketSummaries(refs);
  const evidenceState = resolveEvidencePacketEvidenceState(envelope, refs, summaries);
  return {
    envelope,
    requestedPlatformId: refs.requestedPlatformId,
    targetUrl: refs.targetUrl,
    refs,
    productPresenceSummary: summaries.productPresenceSummary,
    commentCleanupSummary: summaries.commentCleanupSummary,
    pagePreparationSummary: summaries.pagePreparationSummary,
    videoHandoff: summaries.videoHandoff,
    commentsHandoff: summaries.commentsHandoff,
    clickSummary: summaries.clickSummary,
    ids: evidenceState.ids,
    evidence: evidenceState.evidence,
    dataQualityFlags: evidenceState.dataQualityFlags,
  };
};