import type Database from "better-sqlite3";

export type XuanxueAiControlIntent = "none" | "pause_requested" | "cancel_requested" | "handover_requested";

export type XuanxueAiControlIntentProjection = Readonly<{
  orderId: string;
  intent: XuanxueAiControlIntent;
  controlEpoch: number;
  acknowledgedEpoch: number;
  reasonCode: string | null;
  lastSafeCheckpoint: string | null;
}>;

type ControlRow = Readonly<{
  order_id: string;
  status: string;
  failure_reason: string | null;
  control_intent: XuanxueAiControlIntent;
  control_epoch: number;
  control_ack_epoch: number;
  control_reason: string | null;
  control_checkpoint: string | null;
}>;

const readRow = (database: Database.Database, orderId: string): ControlRow => {
  const row = database.prepare(`select order_id,status,failure_reason,control_intent,control_epoch,
    control_ack_epoch,control_reason,control_checkpoint from production_orders where order_id=?`).get(orderId) as ControlRow | undefined;
  if (!row) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  return row;
};

const projection = (row: ControlRow): XuanxueAiControlIntentProjection => ({
  orderId: row.order_id,
  intent: row.control_intent,
  controlEpoch: row.control_epoch,
  acknowledgedEpoch: row.control_ack_epoch,
  reasonCode: row.control_reason,
  lastSafeCheckpoint: row.control_checkpoint,
});

export const readXuanxueAiControlIntent = (
  database: Database.Database,
  orderId: string,
): XuanxueAiControlIntentProjection => Object.freeze(projection(readRow(database, orderId)));

export const applyXuanxueAiControlIntent = (
  database: Database.Database,
  orderId: string,
  intent: XuanxueAiControlIntent,
  controlEpoch: number,
  reasonCode: string | null,
): XuanxueAiControlIntentProjection => database.transaction(() => {
  if (!Number.isInteger(controlEpoch) || controlEpoch < 0) throw new Error("XUANXUE_AI_CONTROL_EPOCH_INVALID");
  const current = readRow(database, orderId);
  if (controlEpoch <= current.control_epoch) return projection(current);
  const resumePausedOrder = intent === "none" && current.status === "recovery_pending"
    && /^XUANXUE_AI_CONTROL_(?:PAUSE|HANDOVER)@/u.test(current.failure_reason ?? "");
  database.prepare(`update production_orders set
    control_intent=?,control_epoch=?,control_reason=?,control_checkpoint=null,
    control_ack_epoch=case when ?='none' then ? else control_ack_epoch end,
    status=case when ? then 'queued' else status end,
    failure_reason=case when ? then null else failure_reason end,
    updated_at=? where order_id=?`).run(
      intent, controlEpoch, reasonCode, intent, controlEpoch,
      resumePausedOrder ? 1 : 0, resumePausedOrder ? 1 : 0,
      new Date().toISOString(), orderId,
    );
  return projection(readRow(database, orderId));
})();

export const acknowledgeXuanxueAiControlIntent = (
  database: Database.Database,
  orderId: string,
  checkpoint: string,
): XuanxueAiControlIntentProjection | null => database.transaction(() => {
  const current = readRow(database, orderId);
  if (current.control_intent === "none" || current.control_ack_epoch >= current.control_epoch) return null;
  const cancelled = current.control_intent === "cancel_requested";
  const label = current.control_intent === "pause_requested" ? "PAUSE"
    : current.control_intent === "cancel_requested" ? "CANCEL" : "HANDOVER";
  database.prepare(`update production_orders set
    control_ack_epoch=control_epoch,control_checkpoint=?,status=?,failure_reason=?,updated_at=?
    where order_id=? and control_ack_epoch<control_epoch`).run(
      checkpoint, cancelled ? "cancelled" : "recovery_pending",
      `XUANXUE_AI_CONTROL_${label}@${checkpoint}`, new Date().toISOString(), orderId,
    );
  return projection(readRow(database, orderId));
})();
