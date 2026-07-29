import type Database from "better-sqlite3";
import { createHash } from "node:crypto";

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

interface RepairableStageRow {
  order_id: string;
  stage_id: string;
  status: XuanxueAiStageStatus;
  stage_json: string;
}

const canonicalOutputHash = (rawResponseText: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(
    Buffer.from(rawResponseText, "utf8"),
  ).digest("hex")}`;

const normalizedOutputHash = (value: string): string =>
  value.startsWith("sha256:") ? value : `sha256:${value}`;

const canonicalStageRepair = (
  stage: XuanxueAiStageRecord,
  now: string,
): XuanxueAiStageRecord | null => {
  if (!stage.rawResponseText || !stage.rawOutputHash) return null;
  const canonical = canonicalOutputHash(stage.rawResponseText);
  const providerRecorded = stage.aiFeedResult?.providerProof.outputHash;
  const feedRecorded = stage.aiFeedResult?.rawOutputHash;
  const identityMismatch =
    normalizedOutputHash(stage.rawOutputHash) !== canonical
    || (providerRecorded
      && normalizedOutputHash(providerRecorded) !== canonical)
    || (feedRecorded && normalizedOutputHash(feedRecorded) !== canonical);
  if (
    identityMismatch
    || (
      stage.rawOutputHash === canonical
      && (!feedRecorded || feedRecorded === canonical)
      && (!providerRecorded || providerRecorded === canonical)
    )
  ) return null;
  return {
    ...stage,
    rawOutputHash: canonical,
    aiFeedResult: stage.aiFeedResult
      ? {
          ...stage.aiFeedResult,
          rawOutputHash: feedRecorded ? canonical : null,
          providerProof: {
            ...stage.aiFeedResult.providerProof,
            outputHash: providerRecorded ? canonical : null,
          },
        }
      : null,
    updatedAt: now,
  };
};

const recoverDependencyHashFailure = (
  database: Database.Database,
  orderId: string,
  now: string,
): void => {
  const order = database.prepare(`
    select status,failure_reason from production_orders where order_id=?
  `).get(orderId) as {
    status: XuanxueAiOrderStatus;
    failure_reason: string | null;
  } | undefined;
  if (
    order?.status !== "failed"
    || !order.failure_reason?.startsWith(
      "XUANXUE_AI_PRODUCTION_DEPENDENCY_HASH_MISMATCH:",
    )
  ) return;
  const rows = database.prepare(`
    select stage_id,stage_json from production_stages
    where order_id=? and status!='completed' order by ordinal
  `).all(orderId) as Array<{ stage_id: string; stage_json: string }>;
  for (const row of rows) {
    const stage = JSON.parse(row.stage_json) as XuanxueAiStageRecord;
    if (stage.rawResponseText || stage.aiFeedResult) continue;
    const queued = {
      ...stage,
      status: "queued" as const,
      attemptCount: Math.max(0, stage.attemptCount - 1),
      progressPhase: "queued" as const,
      failureReason: null,
      updatedAt: now,
    };
    database.prepare(`
      update production_stages set status='queued',stage_json=?,updated_at=?
      where order_id=? and stage_id=?
    `).run(JSON.stringify(queued), now, orderId, row.stage_id);
  }
  database.prepare(`
    update production_orders set status='recovery_pending',result_json=null,
      failure_reason=null,updated_at=? where order_id=?
  `).run(now, orderId);
  appendXuanxueAiProductionEvent(database, {
    orderId,
    stageId: null,
    eventType: "order_output_hash_repaired",
    fromStatus: "failed",
    toStatus: "recovery_pending",
    detail: {
      repair: "canonical_sha256_prefix_verified_against_raw_response_bytes",
    },
    createdAt: now,
  });
};

export const repairCanonicalOutputHashState = (
  database: Database.Database,
): void => {
  const rows = database.prepare(`
    select order_id,stage_id,status,stage_json
    from production_stages order by order_id,ordinal
  `).all() as RepairableStageRow[];
  const now = new Date().toISOString();
  database.transaction(() => {
    const repairedOrders = new Set<string>();
    for (const row of rows) {
      const repaired = canonicalStageRepair(
        JSON.parse(row.stage_json) as XuanxueAiStageRecord,
        now,
      );
      if (!repaired) continue;
      database.prepare(`
        update production_stages set stage_json=?,updated_at=?
        where order_id=? and stage_id=?
      `).run(JSON.stringify(repaired), now, row.order_id, row.stage_id);
      repairedOrders.add(row.order_id);
    }
    for (const orderId of repairedOrders) {
      recoverDependencyHashFailure(database, orderId, now);
    }
  })();
};

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
    /(?:foreign cloud recovery ledger|immutable (?:input|identity)|invalid input package|cancel(?:led|ed)|authorization scope mismatch)/iu
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
