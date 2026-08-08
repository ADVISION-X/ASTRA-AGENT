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
  readonly rebuiltJobId: string | null;
  readonly rebuiltExecutionId: string | null;
  readonly rebuiltTurnMarker: string | null;
  readonly rebuiltInputBundleHash: string | null;
  readonly rebuiltConversationScopeRef: string | null;
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
           rebuilt_raw_output_hash,rebuilt_job_id,rebuilt_execution_id,
           rebuilt_turn_marker,rebuilt_input_bundle_hash,
           rebuilt_conversation_scope_ref,provider_page_url,rebuilt_at
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
    rebuilt_job_id: string | null;
    rebuilt_execution_id: string | null;
    rebuilt_turn_marker: string | null;
    rebuilt_input_bundle_hash: string | null;
    rebuilt_conversation_scope_ref: string | null;
    provider_page_url: string;
    rebuilt_at: string;
  } | undefined;
  return row
    ? {
        parentJobId: row.parent_job_id,
        parentStageId: row.parent_stage_id,
        originalRawOutputHash: row.original_raw_output_hash,
        rebuiltRawOutputHash: row.rebuilt_raw_output_hash,
        rebuiltJobId: row.rebuilt_job_id,
        rebuiltExecutionId: row.rebuilt_execution_id,
        rebuiltTurnMarker: row.rebuilt_turn_marker,
        rebuiltInputBundleHash: row.rebuilt_input_bundle_hash,
        rebuiltConversationScopeRef:
          row.rebuilt_conversation_scope_ref,
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

export const recordParentConversationRebuildInStore = (
  database: Database.Database,
  input: XuanxueAiParentConversationRebuild,
): void => {
  database.transaction(() => {
    database.prepare(`
      insert into production_parent_conversation_rebuilds(
      parent_job_id,parent_stage_id,original_raw_output_hash,
      rebuilt_raw_output_hash,rebuilt_job_id,rebuilt_execution_id,
      rebuilt_turn_marker,
      rebuilt_input_bundle_hash,rebuilt_conversation_scope_ref,
      provider_page_url,rebuilt_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)
    on conflict(
      parent_job_id,parent_stage_id,original_raw_output_hash
    ) do update set
      rebuilt_raw_output_hash=excluded.rebuilt_raw_output_hash,
      rebuilt_job_id=excluded.rebuilt_job_id,
      rebuilt_execution_id=excluded.rebuilt_execution_id,
      rebuilt_turn_marker=excluded.rebuilt_turn_marker,
      rebuilt_input_bundle_hash=excluded.rebuilt_input_bundle_hash,
      rebuilt_conversation_scope_ref=excluded.rebuilt_conversation_scope_ref,
      provider_page_url=excluded.provider_page_url,
      rebuilt_at=excluded.rebuilt_at
    `).run(
      input.parentJobId,
      input.parentStageId,
      input.originalRawOutputHash,
      input.rebuiltRawOutputHash,
      input.rebuiltJobId,
      input.rebuiltExecutionId,
      input.rebuiltTurnMarker,
      input.rebuiltInputBundleHash,
      input.rebuiltConversationScopeRef,
      input.providerPageUrl,
      input.rebuiltAt,
    );
    appendXuanxueAiProductionEvent(database, {
      orderId: input.parentJobId,
      stageId: input.parentStageId,
      eventType: "parent_conversation_rebuild_recorded",
      fromStatus: "completed",
      toStatus: "completed",
      detail: {
        originalRawOutputHash: input.originalRawOutputHash,
        rebuiltJobId: input.rebuiltJobId,
        rebuiltExecutionId: input.rebuiltExecutionId,
        rebuiltRawOutputHash: input.rebuiltRawOutputHash,
        providerPageUrl: input.providerPageUrl,
      },
      createdAt: input.rebuiltAt,
    });
  })();
};
