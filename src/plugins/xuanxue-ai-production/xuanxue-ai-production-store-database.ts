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

const initializeProductionTables = (database: Database.Database): void => {
  database.exec(`
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
    create table if not exists production_interventions (
      order_id text primary key references production_orders(order_id),
      revision integer not null default 0,
      state text not null,
      reason text,
      request_id text,
      pending_request text,
      last_safe_checkpoint text,
      requested_at text,
      updated_at text not null
    );
  `);
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
