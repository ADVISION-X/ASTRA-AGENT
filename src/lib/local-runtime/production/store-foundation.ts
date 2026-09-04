import path from "node:path";
import Database from "better-sqlite3";

import type { GptContinuationStorePort } from "../../../capabilities/gpt/index.js";
import { executionFailure, typedExecutionFailure } from "../../execution-failure.js";
import type { SerializedExecutionFailure } from "./terminal-failure.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";

export type ProductionTaskStatus = "failed" | "completed";

export interface StoredProductionTask {
  readonly task: WebsiteAgentTask;
  readonly identity: DurablePluginIdentity;
  readonly status: ProductionTaskStatus;
  readonly result: WebsiteAgentResult | null;
  readonly staged_result: WebsiteAgentResult | null;
  readonly attempt_failure: SerializedExecutionFailure | null;
  readonly current_attempt_id: string;
  readonly current_reason: string | null;
  readonly updated_at: string;
}

export type TaskRow = {
  job_id: string;
  request_hash: string;
  task_json: string;
  identity_json: string;
  status: ProductionTaskStatus;
  result_json: string | null;
  staged_result_json: string | null;
  attempt_failure_json: string | null;
  current_attempt_id: string;
  current_reason: string | null;
  updated_at: string;
};

export interface ProductionOutboxWrite {
  readonly idempotency_key: string;
  readonly kind: "checkpoint" | "artifact" | "terminal";
  readonly path: string;
  readonly method: "POST" | "PUT";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
}

export type ProductionCheckpointAuthority = Readonly<{
  jobId: string;
  attemptId: string;
  checkpointId: string | null;
  checkpointHash: ProductionHash | null;
  state: "none" | "persisted" | "failed";
}>;

export type ProductionLeaseAuthority = Readonly<{
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  fenceHash: ProductionHash;
  state: "absent" | "active" | "stale" | "lost";
  expiresAt: string | null;
}>;

export type ProductionOutboxAuthority = Readonly<{
  idempotencyKey: string;
  jobId: string;
  kind: ProductionOutboxWrite["kind"];
  state: "pending" | "delivered";
  nextDeliveryAt: string | null;
  lastError: string | null;
  responseHash: ProductionHash | null;
  receiptHash: ProductionHash | null;
}>;

export type ProductionAuthorityReader = Readonly<{
  readTask: (jobId: string) => StoredProductionTask | null;
  readCheckpoint: (jobId: string) => ProductionCheckpointAuthority | null;
  readLease: (jobId: string) => ProductionLeaseAuthority | null;
  readOutboxAuthority: (idempotencyKey: string) => ProductionOutboxAuthority | null;
}>;

export type ProductionOutboxAuthorityRow = Readonly<{
  idempotency_key: string; kind: string; path: string; method: string; headers_json: string; body_blob: Buffer;
  created_at: string; sent_at: string | null; last_error: string | null; response_json: string | null;
  response_hash: string | null; receipt_hash: string | null; next_delivery_at: string | null;
}>;

export const now = (): string => new Date().toISOString();
export const json = (value: unknown): string => JSON.stringify(value);

const validSerializedCause = (cause: unknown): boolean => cause === null || (
  Boolean(cause) && typeof cause === "object" && !Array.isArray(cause)
  && JSON.stringify(Object.keys(cause as Record<string, unknown>).sort()) === JSON.stringify(["code", "name"])
  && typeof (cause as Record<string, unknown>).name === "string"
  && ((cause as Record<string, unknown>).code === null || typeof (cause as Record<string, unknown>).code === "string")
);

const serializedFailureKeys = ["browser_outcome", "cause", "child_capability_id", "code", "effect_scope",
  "evidence_hash", "evidence_ref", "mutation_outcome"];
const serializedEvidenceValid = (row: Record<string, unknown>): boolean => {
  const refValid = row.evidence_ref === null
    || (typeof row.evidence_ref === "string" && row.evidence_ref.length > 0);
  const hashValid = row.evidence_hash === null
    || (typeof row.evidence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(row.evidence_hash));
  return refValid && hashValid;
};
const browserFailureFactsAbsent = (row: Record<string, unknown>): boolean =>
  row.effect_scope === null && row.child_capability_id === null && row.browser_outcome === null;
