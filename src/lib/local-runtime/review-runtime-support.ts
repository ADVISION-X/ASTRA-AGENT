import type { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { ActionLog } from "../../types/platform-action.js";
import type { AgentRound } from "../../types/task-run.js";
import type { EvidencePacketRoundOutcome, RoundArtifactKind, RoundStructuralDecision, RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { LocalAiTaskResult } from "../../types/local-ai.js";
import type { ImageEvidence, EvidenceRef } from "../../types/evidence.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import type { StructuredRuntimeSnapshotSummary } from "../../types/structured-log.js";
import { isLocalAiRuntimeError } from "../local-ai/local-ai-runtime-error.js";
import { finalizeRoundArtifacts } from "../../capabilities/orchestration/index.js";
import { emitRuntimeSnapshotSummary, emitSupplementalRuntimeEvent, recordRoundLifecycleStep } from "./runtime-proof-support.js";

function describeLocalAiFailure(error: unknown): {
  decision: "local_ai_unavailable" | "invalid_ai_output";
  localAiStatus: string;
  eventType: string;
  reason: string;
} {
  if (!isLocalAiRuntimeError(error)) {
    return {
      decision: "invalid_ai_output",
      localAiStatus: "invalid_ai_output",
      eventType: "local_ai_task_failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (error.code === "invalid_output") {
    return {
      decision: "invalid_ai_output",
      localAiStatus: "invalid_ai_output",
      eventType: "local_ai_task_failed",
      reason: error.message,
    };
  }

  return {
    decision: "local_ai_unavailable",
    localAiStatus: error.code === "disabled_by_policy" ? "disabled_by_policy" : "local_ai_unavailable",
    eventType: "local_ai_runtime_unavailable",
    reason: error.message,
  };
}

function resolveFailureArtifactKind(productPresenceResult: Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }> | null | undefined): RoundArtifactKind {
  return productPresenceResult ? "failed_packet" : "browse_ledger";
}

function resolveFailureDataQualityFlags(decision: RoundStructuralDecision): Array<"local_ai_unavailable" | "review_required"> {
  return decision === "local_ai_unavailable" ? ["local_ai_unavailable", "review_required"] : ["review_required"];
}

function buildFailureEvidenceRefs(evidenceStore: EvidenceStoreService, input: { videoEvidence?: ImageEvidence | null; commentEvidence?: ImageEvidence | null }): EvidenceRef[] {
  return [
    ...(input.videoEvidence ? [evidenceStore.toEvidenceRef(input.videoEvidence)] : []),
    ...(input.commentEvidence ? [evidenceStore.toEvidenceRef(input.commentEvidence)] : []),
  ];
}

export async function finalizeAiFailureRound(input: {
  deliveryState: RuntimeDeliveryState;
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  sourcePlatform: string;
  taskRunId: string;
  roundId: string;
  round: AgentRound;
  sourceUrl: string;
  reason: string;
  decision: RoundStructuralDecision;
  roundOutcome: EvidencePacketRoundOutcome;
  actionLogs: ActionLog[];
  videoVisitId: string | null;
  videoEvidence?: ImageEvidence | null;
  productPresenceResult?: Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }> | null;
  commentEvidence?: ImageEvidence | null;
  commentEvidenceFailureReason?: string | null;
}): Promise<{ actionLogRefs: string[] }> {
  const roundLog = await finalizeRoundArtifacts({
    evidenceStore: input.evidenceStore,
    forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup,
    taskRunId: input.taskRunId,
    round: input.round,
    sourcePlatform: input.sourcePlatform,
    sourceUrl: input.sourceUrl,
    currentUrl: input.deliveryState.currentUrl,
    pageReadyStatus: input.deliveryState.pageReadyStatus,
    geometryStatus: input.deliveryState.geometryGuardStatus,
    decision: input.decision,
    roundOutcome: input.roundOutcome,
    browseOutcome: null,
    decisionReason: input.reason,
    nextStep: "review_required",
    artifactKind: resolveFailureArtifactKind(input.productPresenceResult),
    exportIncluded: false,
    ...(input.videoEvidence ? { videoEvidence: input.videoEvidence } : {}),
    ...(input.productPresenceResult ? { productPresenceResult: input.productPresenceResult } : {}),
    actionLogs: input.actionLogs,
    preActionMetricsUnavailableReason: "local AI failure blocked governed continuation",
    ...(input.commentEvidence ? { commentEvidence: input.commentEvidence } : {}),
    ...(input.commentEvidenceFailureReason ? { commentEvidenceFailureReason: input.commentEvidenceFailureReason } : {}),
    additionalDataQualityFlags: resolveFailureDataQualityFlags(input.decision),
  });

  Object.assign(input.round, { status: "completed", note: input.reason, roundOutcome: roundLog.roundOutcome, decisionReason: roundLog.decisionReason, nextStep: roundLog.nextStep, ...(roundLog.packetId ? { packetId: roundLog.packetId } : {}), updatedAt: new Date().toISOString() });
  await input.evidenceStore.saveAgentRound(input.round);

  const actionLogRefs = input.actionLogs.map((actionLog) => actionLog.id);
  await recordRoundLifecycleStep({ deliveryState: input.deliveryState, forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup, taskRunId: input.taskRunId, roundId: input.roundId, step: "finalize_failed_or_review_record", status: "completed", detail: roundLog.roundOutcome, videoVisitId: input.videoVisitId });
  await emitSupplementalRuntimeEvent({
    deliveryState: input.deliveryState,
    forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup,
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    step: "finalize_failed_or_review_record",
    eventType: "finalize_failed_or_review_record_completed",
    status: "success",
    reason: input.reason,
    reviewRequiredReason: input.reason,
    decision: input.decision,
    roundOutcome: roundLog.roundOutcome,
    finalizationType: "failed_record",
    videoVisitId: input.videoVisitId,
    evidenceRefs: buildFailureEvidenceRefs(input.evidenceStore, {
      ...(input.videoEvidence !== undefined ? { videoEvidence: input.videoEvidence } : {}),
      ...(input.commentEvidence !== undefined ? { commentEvidence: input.commentEvidence } : {}),
    }),
    actionLogRefs,
    dataQualityFlags: resolveFailureDataQualityFlags(input.decision),
  });
  return { actionLogRefs };
}

export async function buildRuntimeSnapshotSummary(input: {
  currentTaskStatus: string | null;
  deliveryState: RuntimeDeliveryState;
  evidenceStore: EvidenceStoreService;
}): Promise<StructuredRuntimeSnapshotSummary> {
  const stateSnapshot = await input.evidenceStore.getOperatorSnapshot();
  const latestRoundLog = stateSnapshot.roundStructuralLogs[stateSnapshot.roundStructuralLogs.length - 1] ?? null;
  const latestBrowseLedgerEntry = stateSnapshot.browseLedgerEntries[stateSnapshot.browseLedgerEntries.length - 1] ?? null;
  const latestEvidencePacket = stateSnapshot.evidencePackets[stateSnapshot.evidencePackets.length - 1] ?? null;

  return {
    runtimeStatus: input.currentTaskStatus ?? "idle",
    currentStep: input.deliveryState.currentRoundStep,
    latestRoundOutcome: latestRoundLog?.roundOutcome ?? null,
    latestProductPresenceDecision: latestRoundLog?.productPresenceDecision ?? null,
    latestVideoEvidenceId: input.deliveryState.latestScreenshotEvidenceId,
    latestBrowseLedgerEntryId: latestBrowseLedgerEntry?.roundId ?? null,
    latestEvidencePacketId: latestEvidencePacket?.packetId ?? null,
    reviewRequiredReason: input.deliveryState.reviewRequiredReason,
    counters: {
      totalSeenCount: stateSnapshot.roundStructuralLogs.length,
      candidateCount: stateSnapshot.candidates.length,
      actionLogCount: stateSnapshot.structuredActionLogs.length,
      evidencePacketCount: stateSnapshot.evidencePackets.length,
      browseLedgerCount: stateSnapshot.browseLedgerEntries.length,
    },
  };
}

export async function stopTaskForReview(input: {
  deliveryState: RuntimeDeliveryState;
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  updateTaskStatus: (status: "review_required", note: string) => Promise<void>;
  clearRunningTask: () => void;
  taskRunId: string;
  roundId: string;
  reason: string;
  videoVisitId?: string | null;
  evidenceRefs?: EvidenceRef[];
  actionLogRefs?: string[];
}): Promise<void> {
  input.deliveryState.reviewRequiredReason = input.reason;
  input.deliveryState.lastStopReason = input.reason;
  input.deliveryState.lastError = input.reason;
  await input.updateTaskStatus("review_required", input.reason);
  await recordRoundLifecycleStep({ deliveryState: input.deliveryState, forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup, taskRunId: input.taskRunId, roundId: input.roundId, step: "review_required", status: "completed", detail: input.reason, videoVisitId: input.videoVisitId ?? null });
  const snapshotSummary = await buildRuntimeSnapshotSummary({ currentTaskStatus: "review_required", deliveryState: input.deliveryState, evidenceStore: input.evidenceStore });
  await emitSupplementalRuntimeEvent({ deliveryState: input.deliveryState, forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup, taskRunId: input.taskRunId, roundId: input.roundId, step: "stop", eventType: "task_stopped", status: "review_required", reason: input.reason, reviewRequiredReason: input.reason, videoVisitId: input.videoVisitId ?? null, evidenceRefs: input.evidenceRefs ?? [], actionLogRefs: input.actionLogRefs ?? [], snapshotSummary, dataQualityFlags: ["review_required"] });
  await emitRuntimeSnapshotSummary({ deliveryState: input.deliveryState, forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup, taskRunId: input.taskRunId, roundId: input.roundId, step: "review_required", reason: input.reason, reviewRequiredReason: input.reason, videoVisitId: input.videoVisitId ?? null, snapshotSummary });
  input.clearRunningTask();
}

export async function handleLocalAiFailureAndStop(input: {
  error: unknown;
  deliveryState: RuntimeDeliveryState;
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  taskRunId: string;
  roundId: string;
  round: AgentRound;
  sourcePlatform: string;
  sourceUrl: string;
  videoVisitId: string;
  videoEvidence: ImageEvidence;
  roundActionLogs: ActionLog[];
  stopTaskForReview: (input: { taskRunId: string; roundId: string; reason: string; videoVisitId?: string | null; evidenceRefs?: EvidenceRef[]; actionLogRefs?: string[] }) => Promise<void>;
  recordFailedStep: (input: { detail: string }) => Promise<void>;
  evidenceRefs: EvidenceRef[];
  commentEvidence?: ImageEvidence;
  productPresenceResult?: Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>;
}): Promise<void> {
  const failure = describeLocalAiFailure(input.error);
  const failureActionLogRefs = input.roundActionLogs.map((actionLog) => actionLog.id);
  await input.recordFailedStep({ detail: failure.reason });
  const finalizeLog = await finalizeAiFailureRound({
    deliveryState: input.deliveryState,
    evidenceStore: input.evidenceStore,
    forensicsPersistenceAbilityGroup: input.forensicsPersistenceAbilityGroup,
    sourcePlatform: input.sourcePlatform,
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    round: input.round,
    sourceUrl: input.sourceUrl,
    reason: failure.reason,
    decision: failure.decision,
    roundOutcome: failure.decision,
    actionLogs: input.roundActionLogs,
    videoVisitId: input.videoVisitId,
    videoEvidence: input.videoEvidence,
    ...(input.productPresenceResult ? { productPresenceResult: input.productPresenceResult } : {}),
    ...(input.commentEvidence ? { commentEvidence: input.commentEvidence, commentEvidenceFailureReason: failure.reason } : {}),
  });
  await input.stopTaskForReview({ taskRunId: input.taskRunId, roundId: input.roundId, reason: failure.reason, videoVisitId: input.videoVisitId, evidenceRefs: input.evidenceRefs, actionLogRefs: [...failureActionLogRefs, ...finalizeLog.actionLogRefs] });
}