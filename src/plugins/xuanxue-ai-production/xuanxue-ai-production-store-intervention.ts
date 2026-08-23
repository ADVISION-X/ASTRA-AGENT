import type Database from "better-sqlite3";

import type {
  XuanxueAiInterventionRecord,
  XuanxueAiInterventionRequest,
  XuanxueAiInterventionState,
  XuanxueAiOrderRecord,
} from "./xuanxue-ai-production.schema.js";

type InterventionAction = "pause" | "cancel" | "takeover";

interface InterventionRow {
  order_id: string;
  revision: number;
  state: XuanxueAiInterventionState;
  reason: string | null;
  request_id: string | null;
  pending_request: InterventionAction | null;
  last_control_epoch: number;
  last_safe_checkpoint: string | null;
  requested_at: string | null;
  updated_at: string;
}

const mapRow = (row: InterventionRow): XuanxueAiInterventionRecord => ({
  orderId: row.order_id,
  revision: row.revision,
  state: row.state,
  reason: row.reason,
  requestId: row.request_id,
  pendingRequest: row.pending_request,
  lastControlEpoch: row.last_control_epoch,
  lastSafeCheckpoint: row.last_safe_checkpoint,
  requestedAt: row.requested_at,
  updatedAt: row.updated_at,
});

const ensureOrder = (
  database: Database.Database,
  orderId: string,
): void => {
  const exists = database.prepare(
    "select 1 as present from production_orders where order_id = ?",
  ).get(orderId) as { present: number } | undefined;
  if (!exists) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
};

const initialState = (status: XuanxueAiOrderRecord["status"]): XuanxueAiInterventionState => {
  if (status === "cancelled") return "cancelled";
  if (status === "review_required") return "review_required";
  return "running";
};

export const readXuanxueAiIntervention = (
  database: Database.Database,
  readOrder: (orderId: string) => XuanxueAiOrderRecord | null,
  orderId: string,
): XuanxueAiInterventionRecord => {
  ensureOrder(database, orderId);
  const existing = database.prepare(
    "select * from production_interventions where order_id = ?",
  ).get(orderId) as InterventionRow | undefined;
  if (existing) return mapRow(existing);
  const order = readOrder(orderId)!;
  const now = new Date().toISOString();
  database.prepare(`
    insert into production_interventions(
      order_id,revision,state,reason,request_id,pending_request,
      last_safe_checkpoint,requested_at,updated_at
    ) values(?,0,?,null,null,null,null,null,?)
  `).run(orderId, initialState(order.status), now);
  return mapRow(database.prepare(
    "select * from production_interventions where order_id = ?",
  ).get(orderId) as InterventionRow);
};

const requestedState = (
  action: InterventionAction,
): XuanxueAiInterventionState => `${action}_requested` as XuanxueAiInterventionState;

const acknowledgedState = (
  action: InterventionAction,
): XuanxueAiInterventionState => action === "pause"
  ? "paused"
  : action === "cancel"
    ? "cancelled"
    : "taken_over";

const appendEvent = (
  database: Database.Database,
  input: {
    orderId: string;
    eventType: string;
    fromState: string;
    toState: string;
    detail: Record<string, unknown>;
    createdAt: string;
  },
): void => {
  database.prepare(`
    insert into production_events(
      order_id,stage_id,event_type,from_status,to_status,detail_json,created_at
    ) values(?,null,?,?,?,?,?)
  `).run(
    input.orderId,
    input.eventType,
    input.fromState,
    input.toState,
    JSON.stringify(input.detail),
    input.createdAt,
  );
};