const browserFailureFactsValid = (row: Record<string, unknown>): boolean => {
  const outcome = String(row.browser_outcome);
  const outcomeMatchesMutation = outcome === "DISPATCHED" && row.mutation_outcome === "dispatched"
    || outcome === "CONFIRMED" && ["no", "confirmed"].includes(String(row.mutation_outcome))
    || outcome === "REJECTED" && ["no", "confirmed", "dispatched"].includes(String(row.mutation_outcome));
  const completeEvidence = typeof row.evidence_ref === "string" && row.evidence_ref.length > 0
    && typeof row.evidence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(row.evidence_hash);
  return ["target_local", "provider_effect"].includes(String(row.effect_scope))
    && typeof row.child_capability_id === "string" && row.child_capability_id.length > 0
    && ["DISPATCHED", "CONFIRMED", "REJECTED"].includes(outcome)
    && outcomeMatchesMutation && completeEvidence;
};

export const isSerializedTerminalFailure = (value: unknown): value is SerializedExecutionFailure => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(serializedFailureKeys)
    && typeof row.code === "string" && row.code.length > 0
    && ["no", "dispatched", "confirmed"].includes(String(row.mutation_outcome))
    && (browserFailureFactsAbsent(row) || browserFailureFactsValid(row))
    && serializedEvidenceValid(row) && validSerializedCause(row.cause);
};

export const storedTaskFromRow = (row: TaskRow): StoredProductionTask => ({
  task: JSON.parse(row.task_json) as WebsiteAgentTask,
  identity: JSON.parse(row.identity_json) as DurablePluginIdentity,
  status: row.status,
  result: row.result_json ? JSON.parse(row.result_json) as WebsiteAgentResult : null,
  staged_result: row.staged_result_json ? JSON.parse(row.staged_result_json) as WebsiteAgentResult : null,
  attempt_failure: row.attempt_failure_json
    ? JSON.parse(row.attempt_failure_json) as SerializedExecutionFailure : null,
  current_attempt_id: row.current_attempt_id,
  current_reason: row.current_reason,
  updated_at: row.updated_at,
});

export const resolveProductionAuthority = (
  reader: ProductionAuthorityReader,
  authorityRef: string,
  authorityHash: ProductionHash,
): "verified" | "missing" | "mismatch" => {
  const verify = (value: unknown): "verified" | "mismatch" =>
    hashCanonical(value) === authorityHash ? "verified" : "mismatch";
  if (authorityRef.startsWith("production-outbox:")) {
    const authority = reader.readOutboxAuthority(authorityRef.slice("production-outbox:".length));
    return authority ? verify(authority) : "missing";
  }
  const prefixes = ["production-task:", "production-checkpoint:", "production-lease:"] as const;
  const prefix = prefixes.find((candidate) => authorityRef.startsWith(candidate));
  if (!prefix) return "missing";
  const jobId = authorityRef.slice(prefix.length);
  if (!jobId) return "missing";
  if (prefix === "production-checkpoint:") {
    const authority = reader.readCheckpoint(jobId);
    return authority ? verify(authority) : "missing";
  }
  if (prefix === "production-lease:") {
    const authority = reader.readLease(jobId);
    return authority ? verify(authority) : "missing";
  }
  const record = reader.readTask(jobId);
  return record ? verify(record) : "missing";
};

