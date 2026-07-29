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

export const openXuanxueAiProductionDatabase = (
  dataDir: string,
): Database.Database => {
  const filePath = databasePath(dataDir);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
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
    create table if not exists production_parent_conversation_rebuilds (
      parent_job_id text not null,
      parent_stage_id text not null,
      original_raw_output_hash text not null,
      rebuilt_raw_output_hash text not null,
      provider_page_url text not null,
      rebuilt_at text not null,
      primary key(
        parent_job_id,parent_stage_id,original_raw_output_hash
      )
    );
  `);
  return database;
};
