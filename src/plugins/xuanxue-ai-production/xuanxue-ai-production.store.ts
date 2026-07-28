import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import {
  XuanxueAiProductionOrderSchema,
  type XuanxueAiOrderRecord,
  type XuanxueAiOrderStatus,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionResult,
  type XuanxueAiStageRecord,
  type XuanxueAiStageStatus,
} from "./xuanxue-ai-production.schema.js";

interface OrderRow {
  order_json: string;
  status: XuanxueAiOrderStatus;
  result_json: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface StageRow {
  stage_json: string;
}

const databasePath = (dataDir: string): string =>
  path.join(
    dataDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "xuanxue_ai_production.sqlite",
  );

export class XuanxueAiProductionStore {
  private readonly database: Database.Database;

  constructor(dataDir: string) {
    const filePath = databasePath(dataDir);
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.database = new Database(filePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");
    this.database.exec(`
      create table if not exists production_orders (
        order_id text primary key,
        source_task_id text not null,
        product_id text not null,
        request_hash text not null,
        status text not null,
        order_json text not null,
        result_json text,
        failure_reason text,
        created_at text not null,
        updated_at text not null
      );
      create unique index if not exists production_orders_source_task
        on production_orders(source_task_id);
      create table if not exists production_stages (
        order_id text not null references production_orders(order_id),
        stage_id text not null,
        ordinal integer not null,
        status text not null,
        stage_json text not null,
        updated_at text not null,
        primary key(order_id, stage_id),
        unique(order_id, ordinal)
      );
      create table if not exists production_events (
        event_id integer primary key autoincrement,
        order_id text not null references production_orders(order_id),
        stage_id text,
        event_type text not null,
        from_status text,
        to_status text not null,
        detail_json text not null,
        created_at text not null
      );
    `);
  }

  close(): void {
    this.database.close();
  }

  createOrder(
    order: XuanxueAiProductionOrder,
    stages: readonly XuanxueAiStageRecord[],
  ): XuanxueAiOrderRecord {
    const existing = this.readOrder(order.orderId);
    if (existing) {
      if (existing.order.requestHash !== order.requestHash) {
        throw new Error("XUANXUE_AI_PRODUCTION_ORDER_IDENTITY_CONFLICT");
      }
      return existing;
    }
    const bySource = this.database.prepare(
      "select order_json from production_orders where source_task_id=?",
    ).get(order.sourceTaskId) as Pick<OrderRow, "order_json"> | undefined;
    if (bySource) {
      const stored = XuanxueAiProductionOrderSchema.parse(
        JSON.parse(bySource.order_json),
      );
      if (stored.requestHash !== order.requestHash) {
        throw new Error("XUANXUE_AI_PRODUCTION_SOURCE_TASK_CONFLICT");
      }
      return this.readOrder(stored.orderId)!;
    }
    const insert = this.database.transaction(() => {
      this.database.prepare(`
        insert into production_orders(
          order_id,source_task_id,product_id,request_hash,status,order_json,
          result_json,failure_reason,created_at,updated_at
        ) values(?,?,?,?,? ,?,null,null,?,?)
      `).run(
        order.orderId,
        order.sourceTaskId,
        order.productId,
        order.requestHash,
        "queued",
        JSON.stringify(order),
        order.createdAt,
        order.createdAt,
      );
      const statement = this.database.prepare(`
        insert into production_stages(
          order_id,stage_id,ordinal,status,stage_json,updated_at
        ) values(?,?,?,?,?,?)
      `);
      for (const stage of stages) {
        statement.run(
          order.orderId,
          stage.stageId,
          stage.ordinal,
          stage.status,
          JSON.stringify(stage),
          stage.updatedAt,
        );
      }
      this.appendEvent(
        order.orderId,
        null,
        "order_queued",
        null,
        "queued",
        { requestHash: order.requestHash },
        order.createdAt,
      );
    });
    insert();
    return this.readOrder(order.orderId)!;
  }

  readOrder(orderId: string): XuanxueAiOrderRecord | null {
    const row = this.database.prepare(
      "select * from production_orders where order_id=?",
    ).get(orderId) as OrderRow | undefined;
    if (!row) return null;
    const stageRows = this.database.prepare(`
      select stage_json from production_stages
      where order_id=? order by ordinal
    `).all(orderId) as StageRow[];
    return {
      order: XuanxueAiProductionOrderSchema.parse(JSON.parse(row.order_json)),
      status: row.status,
      stages: stageRows.map((stage) =>
        JSON.parse(stage.stage_json) as XuanxueAiStageRecord),
      result: row.result_json
        ? JSON.parse(row.result_json) as XuanxueAiProductionResult
        : null,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listRecoverableOrders(): XuanxueAiOrderRecord[] {
    const rows = this.database.prepare(`
      select order_id from production_orders
      where status in ('queued','running','recovery_pending')
      order by created_at,order_id
    `).all() as { order_id: string }[];
    return rows.map((row) => this.readOrder(row.order_id)!);
  }

  updateStage(
    stage: XuanxueAiStageRecord,
    eventType: string,
  ): XuanxueAiStageRecord {
    const current = this.database.prepare(`
      select status from production_stages where order_id=? and stage_id=?
    `).get(stage.orderId, stage.stageId) as
      | { status: XuanxueAiStageStatus }
      | undefined;
    if (!current) throw new Error("XUANXUE_AI_PRODUCTION_STAGE_NOT_FOUND");
    const update = this.database.transaction(() => {
      this.database.prepare(`
        update production_stages
        set status=?,stage_json=?,updated_at=?
        where order_id=? and stage_id=?
      `).run(
        stage.status,
        JSON.stringify(stage),
        stage.updatedAt,
        stage.orderId,
        stage.stageId,
      );
      this.appendEvent(
        stage.orderId,
        stage.stageId,
        eventType,
        current.status,
        stage.status,
        {
          attemptCount: stage.attemptCount,
          executionId: stage.executionId,
          rawOutputHash: stage.rawOutputHash,
          failureReason: stage.failureReason,
        },
        stage.updatedAt,
      );
    });
    update();
    return stage;
  }

  updateOrder(input: {
    orderId: string;
    status: XuanxueAiOrderStatus;
    result?: XuanxueAiProductionResult | null;
    failureReason?: string | null;
    updatedAt: string;
    eventType: string;
  }): XuanxueAiOrderRecord {
    const current = this.readOrder(input.orderId);
    if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
    const update = this.database.transaction(() => {
      this.database.prepare(`
        update production_orders
        set status=?,result_json=?,failure_reason=?,updated_at=?
        where order_id=?
      `).run(
        input.status,
        input.result === undefined
          ? current.result ? JSON.stringify(current.result) : null
          : input.result ? JSON.stringify(input.result) : null,
        input.failureReason === undefined
          ? current.failureReason
          : input.failureReason,
        input.updatedAt,
        input.orderId,
      );
      this.appendEvent(
        input.orderId,
        null,
        input.eventType,
        current.status,
        input.status,
        { failureReason: input.failureReason ?? null },
        input.updatedAt,
      );
    });
    update();
    return this.readOrder(input.orderId)!;
  }

  private appendEvent(
    orderId: string,
    stageId: string | null,
    eventType: string,
    fromStatus: string | null,
    toStatus: string,
    detail: Readonly<Record<string, unknown>>,
    createdAt: string,
  ): void {
    this.database.prepare(`
      insert into production_events(
        order_id,stage_id,event_type,from_status,to_status,detail_json,created_at
      ) values(?,?,?,?,?,?,?)
    `).run(
      orderId,
      stageId,
      eventType,
      fromStatus,
      toStatus,
      JSON.stringify(detail),
      createdAt,
    );
  }
}
