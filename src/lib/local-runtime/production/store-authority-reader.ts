import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import type { ProductionHash } from "./contracts.js";
import {
  resolveProductionAuthority,
  storedTaskFromRow,
  type ProductionAuthorityReader,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
  type ProductionOutboxAuthority,
  type ProductionOutboxWrite,
  type TaskRow,
} from "./store-foundation.js";

const readTask = (database: Database.Database, jobId: string) => {
  const row = database.prepare(`select t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,
    t.current_attempt_id,t.current_reason,t.updated_at,(select f.failure_json
      from production_attempt_failures f where f.job_id=t.job_id and f.attempt_id=t.current_attempt_id)
      as attempt_failure_json from production_tasks t where t.job_id=?`
  ).get(jobId) as TaskRow | undefined;
  return row ? storedTaskFromRow(row) : null;
};

const readCheckpoint = (
  database: Database.Database,
  jobId: string,
): ProductionCheckpointAuthority | null => {
  const row = database.prepare(`select job_id,attempt_id,checkpoint_id,checkpoint_hash,state
    from production_checkpoints where job_id=?`).get(jobId) as Readonly<{
    job_id: string; attempt_id: string; checkpoint_id: string | null;
    checkpoint_hash: ProductionHash | null; state: ProductionCheckpointAuthority["state"];
  }> | undefined;
  return row ? {
    jobId: row.job_id, attemptId: row.attempt_id, checkpointId: row.checkpoint_id,
    checkpointHash: row.checkpoint_hash, state: row.state,
  } : null;
};

const readLease = (database: Database.Database, jobId: string): ProductionLeaseAuthority | null => {
  const row = database.prepare(`select job_id,attempt_id,lease_version,fence_hash,state,expires_at
    from production_leases where job_id=?`).get(jobId) as Readonly<{
    job_id: string; attempt_id: string; lease_version: number; fence_hash: ProductionHash;
    state: ProductionLeaseAuthority["state"]; expires_at: string | null;
  }> | undefined;
  return row ? {
    jobId: row.job_id, attemptId: row.attempt_id, leaseVersion: row.lease_version,
    fenceHash: row.fence_hash, state: row.state, expiresAt: row.expires_at,
  } : null;
};

const readOutbox = (
  database: Database.Database,
  idempotencyKey: string,
): ProductionOutboxAuthority | null => {
  const row = database.prepare(`select idempotency_key,kind,path,sent_at,last_error,response_hash,receipt_hash,
    next_delivery_at
    from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
    idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string; sent_at: string | null;
    last_error: string | null; response_hash: ProductionHash | null; receipt_hash: ProductionHash | null;
    next_delivery_at: string | null;
  }> | undefined;
  if (!row) return null;
  const match = /\/jobs\/([^/]+)\//u.exec(row.path);
  if (!match?.[1]) return null;
  return {
    idempotencyKey: row.idempotency_key, jobId: decodeURIComponent(match[1]), kind: row.kind,
    state: row.sent_at && row.response_hash ? "delivered" : "pending",
    nextDeliveryAt: row.next_delivery_at, lastError: row.last_error,
    responseHash: row.response_hash, receiptHash: row.receipt_hash,
  };
};

const createReader = (database: Database.Database): ProductionAuthorityReader => ({
  readTask: (jobId) => readTask(database, jobId),
  readCheckpoint: (jobId) => readCheckpoint(database, jobId),
  readLease: (jobId) => readLease(database, jobId),
  readOutboxAuthority: (key) => readOutbox(database, key),
});

export const resolveStoredProductionAuthority = (
  dataDir: string,
  authorityRef: string,
  authorityHash: ProductionHash,
): "verified" | "missing" | "mismatch" => {
  const file = path.join(dataDir, "production-runtime.sqlite");
  if (!existsSync(file)) return "missing";
  let database: Database.Database | null = null;
  try {
    database = new Database(file, { readonly: true, fileMustExist: true });
    return resolveProductionAuthority(createReader(database), authorityRef, authorityHash);
  } catch { return "missing"; }
  finally { database?.close(); }
};
