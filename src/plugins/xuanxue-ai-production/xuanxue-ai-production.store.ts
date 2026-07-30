import type Database from "better-sqlite3";

import type {
  XuanxueAiOrderRecord,
  XuanxueAiOrderStatus,
  XuanxueAiProductionOrder,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  cancelCloudRecoveryOrderInStore,
  quarantineForeignCloudRecoveryOrderInStore,
} from "./xuanxue-ai-production-store-cloud-recovery.js";
import {
  type RecoverProviderLease,
  repairCompletedCheckpointProviderProofsInStore,
} from "./xuanxue-ai-production-store-checkpoint-proof.js";
import {
  type XuanxueAiParentConversationRebuild,
  readParentConversationRebuildFromStore,
  recordParentConversationRebuildInStore,
  resetOrderForConversationGraphRebuildInStore,
  resetOrderForParentConversationRebuildInStore,
} from "./xuanxue-ai-production-store-conversation-rebuild.js";
import {
  openXuanxueAiProductionDatabase,
} from "./xuanxue-ai-production-store-database.js";
import {
  createXuanxueAiProductionOrder,
  listXuanxueAiProductionOrders,
  readXuanxueAiProductionOrder,
  type XuanxueAiOrderUpdate,
  updateXuanxueAiProductionOrder,
  updateXuanxueAiProductionStage,
} from "./xuanxue-ai-production-store-orders.js";
import {
  recoverMissingRequiredContinuationParents,
  repairCanonicalOutputHashState,
  repairInvalidCompletedStageOutputs,
  repairLegacyFollowupWrongChatExecutionStates,
  repairRecoverableProviderFailures,
} from "./xuanxue-ai-production-store-recovery.js";

export type {
  XuanxueAiParentConversationRebuild,
} from "./xuanxue-ai-production-store-conversation-rebuild.js";

const RECOVERABLE_STATUSES = [
  "queued",
  "running",
  "recovery_pending",
] as const satisfies readonly XuanxueAiOrderStatus[];

const CLOUD_RECOVERY_STATUSES = [
  ...RECOVERABLE_STATUSES,
  "completed",
] as const satisfies readonly XuanxueAiOrderStatus[];

export class XuanxueAiProductionStore {
  private readonly database: Database.Database;
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.database = openXuanxueAiProductionDatabase(dataDir);
    repairCanonicalOutputHashState(this.database);
    repairInvalidCompletedStageOutputs(this.database);
    repairRecoverableProviderFailures(this.database);
    recoverMissingRequiredContinuationParents(this.database);
    repairLegacyFollowupWrongChatExecutionStates(this.database);
  }

  close(): void {
    this.database.close();
  }

  createOrder(
    order: XuanxueAiProductionOrder,
    stages: readonly XuanxueAiStageRecord[],
  ): XuanxueAiOrderRecord {
    return createXuanxueAiProductionOrder(
      this.database,
      order,
      stages,
      (orderId) => this.readOrder(orderId),
    );
  }

  readOrder(orderId: string): XuanxueAiOrderRecord | null {
    return readXuanxueAiProductionOrder(this.database, orderId);
  }

  listRecoverableOrders(): XuanxueAiOrderRecord[] {
    return listXuanxueAiProductionOrders(
      this.database,
      RECOVERABLE_STATUSES,
      (orderId) => this.readOrder(orderId),
    );
  }

  listCloudRecoveryOrders(): XuanxueAiOrderRecord[] {
    return listXuanxueAiProductionOrders(
      this.database,
      CLOUD_RECOVERY_STATUSES,
      (orderId) => this.readOrder(orderId),
    );
  }

  repairCompletedCheckpointProviderProofs(
    recoverProviderLease: RecoverProviderLease,
  ): Promise<number> {
    return repairCompletedCheckpointProviderProofsInStore(
      this.database,
      {
        dataDir: this.dataDir,
        readOrder: (orderId) => this.readOrder(orderId),
        updateStage: (stage, eventType) =>
          this.updateStage(stage, eventType),
        updateOrder: (input) => this.updateOrder(input),
      },
      recoverProviderLease,
    );
  }

  quarantineForeignCloudRecoveryOrder(
    orderId: string,
    reason: string,
  ): XuanxueAiOrderRecord {
    return quarantineForeignCloudRecoveryOrderInStore({
      readOrder: (candidateId) => this.readOrder(candidateId),
      updateStage: (stage, eventType) =>
        this.updateStage(stage, eventType),
      updateOrder: (input) => this.updateOrder(input),
    }, orderId, reason);
  }

  cancelCloudRecoveryOrder(
    orderId: string,
    reason: string,
  ): XuanxueAiOrderRecord {
    return cancelCloudRecoveryOrderInStore(
      this.database,
      (candidateId) => this.readOrder(candidateId),
      orderId,
      reason,
    );
  }

  updateStage(
    stage: XuanxueAiStageRecord,
    eventType: string,
  ): XuanxueAiStageRecord {
    return updateXuanxueAiProductionStage(
      this.database,
      stage,
      eventType,
    );
  }

  updateOrder(input: XuanxueAiOrderUpdate): XuanxueAiOrderRecord {
    return updateXuanxueAiProductionOrder(
      this.database,
      input,
      (orderId) => this.readOrder(orderId),
    );
  }

  readParentConversationRebuild(input: {
    parentJobId: string;
    parentStageId: string;
    originalRawOutputHash: string;
  }): XuanxueAiParentConversationRebuild | null {
    return readParentConversationRebuildFromStore(this.database, input);
  }

  resetOrderForConversationGraphRebuild(
    orderId: string,
    input: { readonly triggeringStageId: string; readonly reason: string },
  ): XuanxueAiOrderRecord {
    return resetOrderForConversationGraphRebuildInStore(
      this.database,
      (candidateId) => this.readOrder(candidateId),
      orderId,
      input,
    );
  }

  resetOrderForParentConversationRebuild(
    orderId: string,
  ): XuanxueAiOrderRecord {
    return resetOrderForParentConversationRebuildInStore(
      this.database,
      (candidateId) => this.readOrder(candidateId),
      orderId,
    );
  }

  recordParentConversationRebuild(
    input: XuanxueAiParentConversationRebuild,
  ): void {
    recordParentConversationRebuildInStore(this.database, input);
  }
}
