import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

import {
  createVerifiedLegacyCutoverBackup,
} from "./xuanxue-ai-production-store-protocol-cutover-backup.js";

interface LegacyRow {
  order_id: string;
  status: string;
  order_json: string;
  result_json: string | null;
}

const terminalStatuses = new Set([
  "completed",
  "cancelled",
  "review_required",
  "failed",
]);

const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const assertRawOutputIntegrity = (
  orderId: string,
  value: unknown,
  requiresOutput: boolean,
): void => {
  if (!value || typeof value !== "object") {
    if (requiresOutput) {
      throw new Error(
        `XUANXUE_AI_PRODUCTION_V1_OUTPUT_PROOF_MISSING:${orderId}`,
      );
    }
    return;
  }
  const candidate = value as Record<string, unknown>;
  const hasRawResponse = typeof candidate.rawResponseText === "string";
  const hasRawOutputHash = typeof candidate.rawOutputHash === "string";
  if (hasRawResponse !== hasRawOutputHash || (requiresOutput && !hasRawResponse)) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_V1_OUTPUT_PROOF_MISSING:${orderId}`,
    );
  }
  if (hasRawResponse && digest(candidate.rawResponseText as string)
    !== candidate.rawOutputHash) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_V1_HASH_MISMATCH:${orderId}`,
    );
  }
};

const initializeLegacyArchiveTable = (
  database: Database.Database,
): void => {
  database.exec(`
    create table if not exists production_protocol_migrations (
      order_id text primary key references production_orders(order_id),
      from_protocol text not null,
      to_protocol text not null,
      before_sha256 text not null,
      after_sha256 text not null,
      migrated_at text not null
    );
    create table if not exists production_legacy_protocol_archives (
      order_id text primary key references production_orders(order_id),
      protocol_version text not null,
      status_at_archive text not null,
      order_json_sha256 text not null,
      result_json_sha256 text,
      stages_sha256 text not null,
      events_sha256 text not null,
      backup_ref text not null,
      backup_sha256 text not null,
      restored_snapshot_sha256 text not null,
      archived_at text not null
    )
  `);
};

const readUnarchivedLegacyRows = (
  database: Database.Database,
): LegacyRow[] => database.prepare(`
  select o.order_id,o.status,o.order_json,o.result_json
  from production_orders o
  where json_extract(o.order_json,'$.protocolVersion') in (
    'xuanxue-ai-production-v1',
    'xuanxue-ai-production-v2',
    'xuanxue-ai-production-v3'
  ) and not exists (
    select 1 from production_legacy_protocol_archives a
    where a.order_id=o.order_id
  )
  order by o.created_at,o.order_id
`).all() as LegacyRow[];

const validateLegacyRows = (
  database: Database.Database,
  rows: readonly LegacyRow[],
): void => {
  const stageRows = database.prepare(`
    select status,stage_json from production_stages
    where order_id=? order by ordinal,stage_id
  `);
  for (const row of rows) {
    for (const stage of stageRows.all(row.order_id) as Array<{
      status: string;
      stage_json: string;
    }>) {
      if (!terminalStatuses.has(stage.status)) {
        throw new Error(
          `XUANXUE_AI_PRODUCTION_LEGACY_STAGE_ACTIVE_DRAIN_REQUIRED:${row.order_id}`,
        );
      }
      assertRawOutputIntegrity(
        row.order_id,
        JSON.parse(stage.stage_json) as unknown,
        stage.status === "completed",
      );
    }
    if (!row.result_json) continue;
    const result = JSON.parse(row.result_json) as {
      stages?: unknown[];
    };
    for (const stage of result.stages ?? []) {
      assertRawOutputIntegrity(row.order_id, stage, true);
    }
  }
};

const archiveRows = (
  database: Database.Database,
  rows: readonly LegacyRow[],
  backup: {
    readonly backupRef: string;
    readonly backupSha256: string;
    readonly restoredSnapshotSha256: string;
  },
): void => {
  const stageRows = database.prepare(`
    select stage_id,ordinal,status,stage_json,updated_at
    from production_stages where order_id=? order by ordinal,stage_id
  `);
  const eventRows = database.prepare(`
    select event_id,stage_id,event_type,from_status,to_status,detail_json,
      created_at from production_events
    where order_id=? order by event_id
  `);
  const insert = database.prepare(`
    insert into production_legacy_protocol_archives(
      order_id,protocol_version,status_at_archive,order_json_sha256,
      result_json_sha256,stages_sha256,events_sha256,backup_ref,
      backup_sha256,restored_snapshot_sha256,archived_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)
  `);
  const archivedAt = new Date().toISOString();
  for (const row of rows) {
    const order = JSON.parse(row.order_json) as Record<string, unknown>;
    insert.run(
      row.order_id,
      String(order.protocolVersion ?? "unknown"),
      row.status,
      digest(row.order_json),
      row.result_json ? digest(row.result_json) : null,
      digest(JSON.stringify(stageRows.all(row.order_id))),
      digest(JSON.stringify(eventRows.all(row.order_id))),
      backup.backupRef,
      backup.backupSha256,
      backup.restoredSnapshotSha256,
      archivedAt,
    );
  }
};

/**
 * One-way cutover for historical v1/v2/v3 rows. Old JSON, result, stage and event
 * bytes remain in place as a read-only archive. Active v4 readers exclude every
 * archived order, so no invented owner, person or chart identity can enter the
 * current production graph.
 */
export const archiveTerminalXuanxueAiLegacyProtocolRows = (
  database: Database.Database,
  dataDir: string,
): void => {
  initializeLegacyArchiveTable(database);
  const rows = readUnarchivedLegacyRows(database);
  if (rows.some((row) => !terminalStatuses.has(row.status))) {
    throw new Error("XUANXUE_AI_PRODUCTION_LEGACY_ACTIVE_DRAIN_REQUIRED");
  }
  if (rows.length === 0) return;
  validateLegacyRows(database, rows);
  const backup = createVerifiedLegacyCutoverBackup(database, dataDir);
  database.transaction(() => archiveRows(database, rows, backup))();
};
