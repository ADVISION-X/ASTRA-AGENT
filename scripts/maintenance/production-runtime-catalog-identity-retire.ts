import path from "node:path";

import Database from "better-sqlite3";

import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { resolveStoredProductionAuthority } from
  "../../src/lib/local-runtime/production/store-authority-reader.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";

const currentKeys = [
  "checkpoint_schema_version", "plugin_id", "plugin_version", "request_hash", "skill_hash",
];
const legacyKeys = ["catalog_hash", ...currentKeys].sort();
const keys = (value: Record<string, unknown>): string[] => Object.keys(value).sort();
const same = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const tables = [
  "production_tasks", "production_attempt_failures", "production_continuations",
  "production_outbox", "production_checkpoints", "production_leases",
] as const;
const databaseSnapshot = (
  database: Database.Database,
  retireCatalogIdentity: boolean,
): Readonly<Record<string, readonly Record<string, unknown>[]>> => Object.freeze(Object.fromEntries(
  tables.map((table) => [table, (database.prepare(`select * from ${table} order by rowid`).all() as
    Record<string, unknown>[]).map((row) => {
    if (table !== "production_tasks" || !retireCatalogIdentity) return row;
    const identity = JSON.parse(String(row.identity_json)) as Record<string, unknown>;
    const { catalog_hash: _retired, ...currentIdentity } = identity;
    return { ...row, identity_json: JSON.stringify(currentIdentity) };
  })]),
));
function verifyAuthorityReadback(dataDir: string): void {
  const store = new ProductionRuntimeStore(dataDir);
  const authorities: Array<Readonly<{ ref: string; hash: `sha256:${string}` }>> = [];
  try {
    for (const task of store.taskAuthorities()) {
      authorities.push({ ref: `production-task:${task.task.job_id}`, hash: hashCanonical(task) });
      const checkpoint = store.readCheckpoint(task.task.job_id);
      if (checkpoint) authorities.push({
        ref: `production-checkpoint:${task.task.job_id}`, hash: hashCanonical(checkpoint),
      });
      const lease = store.readLease(task.task.job_id);
      if (lease) authorities.push({ ref: `production-lease:${task.task.job_id}`, hash: hashCanonical(lease) });
    }
    for (const outbox of store.outboxAuthorities()) authorities.push({
      ref: `production-outbox:${outbox.idempotencyKey}`, hash: hashCanonical(outbox),
    });
  } finally {
    store.close();
  }
  if (authorities.some(({ ref, hash }) => resolveStoredProductionAuthority(dataDir, ref, hash) !== "verified")) {
    throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_AUTHORITY_READBACK_FAILED");
  }
}

export function retireProductionTaskCatalogIdentity(dataDir: string): Readonly<{
  status: "migrated" | "already-current";
  migratedTaskCount: number;
}> {
  const database = new Database(path.join(dataDir, "production-runtime.sqlite"), { fileMustExist: true });
  let expectedSnapshot: Readonly<Record<string, readonly Record<string, unknown>[]>> | null = null;
  let result: Readonly<{ status: "migrated" | "already-current"; migratedTaskCount: number }> | null = null;
  try {
    database.pragma("foreign_keys = ON");
    database.exec("begin immediate");
    const activeLeases = Number((database.prepare(
      "select count(*) count from production_leases where state='active'",
    ).get() as { count: number }).count);
    if (activeLeases !== 0) throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_ACTIVE_LEASE_BLOCKED");
    const rows = database.prepare(
      "select job_id,request_hash,identity_json from production_tasks order by job_id",
    ).all() as Array<{ job_id: string; request_hash: string; identity_json: string }>;
    const parsed = rows.map((row) => ({ row, identity: JSON.parse(row.identity_json) as Record<string, unknown> }));
    const legacy = parsed.filter(({ identity }) => same(keys(identity), legacyKeys));
    const current = parsed.filter(({ identity }) => same(keys(identity), currentKeys));
    if (legacy.length + current.length !== rows.length || (legacy.length > 0 && current.length > 0)) {
      throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_SOURCE_AMBIGUOUS");
    }
    if (legacy.some(({ row, identity }) => identity.request_hash !== row.request_hash)) {
      throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_REQUEST_MISMATCH");
    }
    expectedSnapshot = databaseSnapshot(database, true);
    for (const { row, identity } of legacy) {
      const { catalog_hash: _retired, ...next } = identity;
      database.prepare("update production_tasks set identity_json=? where job_id=?")
        .run(JSON.stringify(next), row.job_id);
    }
    const invalid = Number((database.prepare(`select count(*) count from production_tasks
      where json_type(identity_json,'$.catalog_hash') is not null
        or request_hash!=json_extract(identity_json,'$.request_hash')`).get() as { count: number }).count);
    if (invalid !== 0 || String(database.pragma("integrity_check", { simple: true })).toLowerCase() !== "ok"
      || (database.pragma("foreign_key_check") as unknown[]).length !== 0) {
      throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_READBACK_FAILED");
    }
    database.exec("commit");
    result = Object.freeze({
      status: legacy.length > 0 ? "migrated" : "already-current",
      migratedTaskCount: legacy.length,
    });
  } catch (error) {
    if (database.inTransaction) database.exec("rollback");
    throw error;
  } finally {
    database.close();
  }
  const readback = new Database(path.join(dataDir, "production-runtime.sqlite"), {
    readonly: true, fileMustExist: true,
  });
  try {
    if (JSON.stringify(databaseSnapshot(readback, false)) !== JSON.stringify(expectedSnapshot)) {
      throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_PRESERVATION_READBACK_FAILED");
    }
  } finally {
    readback.close();
  }
  verifyAuthorityReadback(dataDir);
  return result!;
}

if (path.basename(process.argv[1] ?? "").startsWith("production-runtime-catalog-identity-retire.")) {
  if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["--retire-task-catalog-hash"])) {
    throw new Error("PRODUCTION_CATALOG_IDENTITY_RETIRE_EXPLICIT_ACTION_REQUIRED");
  }
  const dataDir = path.resolve(process.env.GRASSEYE_DATA_DIR ?? path.join(process.cwd(), ".grasseye-local"));
  process.stdout.write(`${JSON.stringify(retireProductionTaskCatalogIdentity(dataDir))}\n`);
}
