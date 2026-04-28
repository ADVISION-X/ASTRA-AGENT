import type { EvidenceStoreService } from "../../../../lib/storage/evidence-store/evidence-store-service.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../forensics-persistence/index.js";
import type { ImageEvidence, OcrTextResult } from "../../../../types/evidence.js";
import type { LocalAiTaskResult } from "../../../../types/local-ai.js";
import type { ActionLog } from "../../../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../../../types/product-opportunity.js";
import type { AgentRound } from "../../../../types/task-run.js";
import type { BrowseLedgerOutcome, EvidencePacketDataQualityFlag, EvidencePacketRoundOutcome, RoundArtifactKind, RoundLifecycleStep, RoundStructuralDecision } from "../../../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../../../types/runtime.js";
import { finalizeRoundArtifact, persistRoundArtifactOutcome } from "./runtime-round-artifact-support.js";

export async function finalizeRoundOutcome(input: {
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  deliveryState: RuntimeDeliveryState;
  recordRoundLifecycleStep: (input: { taskRunId: string; roundId: string; step: RoundLifecycleStep; status: "completed"; detail: string; videoVisitId?: string | null }) => Promise<void>;
  taskRunId: string;
  roundId: string;
  round: AgentRound;
  roundStatus: AgentRound["status"];
  note: string;
  completionStep: RoundLifecycleStep;
  sourcePlatform: string;
  sourceUrl: string;
  decision: RoundStructuralDecision;
  roundOutcome: EvidencePacketRoundOutcome;
  browseOutcome: BrowseLedgerOutcome | null;
  nextStep: string;
  artifactKind: RoundArtifactKind;
  exportIncluded: boolean;
  actionLogs: ActionLog[];
  videoVisitId?: string | null;
  videoEvidence?: ImageEvidence;
  productPresenceResult?: Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>;
  commentEvidence?: ImageEvidence;
  commentEvidenceFailureReason?: string;
  ocrResult?: OcrTextResult;
  commentSignalResult?: Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>;
  candidate?: ProductOpportunityCandidate;
  preActionMetricsUnavailableReason: string;
  additionalDataQualityFlags?: EvidencePacketDataQualityFlag[];
}): Promise<void> {
  const roundLog = await finalizeRoundArtifact({
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
    browseOutcome: input.browseOutcome,
    decisionReason: input.note,
    nextStep: input.nextStep,
    artifactKind: input.artifactKind,
    exportIncluded: input.exportIncluded,
    ...(input.videoEvidence ? { videoEvidence: input.videoEvidence } : {}),
    ...(input.productPresenceResult ? { productPresenceResult: input.productPresenceResult } : {}),
    actionLogs: input.actionLogs,
    preActionMetricsUnavailableReason: input.preActionMetricsUnavailableReason,
    ...(input.commentEvidence ? { commentEvidence: input.commentEvidence } : {}),
    ...(input.commentEvidenceFailureReason ? { commentEvidenceFailureReason: input.commentEvidenceFailureReason } : {}),
    ...(input.ocrResult ? { ocrResult: input.ocrResult } : {}),
    ...(input.commentSignalResult ? { commentSignalResult: input.commentSignalResult } : {}),
    ...(input.candidate ? { candidate: input.candidate } : {}),
    ...(input.additionalDataQualityFlags ? { additionalDataQualityFlags: input.additionalDataQualityFlags } : {}),
  });
  await persistRoundArtifactOutcome({ evidenceStore: input.evidenceStore, recordRoundLifecycleStep: input.recordRoundLifecycleStep, taskRunId: input.taskRunId, roundId: input.roundId, round: input.round, roundLog, roundStatus: input.roundStatus, note: input.note, completionStep: input.completionStep, videoVisitId: input.videoVisitId ?? null });
}