const productionSchemaSql = `create table production_tasks(
    job_id text primary key, request_hash text not null, task_json text not null,
    identity_json text not null, status text not null check(status in ('failed','completed')),
    result_json text, staged_result_json text, current_attempt_id text not null, current_reason text,
    created_at text not null, updated_at text not null,
    check((status='failed' and result_json is null and current_reason is not null)
      or (status='completed' and result_json is not null and staged_result_json is null and current_reason is null))
  );
  create table production_attempt_failures(
    job_id text not null references production_tasks(job_id) on delete restrict,
    attempt_id text not null, failure_json text not null, created_at text not null,
    primary key(job_id,attempt_id)
  );
  create table production_continuations(
    continuation_ref text primary key,
    reservation_kind text not null check(reservation_kind in ('persisted','reusable_origin','derived_continuation')),
    reservation_identity_hash text not null unique,
    origin_job_id text not null references production_tasks(job_id) on delete restrict,
    origin_plugin_version integer not null,
    plugin_id text not null, owner_ref text not null, subject_ref text not null,
    authorization_ref text not null, conversation_identity_hash text,
    frontier_ref text unique, source_checkpoint_hash text,
    reservation_fence_hash text, reservation_effect_hash text, origin_provenance_hash text,
    semantic_contract_hash text,
    artifact_ref text, artifact_hash text,
    semantic_admission_receipt_ref text, semantic_admission_receipt_hash text,
    semantic_admission_receipt_json text,
    opaque_read_grant_hash text, completion_receipt_hash text,
    origin_provider_json text, origin_checkpoint_json text,
    provider_json text, current_checkpoint_json text, lane_version integer not null,
    lane_owner_job_id text, created_at text not null
  );
  create table production_outbox(
    idempotency_key text primary key, kind text not null, path text not null,
    method text not null, headers_json text not null, body_blob blob not null,
    created_at text not null, sent_at text, last_error text,
    response_json text, response_hash text, receipt_hash text,
    next_delivery_at text
  );
  create table production_checkpoints(
    job_id text primary key references production_tasks(job_id) on delete restrict,
    attempt_id text not null, checkpoint_id text, checkpoint_hash text,
    state text not null check(state in ('none','persisted','failed')), updated_at text not null
  );
  create table production_leases(
    job_id text primary key references production_tasks(job_id) on delete restrict,
    attempt_id text not null, lease_version integer not null, fence_hash text not null,
    state text not null check(state in ('absent','active','stale','lost')),
    expires_at text, updated_at text not null
  );`;

const createProductionTables = (database: Database.Database): void => { database.exec(productionSchemaSql); };

const canonicalSql = (value: string): string => value.toLowerCase().replace(/\s+/gu, " ")
  .replace(/\s*([(),=])\s*/gu, "$1").replace(/;+$/u, "").trim();
const expectedTableSql = new Map(productionSchemaSql.split(/;\s*(?=create table)/gu).map((statement) => {
  const name = /^create table (production_[a-z_]+)/u.exec(statement.trim())?.[1];
  if (!name) throw new Error("PRODUCTION_SCHEMA_SOURCE_INVALID");
  return [name, canonicalSql(statement)] as const;
}));

const executionTables = [
  "production_steps", "production_attempt_failures", "production_continuations", "production_outbox",
  "production_checkpoints", "production_leases", "production_tasks",
] as const;

