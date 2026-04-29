import { createId } from "../../lib/local-runtime/ids.js";
import type { AiAbilityInput } from "../../capabilities/ai/contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { OcrTextResultSchema, type EvidenceRef, type ImageEvidence, type OcrTextResult } from "../../types/evidence.js";
import type { LocalAiTaskResult, OcrCleanupPayload } from "../../types/local-ai.js";
import type { ActionLog, PlatformActionResult, PlatformActionRequest } from "../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../types/product-opportunity.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import type { AgentRound } from "../../types/task-run.js";
import type { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";
import type { PlatformAdapter } from "./platform-runtime-contract.js";
import { buildPendingAnalysisCandidate } from "./pending-analysis-candidate.js";
import { syncLatestActionLog } from "../../capabilities/orchestration/index.js";
import { buildCommentIntentRequest, buildImageEvidenceInput, buildOcrCleanupRequest, createForensicsRecordRef, materializeImageEvidenceRecord } from "./runtime-round-request-builders.js";
import { handleLocalAiFailureAndStop } from "./review-runtime-support.js";

export async function runCommentPipeline(input: {
  taskRunId: string;
  roundId: string;
  round: AgentRound;
  sourcePlatform: string;
  sourceUrl: string;
  videoVisitId: string;
  videoSummary: string;
  fallbackComments: string[];
  videoEvidence: ImageEvidence;
  videoEvidenceRef: EvidenceRef;
  visionResult: Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>;
  roundActionLogs: ActionLog[];
  deliveryState: RuntimeDeliveryState;
  adapter: PlatformAdapter;
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  createActionRequest: (taskRunId: string, roundId: string, type: "capture_comment_region", target: string, reason: string) => PlatformActionRequest;
  executeLocalAiTask: <TResult extends LocalAiTaskResult>(input: { taskRunId: string; roundId: string; step: "extract_visible_comments" | "summarize_comment_signals"; videoVisitId: string; request: AiAbilityInput }) => Promise<TResult>;
  recordRoundLifecycleStep: (input: { taskRunId: string; roundId: string; step: "screenshot_comments" | "extract_visible_comments" | "summarize_comment_signals" | "create_pending_candidate" | "scroll_next_video"; status: "completed" | "failed"; detail: string; videoVisitId: string }) => Promise<void>;
  continueToNextVideo: (input: { taskRunId: string; roundId: string; reason: string; videoVisitId: string }) => Promise<PlatformActionResult>;
  appendActionLog: (taskRunId: string, roundId: string, actionType: ActionLog["actionType"], status: ActionLog["status"], message: string, evidenceRefs: EvidenceRef[], aiTaskRefs: string[]) => Promise<ActionLog>;
  stopTaskForReview: (input: { taskRunId: string; roundId: string; reason: string; videoVisitId?: string | null; evidenceRefs?: EvidenceRef[]; actionLogRefs?: string[] }) => Promise<void>;
}): Promise<{ status: "return" } | { status: "ready"; commentEvidence: ImageEvidence; commentEvidenceRef: EvidenceRef; commentSignalResult: Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>; savedCandidate: ProductOpportunityCandidate; continueAfterCandidate: PlatformActionResult; continueAfterCandidateLog: ActionLog; ocrTextResult: OcrTextResult }> {
  const commentCapture = await input.adapter.captureCommentRegion(input.createActionRequest(input.taskRunId, input.roundId, "capture_comment_region", "comment-region", "capture comment evidence"));
  const commentEvidenceInput = buildImageEvidenceInput({ kind: "comment-screenshot", taskRunId: input.taskRunId, roundId: input.roundId, platformId: input.sourcePlatform, sourceId: input.videoVisitId, sourceUrl: commentCapture.capture.pageUrl, regionLabel: commentCapture.capture.regionLabel, regionType: commentCapture.capture.regionType, summary: `comments for ${input.videoVisitId}`, width: commentCapture.capture.width, height: commentCapture.capture.height, contentLines: commentCapture.capture.contentLines, sourceFilePath: commentCapture.capture.sourceFilePath });
  const commentEvidenceResult = await input.forensicsPersistenceAbilityGroup.writeImageEvidence({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-evidence-record",
    recordType: "evidence_record",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "capture-comment-region",
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    sourceRecordRefs: [],
    parentRefs: [createForensicsRecordRef({ recordType: "evidence_record", recordId: input.videoEvidence.id, storageRef: input.videoEvidence.filePath })],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: { imageEvidenceInput: commentEvidenceInput },
  });
  const commentEvidence = materializeImageEvidenceRecord({ imageEvidenceInput: commentEvidenceInput, persistedResult: commentEvidenceResult });
  const commentEvidenceRef = input.evidenceStore.toEvidenceRef(commentEvidence);
  input.deliveryState.latestScreenshotEvidenceId = commentEvidence.id;
  input.deliveryState.latestScreenshotPath = commentEvidence.filePath;
  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "screenshot_comments", status: "completed", detail: commentEvidence.id, videoVisitId: input.videoVisitId });

  let ocrResult: Extract<LocalAiTaskResult, { taskType: "comments.ocr_cleanup" }>;
  try {
    ocrResult = await input.executeLocalAiTask({ taskRunId: input.taskRunId, roundId: input.roundId, step: "extract_visible_comments", videoVisitId: input.videoVisitId, request: buildOcrCleanupRequest({ taskRunId: input.taskRunId, roundId: input.roundId, videoVisitId: input.videoVisitId, evidenceRefs: [commentEvidenceRef], rawCommentBlocks: commentCapture.capture.contentLines ?? input.fallbackComments }) });
  } catch (error) {
    await handleLocalAiFailureAndStop({ error, deliveryState: input.deliveryState, evidenceStore: input.evidenceStore, forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup, taskRunId: input.taskRunId, roundId: input.roundId, round: input.round, sourcePlatform: input.sourcePlatform, sourceUrl: input.sourceUrl, videoVisitId: input.videoVisitId, videoEvidence: input.videoEvidence, commentEvidence, productPresenceResult: input.visionResult, roundActionLogs: input.roundActionLogs, stopTaskForReview: input.stopTaskForReview, recordFailedStep: ({ detail }) => input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "extract_visible_comments", status: "failed", detail, videoVisitId: input.videoVisitId }), evidenceRefs: [input.videoEvidenceRef, commentEvidenceRef] });
    return { status: "return" };
  }

  const ocrPayload = ocrResult.result as OcrCleanupPayload;
  const ocrTextResult = OcrTextResultSchema.parse({ id: createId("ocr"), taskRunId: input.taskRunId, roundId: input.roundId, evidenceRef: commentEvidenceRef, confidence: ocrPayload.confidence, cleanedComments: ocrPayload.cleanedComments, uncertainText: ocrPayload.uncertainText, createdAt: new Date().toISOString() });
  await input.forensicsPersistenceAbilityGroup.writeOcrEvidence({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-evidence-record",
    recordType: "evidence_record",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "persist-ocr-evidence",
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    sourceRecordRefs: [],
    parentRefs: [createForensicsRecordRef({ recordType: "evidence_record", recordId: commentEvidence.id, storageRef: commentEvidence.filePath })],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: { ocrTextResult },
  });
  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "extract_visible_comments", status: "completed", detail: `${ocrTextResult.cleanedComments.length} comments`, videoVisitId: input.videoVisitId });

  let commentSignalResult: Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>;
  try {
    commentSignalResult = await input.executeLocalAiTask({ taskRunId: input.taskRunId, roundId: input.roundId, step: "summarize_comment_signals", videoVisitId: input.videoVisitId, request: buildCommentIntentRequest({ taskRunId: input.taskRunId, roundId: input.roundId, videoVisitId: input.videoVisitId, evidenceRefs: [commentEvidenceRef], cleanedComments: ocrPayload.cleanedComments }) });
  } catch (error) {
    await handleLocalAiFailureAndStop({ error, deliveryState: input.deliveryState, evidenceStore: input.evidenceStore, forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup, taskRunId: input.taskRunId, roundId: input.roundId, round: input.round, sourcePlatform: input.sourcePlatform, sourceUrl: input.sourceUrl, videoVisitId: input.videoVisitId, videoEvidence: input.videoEvidence, commentEvidence, productPresenceResult: input.visionResult, roundActionLogs: input.roundActionLogs, stopTaskForReview: input.stopTaskForReview, recordFailedStep: ({ detail }) => input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "summarize_comment_signals", status: "failed", detail, videoVisitId: input.videoVisitId }), evidenceRefs: [input.videoEvidenceRef, commentEvidenceRef] });
    return { status: "return" };
  }

  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "summarize_comment_signals", status: "completed", detail: commentSignalResult.id, videoVisitId: input.videoVisitId });
  const savedCandidate = await input.evidenceStore.saveCandidate(buildPendingAnalysisCandidate({ taskRunId: input.taskRunId, roundId: input.roundId, platformId: input.sourcePlatform, sourceVideoId: input.videoVisitId, evidenceRefs: [input.videoEvidenceRef, commentEvidenceRef, input.evidenceStore.toAiEvidenceRef(input.visionResult), input.evidenceStore.toAiEvidenceRef(commentSignalResult)], visionResult: input.visionResult, commentSignalResult }));
  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "create_pending_candidate", status: "completed", detail: savedCandidate.id, videoVisitId: input.videoVisitId });

  const continueAfterCandidate = await input.continueToNextVideo({ taskRunId: input.taskRunId, roundId: input.roundId, reason: "continue after candidate generation", videoVisitId: input.videoVisitId });
  const continueAfterCandidateLog = await input.appendActionLog(input.taskRunId, input.roundId, continueAfterCandidate.type, continueAfterCandidate.status, continueAfterCandidate.message, [input.videoEvidenceRef, commentEvidenceRef], [input.visionResult.id, commentSignalResult.id]);
  input.roundActionLogs.push(continueAfterCandidateLog);
  input.round.actionLogIds.push(continueAfterCandidateLog.id);
  syncLatestActionLog(input.deliveryState, continueAfterCandidateLog);
  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "scroll_next_video", status: continueAfterCandidate.status === "success" ? "completed" : "failed", detail: continueAfterCandidate.message, videoVisitId: input.videoVisitId });
  return { status: "ready", commentEvidence, commentEvidenceRef, commentSignalResult, savedCandidate, continueAfterCandidate, continueAfterCandidateLog, ocrTextResult };
}
