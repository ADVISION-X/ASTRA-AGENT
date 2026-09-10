import path from "node:path";

import Database from "better-sqlite3";

import { readProductionRuntimeStorageInventory, type ProductionRuntimeStorageResponsibilities } from
  "../../src/lib/local-runtime/production/runtime-storage-inventory.js";

if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["--dry-run"])) {
  throw new Error("PRODUCTION_STORAGE_MAINTENANCE_DRY_RUN_ONLY");
}

const dataDir = path.resolve(process.env.GRASSEYE_DATA_DIR ?? path.join(process.cwd(), ".grasseye-local"));
const databasePath = path.join(dataDir, "production-runtime.sqlite");
const database = new Database(databasePath, { readonly: true, fileMustExist: true });
let responsibilities: ProductionRuntimeStorageResponsibilities;
try {
  const rows = database.prepare("select job_id from production_tasks order by job_id").all() as
    Array<{ job_id: string }>;
  const count = (sql: string): number => Number((database.prepare(sql).get() as { count: number }).count);
  responsibilities = Object.freeze({
    task_ids: rows.map((row) => row.job_id),
    outbox_responsibility_count: count("select count(*) as count from production_outbox"),
    pending_outbox_count: count("select count(*) as count from production_outbox where sent_at is null"),
    active_lease_count: count("select count(*) as count from production_leases where state='active'"),
  });
} finally {
  database.close();
}

const inventory = await readProductionRuntimeStorageInventory(dataDir, responsibilities);
process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...inventory })}\n`);
