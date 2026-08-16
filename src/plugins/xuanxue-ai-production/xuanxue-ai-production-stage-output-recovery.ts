import type Database from "better-sqlite3";

import {
  type XuanxueAiOrderStatus,
  type XuanxueAiStageRecord,
  type XuanxueAiStageStatus,
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

const restartInvalidCompletedOrder = (
  database: Database.Database,
  order: RepairableOrderRow,
  repairedAt: string,
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
  const invalidIndex = stages.findIndex((stage) =>
    stage.status === "completed"
    && Boolean(completedStageIntegrityFailure(stage)));
  if (invalidIndex < 0) return;
  const invalidStage = stages[invalidIndex]!;
  const reason = completedStageIntegrityFailure(invalidStage)!;
  for (const stage of stages.slice(invalidIndex)) {
    const recovered: XuanxueAiStageRecord = {
      ...stage,
      executionId:
        `${stage.orderId}:${stage.stageId}:output-integrity-recovery:`
        + `${stage.attemptCount + 1}`,
      supersededExecutionId: stage.executionId,
      status: "queued",
      aiFeedResult: null,
      rawResponseText: null,
      rawOutputHash: null,
      progressPhase: "queued",
      failureReason: null,
      createdAt: repairedAt,
      updatedAt: repairedAt,
    };
    database.prepare(`
      update production_stages set status='queued',
        stage_json=?,updated_at=? where order_id=? and stage_id=?
    `).run(
      JSON.stringify(recovered),
      repairedAt,
      order.order_id,
      stage.stageId,
    );
  }
  database.prepare(`
    update production_orders set status='recovery_pending',
      result_json=null,failure_reason=null,updated_at=? where order_id=?
  `).run(repairedAt, order.order_id);
  appendXuanxueAiProductionEvent(database, {
    orderId: order.order_id,
    stageId: invalidStage.stageId,
    eventType: "invalid_completed_stage_restarted",
    fromStatus: order.status,
    toStatus: "recovery_pending",
    detail: {
      reason,
      policy: "discard_invalid_output_and_replay_from_invalid_stage",
      supersededExecutionId: invalidStage.executionId,
      invalidRawOutputHash: invalidStage.rawOutputHash,
    },
    createdAt: repairedAt,
  });
};

export const repairInvalidCompletedStageOutputs = (
  database: Database.Database,
): void => {
  const orders = database.prepare(`
    select order_id,status from production_orders
    where status in (
      'queued','running','recovery_pending','review_required','failed'
    ) order by created_at,order_id
  `).all() as RepairableOrderRow[];
  const repairedAt = new Date().toISOString();
  database.transaction(() => {
    for (const order of orders) {
      restartInvalidCompletedOrder(database, order, repairedAt);
    }
  })();
};

const providerFailureIsRecoverable = (
  stage: XuanxueAiStageRecord,
  fallbackReason: string | null,
): boolean => {
  const reason = stage.failureReason ?? fallbackReason ?? "";
  const immutableOrForeignFailure =
    /(?:foreign cloud recovery ledger|immutable (?:input|identity)|invalid input package|cancel(?:led|ed)|authorization scope mismatch|PARENT_REBUILD_HASH_MISMATCH)/iu
      .test(reason);
  return !stage.rawResponseText
    && !stage.rawOutputHash
    && !immutableOrForeignFailure;
};

interface ProviderFailureRow {
  order_id: string;
  failure_reason: string | null;
  stage_id: string;
  stage_json: string;
}

const reclassifyProviderFailure = (
  database: Database.Database,
  row: ProviderFailureRow,
  now: string,
): void => {
  const stage = JSON.parse(row.stage_json) as XuanxueAiStageRecord;
  if (!providerFailureIsRecoverable(stage, row.failure_reason)) return;
  const reason = stage.failureReason ?? row.failure_reason ?? "";
  const recovered: XuanxueAiStageRecord = {
    ...stage,
    status: "recovery_pending",
    progressPhase: "recovery_pending",
    updatedAt: now,
  };
  database.prepare(`
    update production_stages set status='recovery_pending',
      stage_json=?,updated_at=? where order_id=? and stage_id=?
  `).run(JSON.stringify(recovered), now, row.order_id, row.stage_id);
  database.prepare(`
    update production_orders set status='recovery_pending',
      result_json=null,updated_at=?
    where order_id=? and status in ('failed','review_required')
  `).run(now, row.order_id);
  appendXuanxueAiProductionEvent(database, {
    orderId: row.order_id,
    stageId: row.stage_id,
    eventType: "transient_provider_failure_reclassified",
    fromStatus: stage.status,
    toStatus: "recovery_pending",
    detail: { reason },
    createdAt: now,
  });
};

export const repairRecoverableProviderFailures = (
  database: Database.Database,
): void => {
  const rows = database.prepare(`
    select o.order_id,o.failure_reason,s.stage_id,s.stage_json
    from production_orders o join production_stages s on s.order_id=o.order_id
    where o.status in ('failed','review_required')
      and s.status in ('failed','review_required')
    order by o.created_at,s.ordinal
  `).all() as ProviderFailureRow[];
  const now = new Date().toISOString();
  database.transaction(() => {
    for (const row of rows) reclassifyProviderFailure(database, row, now);
  })();
};
