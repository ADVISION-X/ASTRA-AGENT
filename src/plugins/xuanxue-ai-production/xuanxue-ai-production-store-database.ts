import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const databasePath = (dataDir: string): string =>
  path.join(
    dataDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "xuanxue_ai_production.sqlite",
  );

const productionTableSchema = `
    create table if not exists production_orders (
      order_id text primary key,
      source_task_id text not null,
      product_id text not null,
      request_hash text not null,
      status text not null,
      order_json text not null,
      result_json text,
      failure_reason text,
      control_intent text not null default 'none' check(control_intent in ('none','pause_requested','cancel_requested','handover_requested')),
      control_epoch integer not null default 0,
      control_ack_epoch integer not null default 0,
      control_reason text,
      control_checkpoint text,
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
    create table if not exists production_cloud_outbox (
      request_id text primary key,
      job_id text not null,
      write_kind text not null check(write_kind in ('checkpoint','artifact','terminal','cancel','handover')),
      method text not null,
      pathname text not null,
      headers_json text not null,
      body_json text,
      body_file text,
      payload_hash text not null,
      state text not null check(state in ('pending','acknowledged')),
      response_json text,
      created_at text not null,
      acknowledged_at text
    );
    create index if not exists production_cloud_outbox_pending
      on production_cloud_outbox(state,created_at,request_id);
    create table if not exists production_cloud_job_state (
      job_id text not null,
      attempt_id text not null,
      lease_version integer not null,
      checkpoint_sequence integer not null default 0,
      primary key(job_id,attempt_id,lease_version)
    );
    create table if not exists production_cloud_claim_requests (
      request_id text primary key,
      payload_json text not null,
      payload_hash text not null,
      state text not null check(state in ('pending','acknowledged')),
      response_json text,
      created_at text not null,
      acknowledged_at text
    );
  `;

const initializeProductionTables = (database: Database.Database): void => {
  database.exec(productionTableSchema);
  const columns = new Set((database.prepare("pragma table_info(production_orders)").all() as readonly { name: string }[]).map((row) => row.name));
  const additions = [
    ["control_intent", "text not null default 'none'"],
    ["control_epoch", "integer not null default 0"],
    ["control_ack_epoch", "integer not null default 0"],
    ["control_reason", "text"],
    ["control_checkpoint", "text"],
  ] as const;
  for (const [name, declaration] of additions) if (!columns.has(name)) database.exec(`alter table production_orders add column ${name} ${declaration}`);
  database.exec("drop table if exists production_interventions; drop table if exists production_cloud_claim_ledger");
};

export const openXuanxueAiProductionDatabase = (
  dataDir: string,
): Database.Database => {
  const filePath = databasePath(dataDir);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.pragma("synchronous = FULL");
  database.pragma("foreign_keys = ON");
  initializeProductionTables(database);
  database.exec("drop table if exists production_parent_conversation_rebuilds");
  return database;
};
