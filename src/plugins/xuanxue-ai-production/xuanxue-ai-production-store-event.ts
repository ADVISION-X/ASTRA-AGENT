import type Database from "better-sqlite3";

export interface XuanxueAiProductionEventInput {
  readonly orderId: string;
  readonly stageId: string | null;
  readonly eventType: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export const appendXuanxueAiProductionEvent = (
  database: Database.Database,
  input: XuanxueAiProductionEventInput,
): void => {
  database.prepare(`
    insert into production_events(
      order_id,stage_id,event_type,from_status,to_status,detail_json,created_at
    ) values(?,?,?,?,?,?,?)
  `).run(
    input.orderId,
    input.stageId,
    input.eventType,
    input.fromStatus,
    input.toStatus,
    JSON.stringify(input.detail),
    input.createdAt,
  );
};