const tableShapes = {
  production_tasks: ["job_id:TEXT:0:1", "request_hash:TEXT:1:0", "task_json:TEXT:1:0",
    "identity_json:TEXT:1:0", "status:TEXT:1:0", "result_json:TEXT:0:0", "staged_result_json:TEXT:0:0",
    "current_attempt_id:TEXT:1:0", "current_reason:TEXT:0:0", "created_at:TEXT:1:0", "updated_at:TEXT:1:0"],
  production_attempt_failures: ["job_id:TEXT:1:1", "attempt_id:TEXT:1:2", "failure_json:TEXT:1:0",
    "created_at:TEXT:1:0"],
  production_continuations: ["continuation_ref:TEXT:0:1", "reservation_kind:TEXT:1:0",
    "reservation_identity_hash:TEXT:1:0", "origin_job_id:TEXT:1:0", "origin_plugin_version:INTEGER:1:0",
    "plugin_id:TEXT:1:0", "owner_ref:TEXT:1:0", "subject_ref:TEXT:1:0", "authorization_ref:TEXT:1:0",
    "conversation_identity_hash:TEXT:0:0", "frontier_ref:TEXT:0:0", "source_checkpoint_hash:TEXT:0:0",
    "reservation_fence_hash:TEXT:0:0", "reservation_effect_hash:TEXT:0:0", "origin_provenance_hash:TEXT:0:0",
    "semantic_contract_hash:TEXT:0:0", "artifact_ref:TEXT:0:0", "artifact_hash:TEXT:0:0",
    "semantic_admission_receipt_ref:TEXT:0:0", "semantic_admission_receipt_hash:TEXT:0:0",
    "semantic_admission_receipt_json:TEXT:0:0", "opaque_read_grant_hash:TEXT:0:0",
    "completion_receipt_hash:TEXT:0:0", "origin_provider_json:TEXT:0:0", "origin_checkpoint_json:TEXT:0:0",
    "provider_json:TEXT:0:0", "current_checkpoint_json:TEXT:0:0", "lane_version:INTEGER:1:0",
    "lane_owner_job_id:TEXT:0:0", "created_at:TEXT:1:0"],
  production_outbox: ["idempotency_key:TEXT:0:1", "kind:TEXT:1:0", "path:TEXT:1:0", "method:TEXT:1:0",
    "headers_json:TEXT:1:0", "body_blob:BLOB:1:0", "created_at:TEXT:1:0", "sent_at:TEXT:0:0",
    "last_error:TEXT:0:0", "response_json:TEXT:0:0", "response_hash:TEXT:0:0", "receipt_hash:TEXT:0:0",
    "next_delivery_at:TEXT:0:0"],
  production_checkpoints: ["job_id:TEXT:0:1", "attempt_id:TEXT:1:0", "checkpoint_id:TEXT:0:0",
    "checkpoint_hash:TEXT:0:0", "state:TEXT:1:0", "updated_at:TEXT:1:0"],
  production_leases: ["job_id:TEXT:0:1", "attempt_id:TEXT:1:0", "lease_version:INTEGER:1:0",
    "fence_hash:TEXT:1:0", "state:TEXT:1:0", "expires_at:TEXT:0:0", "updated_at:TEXT:1:0"],
} as const;

const expectedIndexes: Readonly<Record<keyof typeof tableShapes, readonly string[]>> = {
  production_tasks: ["1:pk:0:job_id"],
  production_attempt_failures: ["1:pk:0:job_id,attempt_id"],
  production_continuations: ["1:pk:0:continuation_ref", "1:u:0:frontier_ref", "1:u:0:reservation_identity_hash"],
  production_outbox: ["1:pk:0:idempotency_key"],
  production_checkpoints: ["1:pk:0:job_id"],
  production_leases: ["1:pk:0:job_id"],
};

const expectedForeignKeys: Readonly<Record<keyof typeof tableShapes, readonly string[]>> = {
  production_tasks: [], production_outbox: [],
  production_attempt_failures: ["production_tasks:job_id:job_id:NO ACTION:RESTRICT:NONE"],
  production_continuations: ["production_tasks:origin_job_id:job_id:NO ACTION:RESTRICT:NONE"],
  production_checkpoints: ["production_tasks:job_id:job_id:NO ACTION:RESTRICT:NONE"],
  production_leases: ["production_tasks:job_id:job_id:NO ACTION:RESTRICT:NONE"],
};

const exactTableShape = (database: Database.Database, table: keyof typeof tableShapes): boolean => {
  const declared = database.prepare("select sql from sqlite_master where type='table' and name=?")
    .get(table) as { sql: string } | undefined;
  if (!declared || canonicalSql(declared.sql) !== expectedTableSql.get(table)) return false;
  const columns = (database.prepare(`pragma table_info(${table})`).all() as Array<{
    name: string; type: string; notnull: number; pk: number; dflt_value: unknown;
  }>);
  if (columns.some((column) => column.dflt_value !== null)) return false;
  const columnShape = columns.map((column) => `${column.name}:${column.type}:${column.notnull}:${column.pk}`);
  if (JSON.stringify(columnShape) !== JSON.stringify(tableShapes[table])) return false;
  const indexes = (database.prepare(`pragma index_list(${table})`).all() as Array<{
    name: string; unique: number; origin: string; partial: number;
  }>).map((index) => {
    const name = index.name.replaceAll('"', '""');
    const names = (database.prepare(`pragma index_info("${name}")`).all() as Array<{ name: string }> )
      .map((column) => column.name).join(",");
    return `${index.unique}:${index.origin}:${index.partial}:${names}`;
  }).sort();
  const foreignKeys = (database.prepare(`pragma foreign_key_list(${table})`).all() as Array<{
    table: string; from: string; to: string; on_update: string; on_delete: string; match: string;
  }>).map((foreign) => `${foreign.table}:${foreign.from}:${foreign.to}:${foreign.on_update}:`
    + `${foreign.on_delete}:${foreign.match}`).sort();
  return JSON.stringify(indexes) === JSON.stringify(expectedIndexes[table])
    && JSON.stringify(foreignKeys) === JSON.stringify(expectedForeignKeys[table]);
};

