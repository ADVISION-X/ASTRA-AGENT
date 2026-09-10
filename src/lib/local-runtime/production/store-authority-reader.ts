import { lstatSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure } from "../../execution-failure.js";
import type { ProductionHash } from "./contracts.js";
import {
  productionLeaseAuthorityFromRow,
  productionOutboxAuthorityFromRow,
  productionTaskRowValid,
  type ProductionLeaseAuthorityRow,
} from "./store-authority-validation.js";
import {
  resolveProductionAuthority,
  storedTaskFromRow,
  type ProductionAuthorityReader,
  type ProductionLeaseAuthority,
  type ProductionOutboxAuthority,
  type ProductionOutboxAuthorityRow,
  type TaskRow,
} from "./store-foundation.js";

const authorityCorrupt = (): never => { throw new SyntaxError("PRODUCTION_AUTHORITY_ROW_CORRUPT"); };

const readTask = (database: Database.Database, jobId: string) => {
  const row = database.prepare(`select t.job_id,t.request_hash,t.task_json,t.identity_json,t.status,t.result_json,
    t.staged_result_json,t.attempt_failure_json,t.current_attempt_id,t.current_reason,t.updated_at
    from production_tasks t where t.job_id=?`
  ).get(jobId) as TaskRow | undefined;
  if (!row) return null;
  const record = storedTaskFromRow(row);
  return productionTaskRowValid(row, record) ? record : authorityCorrupt();
};

const readLease = (database: Database.Database, jobId: string): ProductionLeaseAuthority | null => {
  const row = database.prepare(`select l.job_id,l.attempt_id,l.lease_version,l.fence_hash,l.state,l.expires_at,
    l.updated_at,t.current_attempt_id as task_attempt_id from production_leases l
    join production_tasks t on t.job_id=l.job_id where l.job_id=?`).get(jobId) as
    ProductionLeaseAuthorityRow | undefined;
  if (!row) return null;
  return productionLeaseAuthorityFromRow(row, jobId);
};

const readOutbox = (
  database: Database.Database,
  idempotencyKey: string,
): ProductionOutboxAuthority | null => {
  const row = database.prepare(`select idempotency_key,kind,path,method,headers_json,body_blob,created_at,
    sent_at,last_error,response_json,response_hash,receipt_hash
    from production_outbox where idempotency_key=?`).get(idempotencyKey) as ProductionOutboxAuthorityRow | undefined;
  if (!row) return null;
  return productionOutboxAuthorityFromRow(row, idempotencyKey);
};

const createReader = (database: Database.Database): ProductionAuthorityReader => ({
  readTask: (jobId) => readTask(database, jobId),
  readLease: (jobId) => readLease(database, jobId),
  readOutboxAuthority: (key) => readOutbox(database, key),
});

const productionAuthorityRef = (value: string): boolean => [
  "production-task:", "production-lease:", "production-outbox:",
].some((prefix) => value.startsWith(prefix));

const sqliteCorrupt = (error: unknown): boolean => {
  if (error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return ["SQLITE_CORRUPT", "SQLITE_NOTADB", "SQLITE_SCHEMA"].includes(code)
    || (code === "SQLITE_ERROR" && /(?:no such (?:table|column)|malformed)/iu.test(error.message));
};

export const resolveStoredProductionAuthority = (
  dataDir: string,
  authorityRef: string,
  authorityHash: ProductionHash,
): "verified" | "missing" | "mismatch" => {
  if (!productionAuthorityRef(authorityRef)) return "missing";
  const file = path.join(dataDir, "production-runtime.sqlite");
  try {
    const metadata = lstatSync(file);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw executionFailure("failed", "PRODUCTION_AUTHORITY_STORE_UNREADABLE");
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw executionFailure("failed", "PRODUCTION_AUTHORITY_STORE_MISSING", { cause: error });
    }
    if (error instanceof Error && error.name === "TypedExecutionFailure") throw error;
    throw executionFailure("failed", "PRODUCTION_AUTHORITY_STORE_UNREADABLE", { cause: error });
  }
  let database: Database.Database | null = null;
  try {
    database = new Database(file, { readonly: true, fileMustExist: true });
    return resolveProductionAuthority(createReader(database), authorityRef, authorityHash);
  } catch (error) {
    throw executionFailure("failed", sqliteCorrupt(error)
      ? "PRODUCTION_AUTHORITY_STORE_CORRUPT" : "PRODUCTION_AUTHORITY_STORE_UNREADABLE", { cause: error });
  }
  finally { database?.close(); }
};
