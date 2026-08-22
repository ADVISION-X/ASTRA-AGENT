import type Database from "better-sqlite3";

import type {
  XuanxueAiOrderRecord,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import { appendXuanxueAiProductionEvent } from "./xuanxue-ai-production-store-event.js";

const recoverablePreSubmissionReason = (reason: string | null): boolean => {
  if (!reason) return false;
  const root = reason.match(
    /^review_required: web-chat execution is terminal: [^;]+; root=(.+)$/iu,
  )?.[1]?.trim() ?? reason.trim();
  return /^(?:BROWSER_EXTENSION_CHANNEL_UNAVAILABLE|BROWSER_LIVENESS_EXPIRED|BROWSER_SESSION_WORKSPACE_REQUIRED|BROWSER_SESSION_WORKSPACE_REVOKED|BROWSER_TARGET_INVALID|BROWSER_DOCUMENT_INVALID|BROWSER_BACKPRESSURE|BROWSER_AUTH_TRANSCRIPT_INVALID|BROWSER_CAPABILITY_REJECTED|WEB_CHAT_FRESH_CONVERSATION_HYDRATION_PENDING: BROWSER_TARGET_INVALID)$/u
    .test(root);
};

const legacyProfileReadbackReason =
  "review_required: NOT_PRODUCTION_VERIFIED: GPT pre-submit model and reasoning controls have no exact verified readback; GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH";
const legacyProfileStateFollowOnReason =
  "review_required: submitted web-chat execution is missing its durable submission proof.";
const v5ProtocolSqlPredicate =
  "json_extract(order_json,'$.protocolVersion')='xuanxue-ai-production-v5'";

const hasProviderOutputProof = (stage: XuanxueAiStageRecord): boolean => {
  const result = stage.aiFeedResult;
  const proof = result?.providerProof;
  return Boolean(stage.rawResponseText || stage.rawOutputHash
    || result?.rawResponseText || result?.rawOutputHash || proof?.outputHash
    || (proof?.outputRefs.length ?? 0) > 0);
};

const hasProviderMutationProof = (stage: XuanxueAiStageRecord): boolean => {
  const proof = stage.aiFeedResult?.providerProof;
  return Boolean(stage.attachmentUploadProof || proof?.attachmentUploadProof
    || proof?.webChatUrl || proof?.freshConversationProof
    || proof?.sameConversationProof || proof?.forkedFromCheckpointProof
    || (proof?.uploadedFileRefs?.length ?? 0) > 0
    || (proof?.uploadedFiles?.length ?? 0) > 0);
};

export const hasProviderSideEffectProof = (
  stage: XuanxueAiStageRecord,
): boolean => hasProviderOutputProof(stage) || hasProviderMutationProof(stage);

export const isProofEmptyTechnicalTerminal = (
  existing: XuanxueAiOrderRecord,
): boolean => existing.status === "failed" && existing.result === null
  && recoverablePreSubmissionReason(existing.failureReason)
  && existing.stages.some((stage) => stage.status === "failed")
  && existing.stages.every((stage) => stage.status !== "failed" || (
    recoverablePreSubmissionReason(stage.failureReason)
    && !hasProviderSideEffectProof(stage)
  ));

export const isProofEmptyProfileReadbackTerminal = (
  existing: XuanxueAiOrderRecord,
): boolean => existing.status === "review_required" && existing.result === null
  && existing.failureReason === legacyProfileReadbackReason
  && existing.stages.some((stage) => stage.status === "review_required")
  && existing.stages.every((stage) => stage.status !== "review_required" || (
    stage.failureReason === legacyProfileReadbackReason
    && !hasProviderSideEffectProof(stage)
  ));

export const isProofEmptyProfileStateFollowOnTerminal = (
  existing: XuanxueAiOrderRecord,
): boolean => existing.status === "failed" && existing.result === null
  && existing.failureReason === legacyProfileStateFollowOnReason
  && existing.stages.some((stage) => stage.status === "failed")
  && existing.stages.every((stage) => stage.status !== "failed" || (
    stage.failureReason === legacyProfileStateFollowOnReason
    && !hasProviderSideEffectProof(stage)
  ));

const reopenStage = (
  database: Database.Database,
  stage: XuanxueAiStageRecord,
  updatedAt: string,
  fromStatus: "failed" | "review_required",
  eventType: string,
): void => {
  const reopened = { ...stage, status: "recovery_pending" as const,
    progressPhase: "recovery_pending" as const, updatedAt };
  database.prepare(`
    update production_stages set status='recovery_pending',stage_json=?,updated_at=?
    where order_id=? and stage_id=? and status=?
  `).run(JSON.stringify(reopened), updatedAt, stage.orderId, stage.stageId, fromStatus);
  appendXuanxueAiProductionEvent(database, {
    orderId: stage.orderId, stageId: stage.stageId,
    eventType,
    fromStatus, toStatus: "recovery_pending",
    detail: { executionId: stage.executionId, preservedFailureReason: stage.failureReason },
    createdAt: updatedAt,
  });
};

const correctProofEmptyTerminalStages = (
  database: Database.Database,
  existing: XuanxueAiOrderRecord,
  updatedAt: string,
): void => {
  for (const stage of existing.stages.filter((item) => item.status === "failed")) {
    reopenStage(
      database,
      stage,
      updatedAt,
      "failed",
      "legacy_technical_terminal_stage_corrected",
    );
  }
};

const correctProofEmptyProfileReadbackStages = (
  database: Database.Database,
  existing: XuanxueAiOrderRecord,
  updatedAt: string,
): void => {
  for (const stage of existing.stages.filter(
    (item) => item.status === "review_required",
  )) {
    reopenStage(
      database,
      stage,
      updatedAt,
      "review_required",
      "legacy_profile_readback_terminal_stage_corrected",
    );
  }
};

const correctProofEmptyProfileStateFollowOnStages = (
  database: Database.Database,
  existing: XuanxueAiOrderRecord,
  updatedAt: string,
): void => {
  for (const stage of existing.stages.filter((item) => item.status === "failed")) {
    reopenStage(
      database,
      stage,
      updatedAt,
      "failed",
      "legacy_profile_state_followon_terminal_stage_corrected",
    );
  }
};

const LEGACY_TECHNICAL_TERMINAL_CORRECTION_VERSION = 1;
const LEGACY_PROFILE_READBACK_TERMINAL_CORRECTION_VERSION = 2;
const LEGACY_PROFILE_STATE_FOLLOWON_TERMINAL_CORRECTION_VERSION = 3;
const LEGACY_WORKSPACE_REVOKED_TERMINAL_CORRECTION_VERSION = 4;

type ReadOrder = (orderId: string) => XuanxueAiOrderRecord | null;

const applyTechnicalTerminalV1 = (
  database: Database.Database,
  readOrder: ReadOrder,
  version: number,
): void => {
  if (version >= LEGACY_TECHNICAL_TERMINAL_CORRECTION_VERSION) return;
  const rows = database.prepare(
    "select order_id from production_orders where status='failed' order by created_at,order_id",
  ).all() as Array<{ order_id: string }>;
  for (const row of rows) {
    const existing = readOrder(row.order_id);
    if (!existing || !isProofEmptyTechnicalTerminal(existing)) continue;
    const correctedAt = new Date().toISOString();
    correctProofEmptyTerminalStages(database, existing, correctedAt);
    database.prepare(`
      update production_orders set status='recovery_pending',updated_at=?
      where order_id=? and status='failed'
    `).run(correctedAt, existing.order.orderId);
    appendXuanxueAiProductionEvent(database, {
      orderId: existing.order.orderId, stageId: null,
      eventType: "legacy_technical_terminal_correction_applied",
      fromStatus: "failed", toStatus: "recovery_pending",
      detail: { migrationVersion: LEGACY_TECHNICAL_TERMINAL_CORRECTION_VERSION },
      createdAt: correctedAt,
    });
  }
};

const applyProfileReadbackTerminalV2 = (
  database: Database.Database,
  readOrder: ReadOrder,
  version: number,
): void => {
  if (version >= LEGACY_PROFILE_READBACK_TERMINAL_CORRECTION_VERSION) return;
  const rows = database.prepare(`select order_id from production_orders
    where status='review_required' and failure_reason=?
      and json_valid(order_json)=1 and ${v5ProtocolSqlPredicate}
    order by created_at,order_id`).all(legacyProfileReadbackReason) as Array<{
      order_id: string;
    }>;
  for (const row of rows) {
    const existing = readOrder(row.order_id);
    if (!existing || !isProofEmptyProfileReadbackTerminal(existing)) continue;
    const correctedAt = new Date().toISOString();
    correctProofEmptyProfileReadbackStages(database, existing, correctedAt);
    database.prepare(`update production_orders
      set status='recovery_pending',updated_at=?
      where order_id=? and status='review_required'`
    ).run(correctedAt, existing.order.orderId);
    appendXuanxueAiProductionEvent(database, {
      orderId: existing.order.orderId, stageId: null,
      eventType: "legacy_profile_readback_terminal_correction_applied",
      fromStatus: "review_required", toStatus: "recovery_pending",
      detail: { migrationVersion: LEGACY_PROFILE_READBACK_TERMINAL_CORRECTION_VERSION },
      createdAt: correctedAt,
    });
  }
};

const applyProfileStateFollowOnTerminalV3 = (
  database: Database.Database,
  readOrder: ReadOrder,
): void => {
  const rows = database.prepare(`select orders.order_id
    from production_orders orders
    where orders.status='failed' and orders.failure_reason=?
      and json_valid(orders.order_json)=1
      and json_extract(orders.order_json,'$.protocolVersion')='xuanxue-ai-production-v5'
      and exists (select 1 from production_events events
        where events.order_id=orders.order_id
          and events.event_type='legacy_profile_readback_terminal_correction_applied')
    order by orders.created_at,orders.order_id`
  ).all(legacyProfileStateFollowOnReason) as Array<{ order_id: string }>;
  for (const row of rows) {
    const existing = readOrder(row.order_id);
    if (!existing || !isProofEmptyProfileStateFollowOnTerminal(existing)) continue;
    const correctedAt = new Date().toISOString();
    correctProofEmptyProfileStateFollowOnStages(database, existing, correctedAt);
    database.prepare(`update production_orders
      set status='recovery_pending',updated_at=?
      where order_id=? and status='failed'`
    ).run(correctedAt, existing.order.orderId);
    appendXuanxueAiProductionEvent(database, {
      orderId: existing.order.orderId, stageId: null,
      eventType: "legacy_profile_state_followon_terminal_correction_applied",
      fromStatus: "failed", toStatus: "recovery_pending",
      detail: { migrationVersion: LEGACY_PROFILE_STATE_FOLLOWON_TERMINAL_CORRECTION_VERSION },
      createdAt: correctedAt,
    });
  }
};

const applyWorkspaceRevokedTerminalV4 = (
  database: Database.Database,
  readOrder: ReadOrder,
): void => {
  const rows = database.prepare(`select order_id from production_orders
    where status='failed' and failure_reason='BROWSER_SESSION_WORKSPACE_REVOKED'
      and json_valid(order_json)=1 and ${v5ProtocolSqlPredicate}
    order by created_at,order_id`).all() as Array<{ order_id: string }>;
  for (const row of rows) {
    const existing = readOrder(row.order_id);
    if (!existing || !isProofEmptyTechnicalTerminal(existing)) continue;
    const correctedAt = new Date().toISOString();
    correctProofEmptyTerminalStages(database, existing, correctedAt);
    database.prepare(`update production_orders
      set status='recovery_pending',updated_at=?
      where order_id=? and status='failed'`
    ).run(correctedAt, existing.order.orderId);
    appendXuanxueAiProductionEvent(database, {
      orderId: existing.order.orderId, stageId: null,
      eventType: "legacy_workspace_revoked_terminal_correction_applied",
      fromStatus: "failed", toStatus: "recovery_pending",
      detail: { migrationVersion: LEGACY_WORKSPACE_REVOKED_TERMINAL_CORRECTION_VERSION },
      createdAt: correctedAt,
    });
  }
};

export const applyLegacyTechnicalTerminalCorrection = (
  database: Database.Database,
  readOrder: ReadOrder,
): void => {
  const version = database.pragma("user_version", { simple: true }) as number;
  if (version >= LEGACY_WORKSPACE_REVOKED_TERMINAL_CORRECTION_VERSION) return;
  database.transaction(() => {
    applyTechnicalTerminalV1(database, readOrder, version);
    applyProfileReadbackTerminalV2(database, readOrder, version);
    applyProfileStateFollowOnTerminalV3(database, readOrder);
    applyWorkspaceRevokedTerminalV4(database, readOrder);
    database.pragma(
      `user_version = ${LEGACY_WORKSPACE_REVOKED_TERMINAL_CORRECTION_VERSION}`,
    );
  })();
};
