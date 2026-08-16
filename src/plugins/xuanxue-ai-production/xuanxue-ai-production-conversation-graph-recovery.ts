import type Database from "better-sqlite3";

import {
  XuanxueAiStoredProductionOrderSchema,
  type XuanxueAiOrderStatus,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import { isXuanxueAiRequiredContinuationProduct } from "./xuanxue-ai-production-conversation-policy.js";
import {
  appendXuanxueAiProductionEvent,
} from "./xuanxue-ai-production-store-event.js";

interface GraphOrderRow {
  order_id: string;
  order_json: string;
  status: XuanxueAiOrderStatus;
}

interface ParentlessOrderRow extends GraphOrderRow {
  failure_reason: string | null;
}

const resetParentlessStages = (
  database: Database.Database,
  row: ParentlessOrderRow,
  reason: string,
  now: string,
): void => {
  const stages = database.prepare(`
    select stage_id,stage_json from production_stages
    where order_id=? order by ordinal
  `).all(row.order_id) as Array<{ stage_id: string; stage_json: string }>;
  for (const value of stages) {
    const stage = JSON.parse(value.stage_json) as XuanxueAiStageRecord;
    const recovered: XuanxueAiStageRecord = {
      ...stage,
      executionId:
        `${stage.orderId}:${stage.stageId}:missing-parent-recovery:`
        + `${stage.attemptCount + 1}`,
      status: "recovery_pending",
      aiFeedResult: null,
      rawResponseText: null,
      rawOutputHash: null,
      progressPhase: "recovery_pending",
      failureReason: reason,
      updatedAt: now,
    };
    database.prepare(`
      update production_stages set status='recovery_pending',
        stage_json=?,updated_at=? where order_id=? and stage_id=?
    `).run(JSON.stringify(recovered), now, row.order_id, value.stage_id);
  }
};

const recoverParentlessOrder = (
  database: Database.Database,
  row: ParentlessOrderRow,
  now: string,
): void => {
  const order = XuanxueAiStoredProductionOrderSchema.parse(
    JSON.parse(row.order_json),
  );
  if (
    !isXuanxueAiRequiredContinuationProduct(order.productId)
    || order.conversationParent
  ) {
    return;
  }
  const reason =
    "recovery_pending: required continuation needs full parent replay";
  if (row.status === "recovery_pending" && row.failure_reason === reason) return;
  resetParentlessStages(database, row, reason, now);
  database.prepare(`
    update production_orders set status='recovery_pending',result_json=null,
      failure_reason=?,updated_at=? where order_id=?
  `).run(reason, now, row.order_id);
  appendXuanxueAiProductionEvent(database, {
    orderId: row.order_id,
    stageId: null,
    eventType: "followup_parent_replay_requested",
    fromStatus: row.status,
    toStatus: "recovery_pending",
    detail: {
      productId: order.productId,
      forbiddenFallback: "blank_new_conversation",
      recoveryPolicy: "replay_parent_from_first_stage",
    },
    createdAt: now,
  });
};

export const recoverMissingRequiredContinuationParents = (
  database: Database.Database,
): void => {
  const rows = database.prepare(`
    select order_id,order_json,status,failure_reason
    from production_orders
    where status in ('queued','running','recovery_pending')
    order by created_at,order_id
  `).all() as ParentlessOrderRow[];
  const now = new Date().toISOString();
  database.transaction(() => {
    for (const row of rows) recoverParentlessOrder(database, row, now);
  })();
};
