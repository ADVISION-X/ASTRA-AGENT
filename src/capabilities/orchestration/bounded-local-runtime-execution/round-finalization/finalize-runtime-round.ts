import { createId } from "../../../../lib/local-runtime/ids.js";
import type { ForensicsArtifactRef, ForensicsPersistenceAbilityGroup, ForensicsRecordRef } from "../../../forensics-persistence/index.js";
import type { EvidenceRef, ImageEvidence, OcrTextResult } from "../../../../types/evidence.js";
import {
  RoundStructuralLogSchema,
  type BrowseLedgerOutcome,
  type EvidencePacketDataQualityFlag,
  type EvidencePacketRoundOutcome,
  type RoundArtifactKind,
  type RoundStructuralDecision,
} from "../../../../types/evidence-packet.js";
import type { LocalAiTaskResult } from "../../../../types/local-ai.js";
import type { ActionLog } from "../../../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../../../types/product-opportunity.js";
import type { AgentRound } from "../../../../types/task-run.js";
import type { EvidenceStoreService } from "../../../../lib/storage/evidence-store/evidence-store-service.js";
import { buildDataQualityFlags, buildBrowseLedgerEntryArtifact } from "./finalize-runtime-round-artifacts.js";
import { buildEvidencePacketArtifactPayload } from "./finalize-runtime-round-packet-persistence.js";
import { createForensicsRecordRef } from "../../../../lib/local-runtime/runtime-round-request-builders.js";

export type ProductPresenceTaskResult = Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>;
export type CommentSignalTaskResult = Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>;

export type FinalizeRoundArtifactsInput = {
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
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

export async function finalizeRoundArtifacts(input: FinalizeRoundArtifactsInput) {
  const videoEvidence = input.videoEvidence ?? null;
  const productPresenceResult = input.productPresenceResult ?? null;
  const commentEvidence = input.commentEvidence ?? null;
  const ocrResult = input.ocrResult ?? null;
  const candidate = input.candidate ?? null;
  const commentSignalResult = input.commentSignalResult ?? null;
  const roundVideoVisitId = input.round.videoVisitId ?? null;
  const actionLogRefs = input.actionLogs.map((item) => item.id);
  const aiResultRefs = [...(productPresenceResult ? [productPresenceResult.id] : []), ...(commentSignalResult ? [commentSignalResult.id] : [])];
  const evidenceRefs: EvidenceRef[] = [
    ...(videoEvidence ? [input.evidenceStore.toEvidenceRef(videoEvidence)] : []),
    ...(commentEvidence ? [input.evidenceStore.toEvidenceRef(commentEvidence)] : []),
    ...(candidate ? [input.evidenceStore.toCandidateEvidenceRef(candidate)] : []),
  ];
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
  let packetId: string | null = null;
  const parentRefs: ForensicsRecordRef[] = [
    ...evidenceRefs.map((ref) => createForensicsRecordRef({ recordType: "evidence_record", recordId: ref.id, storageRef: ref.filePath ?? null })),
    ...actionLogRefs.map((refId) => createForensicsRecordRef({ recordType: "structured_action_log", recordId: refId })),
    ...aiResultRefs.map((refId) => createForensicsRecordRef({ recordType: "ai_result_record", recordId: refId })),
  ];
  const artifactRefs: ForensicsArtifactRef[] = [
    ...(videoEvidence ? [{ artifactType: "image" as const, artifactId: videoEvidence.id, storageRef: videoEvidence.filePath, sourceRecordRef: null }] : []),
    ...(commentEvidence ? [{ artifactType: "image" as const, artifactId: commentEvidence.id, storageRef: commentEvidence.filePath, sourceRecordRef: null }] : []),
  ];
  const buildRoundLog = (nextPacketId: string | null) => RoundStructuralLogSchema.parse({
    logId: createId("round_log"),
    sessionId: input.taskRunId,
    taskRunId: input.taskRunId,
    roundId: input.round.id,
    videoVisitId: roundVideoVisitId,
    packetId: nextPacketId,
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
  });
  if (input.artifactKind === "browse_ledger") {
    const browseLedgerEntry = buildBrowseLedgerEntryArtifact({ finalizerInput: input, actionLogRefs, productPresenceResult });
    const roundLog = buildRoundLog(null);
    await input.forensicsPersistenceAbilityGroup.finalizeBrowseLedger({
      abilityGroupId: "forensics-persistence",
      childCapabilityId: "finalize-browse-ledger",
      recordType: "browse_ledger_entry",
      requestedBy: "orchestration",
      sourceAbilityGroupId: "orchestration",
      sourceChildCapabilityId: "finalize-browse-ledger",
      sessionId: input.taskRunId,
      roundId: input.round.id,
      videoVisitId: roundVideoVisitId,
      sourceRecordRefs: [],
      parentRefs,
      artifactRefs,
      persistencePolicy: { mode: "replace-by-round", allowPartialRefs: true },
      dataQualityFlags,
      payload: {
        browseLedgerEntry,
        roundStructuralLog: roundLog,
        rebuildSessionId: input.taskRunId,
      },
    });
    return roundLog;
  } else {
    if (!videoEvidence || !productPresenceResult) {
      throw new Error("evidence packet finalization requires video evidence and product-presence AI result");
    }

    packetId = createId("packet");
    const allowedUse = ["advanced_product_research"];
    const forbiddenUse = ["automatic_procurement", "automatic_ad_decision", "treat_like_as_purchase_intent"];
    const evidencePacket = await buildEvidencePacketArtifactPayload({ finalizerInput: input, packetId, videoEvidence, productPresenceResult, commentEvidence, commentSignalResult, ocrResult, candidate, evidenceRefs, actionLogRefs, aiResultRefs, dataQualityFlags, allowedUse, forbiddenUse });
    const roundLog = buildRoundLog(packetId);
    if (input.artifactKind === "failed_packet") {
      await input.forensicsPersistenceAbilityGroup.finalizeFailedRecord({
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "finalize-failed-record",
        recordType: "failed_record",
        requestedBy: "orchestration",
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: "finalize-failed-record",
        sessionId: input.taskRunId,
        roundId: input.round.id,
        videoVisitId: roundVideoVisitId,
        sourceRecordRefs: [],
        parentRefs,
        artifactRefs,
        persistencePolicy: { mode: "replace-by-round", allowPartialRefs: true },
        dataQualityFlags,
        payload: {
          evidencePacket,
          browseLedgerEntry: null,
          roundStructuralLog: roundLog,
          rebuildSessionId: input.taskRunId,
        },
      });
    } else {
      await input.forensicsPersistenceAbilityGroup.finalizeEvidencePacket({
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "finalize-evidence-packet",
        recordType: "evidence_packet",
        requestedBy: "orchestration",
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: "finalize-evidence-packet",
        sessionId: input.taskRunId,
        roundId: input.round.id,
        videoVisitId: roundVideoVisitId,
        sourceRecordRefs: [],
        parentRefs,
        artifactRefs,
        persistencePolicy: { mode: "replace-by-round", allowPartialRefs: true },
        dataQualityFlags,
        payload: {
          evidencePacket,
          roundStructuralLog: roundLog,
          rebuildSessionId: input.taskRunId,
        },
      });
    }

    return roundLog;
  }
}
