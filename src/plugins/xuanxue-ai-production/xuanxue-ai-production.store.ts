import type Database from "better-sqlite3";

import type {
  XuanxueAiOrderRecord,
  XuanxueAiOrderStatus,
  XuanxueAiProductionOrder,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import { acknowledgeXuanxueAiControlIntent, applyXuanxueAiControlIntent, readXuanxueAiControlIntent, type XuanxueAiControlIntent, type XuanxueAiControlIntentProjection } from "./xuanxue-ai-production-store-control-intent.js";
import {
  cancelCloudRecoveryOrderInStore,
  quarantineForeignCloudRecoveryOrderInStore,
} from "./xuanxue-ai-production-store-cloud-recovery.js";
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
  quarantineInvalidStoredOrders,
  readQuarantinedStoredOrder,
  quarantineInvalidCompletedStageOutputs,
} from "./xuanxue-ai-production-store-recovery.js";

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
    quarantineInvalidStoredOrders(this.database);
    quarantineInvalidCompletedStageOutputs(this.database);
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

  readQuarantinedOrder(orderId: string) {
    return readQuarantinedStoredOrder(this.database, orderId);
  }

  readControlIntent(orderId: string): XuanxueAiControlIntentProjection {
    return readXuanxueAiControlIntent(this.database, orderId);
  }

  applyControlIntent(
    orderId: string,
    intent: XuanxueAiControlIntent,
    controlEpoch: number,
    reasonCode: string | null,
  ): XuanxueAiControlIntentProjection {
    return applyXuanxueAiControlIntent(this.database, orderId, intent, controlEpoch, reasonCode);
  }

  acknowledgeControlIntentAtSafePoint(
    orderId: string,
    checkpoint: string,
  ): XuanxueAiControlIntentProjection | null {
    return acknowledgeXuanxueAiControlIntent(this.database, orderId, checkpoint);
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

}
