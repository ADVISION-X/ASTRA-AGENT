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
} from "./xuanxue-ai-production-store-orders.js";

export interface XuanxueAiParentConversationRebuild {
  readonly parentJobId: string;
  readonly parentStageId: string;
  readonly originalRawOutputHash: string;
  readonly rebuiltRawOutputHash: string;
  readonly providerPageUrl: string;
  readonly rebuiltAt: string;
}

export const readParentConversationRebuildFromStore = (
  database: Database.Database,
  input: Pick<
    XuanxueAiParentConversationRebuild,
    "parentJobId" | "parentStageId" | "originalRawOutputHash"
  >,
): XuanxueAiParentConversationRebuild | null => {
  const row = database.prepare(`
    select parent_job_id,parent_stage_id,original_raw_output_hash,
           rebuilt_raw_output_hash,provider_page_url,rebuilt_at
    from production_parent_conversation_rebuilds
    where parent_job_id=? and parent_stage_id=?
      and original_raw_output_hash=?
  `).get(
    input.parentJobId,
    input.parentStageId,
    input.originalRawOutputHash,
  ) as {
    parent_job_id: string;
    parent_stage_id: string;
    original_raw_output_hash: string;
    rebuilt_raw_output_hash: string;
    provider_page_url: string;
    rebuilt_at: string;
  } | undefined;
  return row
    ? {
        parentJobId: row.parent_job_id,
        parentStageId: row.parent_stage_id,
        originalRawOutputHash: row.original_raw_output_hash,
        rebuiltRawOutputHash: row.rebuilt_raw_output_hash,
        providerPageUrl: row.provider_page_url,
        rebuiltAt: row.rebuilt_at,
      }
    : null;
};

const resetStagesForConversationRebuild = (
  database: Database.Database,
  record: XuanxueAiOrderRecord,
  rebuiltAt: string,
  executionPurpose: "conversation-graph-rebuild" | "parent-rebuild",
): void => {
  for (const stage of record.stages) {
    const queued: XuanxueAiStageRecord = {
      ...stage,
      executionId:
        `${stage.orderId}:${stage.stageId}:${executionPurpose}:`
        + `${stage.attemptCount + 1}`,
      supersededExecutionId: stage.executionId,
      status: "queued",
      aiFeedResult: null,
      rawResponseText: null,
      rawOutputHash: null,
      progressPhase: "queued",
      failureReason: null,
      createdAt: rebuiltAt,
      updatedAt: rebuiltAt,
    };
    database.prepare(`
      update production_stages
      set status='queued',stage_json=?,updated_at=?
      where order_id=? and stage_id=?
    `).run(
      JSON.stringify(queued),
      rebuiltAt,
      record.order.orderId,
      stage.stageId,
    );
  }
  database.prepare(`
    update production_orders
    set status='queued',result_json=null,failure_reason=null,updated_at=?
    where order_id=?
  `).run(rebuiltAt, record.order.orderId);
};

export const resetOrderForConversationGraphRebuildInStore = (
  database: Database.Database,
  readOrder: XuanxueAiOrderReader,
  orderId: string,
  input: { readonly triggeringStageId: string; readonly reason: string },
): XuanxueAiOrderRecord => {
  const record = readOrder(orderId);
  if (!record) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  const rebuiltAt = new Date().toISOString();
  database.transaction(() => {
    resetStagesForConversationRebuild(
      database,
      record,
      rebuiltAt,
      "conversation-graph-rebuild",
    );
    appendXuanxueAiProductionEvent(database, {
      orderId,
      stageId: input.triggeringStageId,
      eventType: "conversation_graph_rebuild_started",
      fromStatus: record.status,
      toStatus: "queued",
      detail: {
        reason: input.reason.slice(0, 1_000),
        policy: "replay_from_first_stage_in_one_new_conversation",
        supersededStages: record.stages.map((stage) => ({
          stageId: stage.stageId,
          executionId: stage.executionId,
          status: stage.status,
          rawOutputHash: stage.rawOutputHash,
          conversationUrl:
            stage.aiFeedResult?.providerProof.webChatUrl ?? null,
        })),
        forbiddenFallback: "blank_continuation_chat",
      },
      createdAt: rebuiltAt,
    });
  })();
  return readOrder(orderId)!;
};

export const resetOrderForParentConversationRebuildInStore = (
  database: Database.Database,
  readOrder: XuanxueAiOrderReader,
  orderId: string,
): XuanxueAiOrderRecord => {
  const record = readOrder(orderId);
  if (!record || record.status !== "completed") {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REBUILD_SOURCE_NOT_COMPLETED",
    );
  }
  const rebuiltAt = new Date().toISOString();
  database.transaction(() => {
    resetStagesForConversationRebuild(
      database,
      record,
      rebuiltAt,
      "parent-rebuild",
    );
    appendXuanxueAiProductionEvent(database, {
      orderId,
      stageId: null,
      eventType: "parent_conversation_rebuild_started",
      fromStatus: record.status,
      toStatus: "queued",
      detail: { reason: "exact_parent_conversation_unavailable" },
      createdAt: rebuiltAt,
    });
  })();
  return readOrder(orderId)!;
};

export const recordParentConversationRebuildInStore = (
  database: Database.Database,
  input: XuanxueAiParentConversationRebuild,
): void => {
  database.prepare(`
    insert into production_parent_conversation_rebuilds(
      parent_job_id,parent_stage_id,original_raw_output_hash,
      rebuilt_raw_output_hash,provider_page_url,rebuilt_at
    ) values(?,?,?,?,?,?)
    on conflict(
      parent_job_id,parent_stage_id,original_raw_output_hash
    ) do update set
      rebuilt_raw_output_hash=excluded.rebuilt_raw_output_hash,
      provider_page_url=excluded.provider_page_url,
      rebuilt_at=excluded.rebuilt_at
  `).run(
    input.parentJobId,
    input.parentStageId,
    input.originalRawOutputHash,
    input.rebuiltRawOutputHash,
    input.providerPageUrl,
    input.rebuiltAt,
  );
};