const currentSchemaPresent = (database: Database.Database): boolean =>
  (Object.keys(tableShapes) as Array<keyof typeof tableShapes>).every((table) => exactTableShape(database, table))
  && String(database.pragma("integrity_check", { simple: true })).toLowerCase() === "ok"
  && (database.pragma("foreign_key_check") as unknown[]).length === 0;

const invalidJsonCount = (database: Database.Database): number => Number((database.prepare(`select
  (select count(*) from production_tasks where not json_valid(task_json) or not json_valid(identity_json)
    or (result_json is not null and not json_valid(result_json))
    or (staged_result_json is not null and not json_valid(staged_result_json)))
  +(select count(*) from production_attempt_failures where not json_valid(failure_json))
  +(select count(*) from production_continuations where
    (origin_provider_json is not null and not json_valid(origin_provider_json))
    or (origin_checkpoint_json is not null and not json_valid(origin_checkpoint_json))
    or (provider_json is not null and not json_valid(provider_json))
    or (current_checkpoint_json is not null and not json_valid(current_checkpoint_json))
    or (semantic_admission_receipt_json is not null and not json_valid(semantic_admission_receipt_json)))
  +(select count(*) from production_outbox where not json_valid(headers_json)
    or (kind!='artifact' and not json_valid(cast(body_blob as text)))
    or (response_json is not null and not json_valid(response_json))) as count`).get() as { count: number }).count);

export const stateInvariantFailureCount = (database: Database.Database): number => {
  const row = database.prepare(`select
    (select count(*) from production_tasks where job_id!=json_extract(task_json,'$.job_id')
      or request_hash!=json_extract(task_json,'$.request_hash')
      or request_hash!=json_extract(identity_json,'$.request_hash') or current_attempt_id='')
    +(select count(*) from production_outbox where (response_json is null)!=(response_hash is null)
      or (response_hash is not null and sent_at is null))
    +(select count(*) from production_checkpoints c where c.attempt_id=''
      or not exists(select 1 from production_tasks t
        where t.job_id=c.job_id and t.current_attempt_id=c.attempt_id)
      or (state='none' and (checkpoint_id is not null or checkpoint_hash is not null))
      or (state='persisted' and (checkpoint_id is null or checkpoint_id='' or checkpoint_hash is null
        or length(checkpoint_hash)!=71 or substr(checkpoint_hash,1,7)!='sha256:'
        or substr(checkpoint_hash,8) glob '*[^0-9a-f]*'))
      or (state='failed' and (checkpoint_id is null or checkpoint_id='' or checkpoint_hash is not null)))
    +(select count(*) from production_leases l where typeof(l.lease_version)!='integer' or l.lease_version<1
      or l.attempt_id='' or length(l.fence_hash)!=71 or substr(l.fence_hash,1,7)!='sha256:'
      or substr(l.fence_hash,8) glob '*[^0-9a-f]*'
      or not exists(select 1 from production_tasks t
        where t.job_id=l.job_id and t.current_attempt_id=l.attempt_id)
      or (l.state='active' and l.expires_at is null)
      or (l.state!='active' and l.expires_at is not null)) as count`).get() as { count: number };
  return Number(row.count);
};

