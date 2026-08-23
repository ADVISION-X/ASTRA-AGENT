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
      last_control_epoch integer not null default 0,
      last_safe_checkpoint text,
      requested_at text,
      updated_at text not null
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
    create table if not exists production_cloud_claim_ledger (
      job_id text not null,
      attempt_id text not null,
      lease_version integer not null,
      created_at text not null,
      grant_json text not null,
      grant_hash text not null,
      persisted_at text not null,
      primary key(job_id,attempt_id,lease_version)
    );
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
  `);
  const interventionColumns = database.pragma("table_info(production_interventions)") as { name: string }[];
  if (!interventionColumns.some((column) => column.name === "last_control_epoch")) {
    database.exec("alter table production_interventions add column last_control_epoch integer not null default 0");
  }
  const cloudJobStateColumns = database.pragma("table_info(production_cloud_job_state)") as { name: string }[];
  if (!cloudJobStateColumns.some((column) => column.name === "attempt_id")) {
    database.transaction(() => {
      const legacyCount = (database.prepare(
        "select count(*) as count from production_cloud_job_state",
      ).get() as { count: number }).count;
      const invalidBindings = database.prepare(`select legacy.job_id,count(claim.job_id) as candidate_count
        from production_cloud_job_state legacy
        left join production_cloud_claim_ledger claim on claim.job_id=legacy.job_id
        group by legacy.job_id having count(claim.job_id) <> 1
        order by legacy.job_id`).all() as { job_id: string; candidate_count: number }[];
      if (invalidBindings.length > 0) {
        throw new Error(`XUANXUE_AI_PRODUCTION_V5_JOB_STATE_MIGRATION_BINDING_INVALID:${JSON.stringify(invalidBindings)}`);
      }
      database.exec("alter table production_cloud_job_state rename to production_cloud_job_state_v5_retired");
      database.exec(`create table production_cloud_job_state (
        job_id text not null,
        attempt_id text not null,
        lease_version integer not null,
        checkpoint_sequence integer not null default 0,
        primary key(job_id,attempt_id,lease_version)
      )`);
      database.exec(`insert into production_cloud_job_state(job_id,attempt_id,lease_version,checkpoint_sequence)
        select legacy.job_id,claim.attempt_id,claim.lease_version,legacy.checkpoint_sequence
          from production_cloud_job_state_v5_retired legacy
          join production_cloud_claim_ledger claim on claim.job_id=legacy.job_id`);
      const migratedCount = (database.prepare(
        "select count(*) as count from production_cloud_job_state",
      ).get() as { count: number }).count;
      if (migratedCount !== legacyCount) {
        throw new Error(`XUANXUE_AI_PRODUCTION_V5_JOB_STATE_MIGRATION_DENOMINATOR_MISMATCH:${legacyCount}:${migratedCount}`);
      }
      database.exec("drop table production_cloud_job_state_v5_retired");
    })();
  }
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
