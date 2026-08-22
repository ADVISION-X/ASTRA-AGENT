import type Database from "better-sqlite3";

import {
  type XuanxueAiOrderStatus,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  appendXuanxueAiProductionEvent,
} from "./xuanxue-ai-production-store-event.js";
import {
  xuanxueAiOutputIntegrityFailure,
} from "./xuanxue-ai-production-output-integrity.js";

const completedStageIntegrityFailure = (
  stage: XuanxueAiStageRecord,
): string | null => {
  if (!stage.rawResponseText || !stage.rawOutputHash) {
    return "XUANXUE_AI_PRODUCTION_RAW_RESPONSE_MISSING";
  }
  return xuanxueAiOutputIntegrityFailure(stage.rawResponseText);
};

interface RepairableOrderRow {
  order_id: string;
  status: XuanxueAiOrderStatus;
}

const quarantineInvalidCompletedOrder = (
  database: Database.Database,
  order: RepairableOrderRow,
  checkedAt: string,
): void => {
  const rows = database.prepare(`
    select stage_id,stage_json from production_stages
    where order_id=? order by ordinal
  `).all(order.order_id) as Array<{
    stage_id: string;
    stage_json: string;
  }>;
  const stages = rows.map((row) =>
    JSON.parse(row.stage_json) as XuanxueAiStageRecord);
  const invalidStage = stages.find((stage) =>
    stage.status === "completed"
    && Boolean(completedStageIntegrityFailure(stage)));
  if (!invalidStage) return;
  const reason = completedStageIntegrityFailure(invalidStage)!;
  const quarantined: XuanxueAiStageRecord = {
    ...invalidStage,
    status: "review_required",
    progressPhase: "terminal",
    failureReason: reason,
    updatedAt: checkedAt,
  };
  database.prepare(`
    update production_stages set status='review_required',
      stage_json=?,updated_at=? where order_id=? and stage_id=?
  `).run(
    JSON.stringify(quarantined),
    checkedAt,
    order.order_id,
    invalidStage.stageId,
  );
  database.prepare(`
    update production_orders set status='review_required',
      result_json=null,failure_reason=?,updated_at=? where order_id=?
  `).run(reason, checkedAt, order.order_id);
  appendXuanxueAiProductionEvent(database, {
    orderId: order.order_id,
    stageId: invalidStage.stageId,
    eventType: "invalid_completed_stage_quarantined",
    fromStatus: order.status,
    toStatus: "review_required",
    detail: {
      reason,
      policy: "preserve_invalid_output_and_require_operator_review",
      executionId: invalidStage.executionId,
      invalidRawOutputHash: invalidStage.rawOutputHash,
    },
    createdAt: checkedAt,
  });
};

export const quarantineInvalidCompletedStageOutputs = (
  database: Database.Database,
): void => {
  const orders = database.prepare(`
    select order_id,status from production_orders
    where status in ('queued','running','recovery_pending')
    order by created_at,order_id
  `).all() as RepairableOrderRow[];
  const checkedAt = new Date().toISOString();
  database.transaction(() => {
    for (const order of orders) {
      quarantineInvalidCompletedOrder(database, order, checkedAt);
    }
  })();
};