const initializeOrAssertCurrentSchema = (database: Database.Database): void => {
  const productionTables = (database.prepare(`select name from sqlite_master
    where type='table' and name like 'production_%' order by name`).all() as Array<{ name: string }>)
    .map((row) => row.name);
  if (productionTables.length === 0) {
    const journalMode = String(database.pragma("journal_mode = WAL", { simple: true })).toLowerCase();
    if (journalMode !== "wal") throw executionFailure("failed", "PRODUCTION_SCHEMA_INITIALIZATION_FAILED");
    createProductionTables(database);
    if (!currentSchemaPresent(database)) {
      throw executionFailure("failed", "PRODUCTION_SCHEMA_INITIALIZATION_FAILED");
    }
    return;
  }
  const expectedTables = executionTables.filter((table) => table !== "production_steps").sort();
  if (String(database.pragma("journal_mode", { simple: true })).toLowerCase() !== "wal"
    || !currentSchemaPresent(database)
    || JSON.stringify(productionTables) !== JSON.stringify(expectedTables)) {
    throw executionFailure("failed", "PRODUCTION_SCHEMA_MIGRATION_REQUIRED");
  }
  const unscheduled = database.prepare(`select count(*) as count from production_outbox
    where sent_at is null and response_hash is null and last_error is not null
      and next_delivery_at is null and last_error<>'PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED'`
  ).get() as { count: number };
  if (Number(unscheduled.count) !== 0) {
    throw executionFailure("failed", "PRODUCTION_DATA_MIGRATION_REQUIRED");
  }
  if (invalidJsonCount(database) !== 0 || stateInvariantFailureCount(database) !== 0) {
    throw executionFailure("failed", "PRODUCTION_DATA_CORRUPT");
  }
};

type ProductionOutboxObserver = (authority: ProductionOutboxAuthority) => void;

export abstract class ProductionStoreFoundation implements GptContinuationStorePort {
  protected readonly database: Database.Database;
  protected readonly dataDir: string;
  protected outboxDeliveryTail = Promise.resolve();
  private outboxObserver: ProductionOutboxObserver | null = null;

  public constructor(dataDir: string) {
    this.dataDir = dataDir;
    let database: Database.Database | null = null;
    try {
      database = new Database(path.join(dataDir, "production-runtime.sqlite"));
      database.pragma("synchronous = FULL");
      database.pragma("foreign_keys = ON");
      initializeOrAssertCurrentSchema(database);
    } catch (error) {
      database?.close();
      if (typedExecutionFailure(error)) throw error;
      const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code : "";
      throw executionFailure("failed", ["SQLITE_CORRUPT", "SQLITE_NOTADB", "SQLITE_SCHEMA"].includes(code)
        ? "PRODUCTION_SCHEMA_CORRUPT" : "PRODUCTION_SCHEMA_UNREADABLE", { cause: error });
    }
    this.database = database;
  }

  public setOutboxObserver(observer: ProductionOutboxObserver): void { this.outboxObserver = observer; }
  protected notifyOutbox(authority: ProductionOutboxAuthority | null): void {
    if (authority) this.outboxObserver?.(authority);
  }
  public close(): void { this.database.close(); }

  public abstract createGptContinuation(continuation: Parameters<GptContinuationStorePort["createGptContinuation"]>[0]): void;
  public abstract readGptContinuationExecutionBinding(
    jobId: string,
  ): ReturnType<GptContinuationStorePort["readGptContinuationExecutionBinding"]>;
  public abstract reserveExactGptContinuation(
    reservation: Parameters<GptContinuationStorePort["reserveExactGptContinuation"]>[0],
  ): ReturnType<GptContinuationStorePort["reserveExactGptContinuation"]>;
  public abstract completeExactGptContinuationReservation(
    input: Parameters<GptContinuationStorePort["completeExactGptContinuationReservation"]>[0],
  ): ReturnType<GptContinuationStorePort["completeExactGptContinuationReservation"]>;
  public abstract readGptContinuation(ref: string): ReturnType<GptContinuationStorePort["readGptContinuation"]>;
  public abstract readGptContinuationForFrontier(
    frontierRef: Parameters<GptContinuationStorePort["readGptContinuationForFrontier"]>[0],
  ): ReturnType<GptContinuationStorePort["readGptContinuationForFrontier"]>;
  public abstract acquireGptContinuationLane(ref: string, jobId: string): ReturnType<GptContinuationStorePort["acquireGptContinuationLane"]>;
  public abstract advanceGptContinuationLane(input: Parameters<GptContinuationStorePort["advanceGptContinuationLane"]>[0]): void;
  public abstract releaseGptContinuationLane(ref: string, jobId: string, version: number): void;
}
