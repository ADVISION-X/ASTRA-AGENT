import type Database from "better-sqlite3";

import type {
  XuanxueAiOrderRecord,
  XuanxueAiProductionResult,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import type {
  XuanxueAiOrderReader,
  XuanxueAiOrderUpdate,
} from "./xuanxue-ai-production-store-orders.js";

interface CheckpointProofStore {
  dataDir: string;
  readOrder: XuanxueAiOrderReader;
  updateStage: (
    stage: XuanxueAiStageRecord,
    eventType: string,
  ) => XuanxueAiStageRecord;
  updateOrder: (input: XuanxueAiOrderUpdate) => XuanxueAiOrderRecord;
}

export type RecoverProviderLease = (input: {
  dataDir: string;
  executionId: string;
  expectedInputHash: string;
  expectedOutputHash: string;
}) => Promise<string | null>;

const hasMatchingResultStageWithoutLease = (
  record: XuanxueAiOrderRecord,
  stage: XuanxueAiStageRecord,
): boolean => {
  const resultStage = record.result?.stages.find((candidate) =>
    candidate.stageId === stage.stageId
    && candidate.executionId === stage.executionId
    && candidate.rawOutputHash === stage.rawOutputHash);
  if (!resultStage) return false;
  const proof = resultStage.providerProof;
  return !(
    typeof proof === "object"
    && proof !== null
    && "providerLeaseId" in proof
    && (proof as { providerLeaseId?: unknown }).providerLeaseId
  );
};

const recoverOrderCheckpointProofs = async (
  store: CheckpointProofStore,
  record: XuanxueAiOrderRecord,
  recoverProviderLease: RecoverProviderLease,
): Promise<Map<string, XuanxueAiStageRecord>> => {
  const repairedStages = new Map<string, XuanxueAiStageRecord>();
  for (const stage of record.stages) {
    const feed = stage.aiFeedResult;
    if (
      stage.status !== "completed"
      || !stage.rawOutputHash
      || feed?.status !== "success"
      || feed.providerProof.providerLeaseId
      || typeof feed.providerProof.inputHash !== "string"
      || !hasMatchingResultStageWithoutLease(record, stage)
    ) continue;
    const providerLeaseId = await recoverProviderLease({
      dataDir: store.dataDir,
      executionId: stage.executionId,
      expectedInputHash: feed.providerProof.inputHash,
      expectedOutputHash: stage.rawOutputHash,
    });
    if (!providerLeaseId) continue;
    repairedStages.set(stage.stageId, {
      ...stage,
      aiFeedResult: {
        ...feed,
        providerProof: { ...feed.providerProof, providerLeaseId },
      },
    });
  }
  return repairedStages;
};

const persistRecoveredCheckpointProofs = (
  store: CheckpointProofStore,
  record: XuanxueAiOrderRecord,
  repairedStages: ReadonlyMap<string, XuanxueAiStageRecord>,
): void => {
  const repairedAt = new Date().toISOString();
  for (const stage of repairedStages.values()) {
    store.updateStage(
      { ...stage, updatedAt: repairedAt },
      "checkpoint_provider_lease_proof_recovered",
    );
  }
  const result: XuanxueAiProductionResult = {
    ...record.result!,
    stages: record.result!.stages.map((stage) => {
      const repaired = repairedStages.get(stage.stageId);
      return repaired
        ? { ...stage, providerProof: repaired.aiFeedResult!.providerProof }
        : stage;
    }),
  };
  store.updateOrder({
    orderId: record.order.orderId,
    status: "completed",
    result,
    failureReason: null,
    updatedAt: repairedAt,
    eventType: "completed_checkpoint_provider_proof_recovered",
  });
};

export const repairCompletedCheckpointProviderProofsInStore = async (
  database: Database.Database,
  store: CheckpointProofStore,
  recoverProviderLease: RecoverProviderLease,
): Promise<number> => {
  const completed = database.prepare(`
    select order_id from production_orders
    where status='completed' and result_json is not null
    order by created_at,order_id
  `).all() as Array<{ order_id: string }>;
  let repairedCount = 0;
  for (const { order_id: orderId } of completed) {
    const record = store.readOrder(orderId);
    if (!record?.result) continue;
    const repairedStages = await recoverOrderCheckpointProofs(
      store,
      record,
      recoverProviderLease,
    );
    if (repairedStages.size === 0) continue;
    persistRecoveredCheckpointProofs(store, record, repairedStages);
    repairedCount += repairedStages.size;
  }
  return repairedCount;
};
