import type Database from "better-sqlite3";

import type {
  XuanxueAiOrderRecord,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  appendXuanxueAiProductionEvent,
} from "./xuanxue-ai-production-store-event.js";
import type {
  XuanxueAiOrderReader,
  XuanxueAiOrderUpdate,
} from "./xuanxue-ai-production-store-orders.js";

interface CloudRecoveryStore {
  readOrder: XuanxueAiOrderReader;
  updateStage: (
    stage: XuanxueAiStageRecord,
    eventType: string,
  ) => XuanxueAiStageRecord;
  updateOrder: (input: XuanxueAiOrderUpdate) => XuanxueAiOrderRecord;
}

export const quarantineForeignCloudRecoveryOrderInStore = (
  store: CloudRecoveryStore,
  orderId: string,
  reason: string,
): XuanxueAiOrderRecord => {
  const record = store.readOrder(orderId);
  if (!record) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  if (record.status === "review_required" || record.status === "failed") {
    return record;
  }
  const updatedAt = new Date().toISOString();
  const failureReason =
    `review_required: foreign cloud recovery ledger; ${reason}`;
  const blockingStage = record.stages.find((stage) =>
    stage.status !== "completed"
    && stage.status !== "failed"
    && stage.status !== "review_required");
  if (blockingStage) {
    store.updateStage({
      ...blockingStage,
      status: "review_required",
      progressPhase: "terminal",
      failureReason,
      updatedAt,
    }, "foreign_cloud_recovery_review_required");
  }
  return store.updateOrder({
    orderId,
    status: "review_required",
    failureReason,
    updatedAt,
    eventType: "foreign_cloud_recovery_review_required",
  });
};

const cancelIncompleteStages = (
  database: Database.Database,
  record: XuanxueAiOrderRecord,
  failureReason: string,
  updatedAt: string,
): void => {
  for (const stage of record.stages) {
    if (stage.status === "completed") continue;
    const cancelled: XuanxueAiStageRecord = {
      ...stage,
      status: "cancelled",
      progressPhase: "terminal",
      failureReason,
      updatedAt,
    };
    database.prepare(`
      update production_stages
      set status='cancelled',stage_json=?,updated_at=?
      where order_id=? and stage_id=?
    `).run(
      JSON.stringify(cancelled),
      updatedAt,
      record.order.orderId,
      stage.stageId,
    );
    appendXuanxueAiProductionEvent(database, {
      orderId: record.order.orderId,
      stageId: stage.stageId,
      eventType: "cloud_cancelled_stage_settled",
      fromStatus: stage.status,
      toStatus: "cancelled",
      detail: {
        executionId: stage.executionId,
        rawOutputHash: stage.rawOutputHash,
        reason: failureReason,
      },
      createdAt: updatedAt,
    });
  }
};

export const cancelCloudRecoveryOrderInStore = (
  database: Database.Database,
  readOrder: XuanxueAiOrderReader,
  orderId: string,
  reason: string,
): XuanxueAiOrderRecord => {
  const record = readOrder(orderId);
  if (!record) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  if (record.status === "cancelled") return record;
  if (record.status === "completed") {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_COMPLETED_ORDER_CANNOT_BE_CANCELLED",
    );
  }
  const updatedAt = new Date().toISOString();
  const failureReason = `cancelled_by_cloud: ${reason.slice(0, 900)}`;
  database.transaction(() => {
    cancelIncompleteStages(database, record, failureReason, updatedAt);
    database.prepare(`
      update production_orders
      set status='cancelled',failure_reason=?,updated_at=?
      where order_id=?
    `).run(failureReason, updatedAt, orderId);
    appendXuanxueAiProductionEvent(database, {
      orderId,
      stageId: null,
      eventType: "cloud_cancelled_order_settled",
      fromStatus: record.status,
      toStatus: "cancelled",
      detail: {
        reason: failureReason,
        evidencePolicy: "preserve_local_order_stages_and_events",
      },
      createdAt: updatedAt,
    });
  })();
  return readOrder(orderId)!;
};