export const requestXuanxueAiIntervention = (
  database: Database.Database,
  readOrder: (orderId: string) => XuanxueAiOrderRecord | null,
  action: InterventionAction,
  input: XuanxueAiInterventionRequest,
  controlEpoch?: number,
): XuanxueAiInterventionRecord => database.transaction(() => {
  const current = readXuanxueAiIntervention(database, readOrder, input.orderId);
  if (controlEpoch !== undefined && (!Number.isInteger(controlEpoch) || controlEpoch < 1)) {
    throw new Error("XUANXUE_AI_CONTROL_EPOCH_INVALID");
  }
  if (controlEpoch !== undefined && controlEpoch <= current.lastControlEpoch) return current;
  if (current.revision !== input.expectedRevision) {
    throw new Error("XUANXUE_AI_INTERVENTION_STALE_REVISION");
  }
  if (current.state !== "running") {
    throw new Error(`XUANXUE_AI_INTERVENTION_INVALID_STATE:${current.state}`);
  }
  const now = new Date().toISOString();
  const nextState = requestedState(action);
  appendEvent(database, {
    orderId: input.orderId,
    eventType: "INTERVENTION_REQUESTED",
    fromState: current.state,
    toState: nextState,
    detail: {
      action,
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      requestId: input.requestId,
    },
    createdAt: now,
  });
  const changed = database.prepare(`
    update production_interventions
    set revision = revision + 1,state = ?,reason = ?,request_id = ?,
        pending_request = ?,last_control_epoch = ?,requested_at = ?,updated_at = ?
    where order_id = ? and revision = ? and state = 'running'
  `).run(
    nextState,
    input.reason,
    input.requestId,
    action,
    controlEpoch ?? current.lastControlEpoch,
    now,
    now,
    input.orderId,
    input.expectedRevision,
  );
  if (changed.changes !== 1) {
    throw new Error("XUANXUE_AI_INTERVENTION_CAS_FAILED");
  }
  return readXuanxueAiIntervention(database, readOrder, input.orderId);
})();

export const resumeXuanxueAiIntervention = (
  database: Database.Database,
  readOrder: (orderId: string) => XuanxueAiOrderRecord | null,
  input: XuanxueAiInterventionRequest,
): XuanxueAiInterventionRecord => database.transaction(() => {
  const current = readXuanxueAiIntervention(database, readOrder, input.orderId);
  if (current.revision !== input.expectedRevision) {
    throw new Error("XUANXUE_AI_INTERVENTION_STALE_REVISION");
  }
  if (!(["paused", "taken_over", "recovery_pending"] as const).includes(
    current.state as "paused" | "taken_over" | "recovery_pending",
  )) {
    throw new Error(`XUANXUE_AI_INTERVENTION_INVALID_STATE:${current.state}`);
  }
  const now = new Date().toISOString();
  appendEvent(database, {
    orderId: input.orderId,
    eventType: "INTERVENTION_RESUMED",
    fromState: current.state,
    toState: "running",
    detail: {
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      requestId: input.requestId,
    },
    createdAt: now,
  });
  database.prepare(`
    update production_interventions
    set revision = revision + 1,state = 'running',reason = ?,request_id = ?,
        pending_request = null,requested_at = ?,updated_at = ?
    where order_id = ? and revision = ?
  `).run(input.reason, input.requestId, now, now, input.orderId, input.expectedRevision);
  database.prepare(`
    update production_orders
    set status = 'queued',failure_reason = null,updated_at = ?
    where order_id = ? and status = 'recovery_pending'
  `).run(now, input.orderId);
  return readXuanxueAiIntervention(database, readOrder, input.orderId);
})();

export const acknowledgeXuanxueAiIntervention = (
  database: Database.Database,
  readOrder: (orderId: string) => XuanxueAiOrderRecord | null,
  orderId: string,
  checkpoint: string,
): XuanxueAiInterventionRecord | null => database.transaction(() => {
  const current = readXuanxueAiIntervention(database, readOrder, orderId);
  const action = current.pendingRequest;
  if (!action || current.state !== requestedState(action)) return null;
  const now = new Date().toISOString();
  const nextState = acknowledgedState(action);
  appendEvent(database, {
    orderId,
    eventType: "INTERVENTION_ACK",
    fromState: current.state,
    toState: nextState,
    detail: {
      action,
      revision: current.revision,
      requestId: current.requestId,
      checkpoint,
    },
    createdAt: now,
  });
  database.prepare(`
    update production_interventions
    set state = ?,pending_request = null,last_safe_checkpoint = ?,updated_at = ?
    where order_id = ? and revision = ? and state = ?
  `).run(nextState, checkpoint, now, orderId, current.revision, current.state);
  database.prepare(`
    update production_orders
    set status = ?,failure_reason = ?,updated_at = ?
    where order_id = ?
  `).run(
    action === "cancel" ? "cancelled" : "recovery_pending",
    `XUANXUE_AI_INTERVENTION_${action.toUpperCase()}@${checkpoint}`,
    now,
    orderId,
  );
  return readXuanxueAiIntervention(database, readOrder, orderId);
})();
