import path from "node:path";
import Database from "better-sqlite3";

import type { GptContinuationStorePort } from "../../../capabilities/gpt/index.js";
import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";
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

export const now = (): string => new Date().toISOString();
export const json = (value: unknown): string => JSON.stringify(value);

const validSerializedCause = (cause: unknown): boolean => cause === null || (
  Boolean(cause) && typeof cause === "object" && !Array.isArray(cause)
  && JSON.stringify(Object.keys(cause as Record<string, unknown>).sort()) === JSON.stringify(["code", "name"])
  && typeof (cause as Record<string, unknown>).name === "string"
  && ((cause as Record<string, unknown>).code === null || typeof (cause as Record<string, unknown>).code === "string")
);

export const isSerializedTerminalFailure = (value: unknown): value is SerializedExecutionFailure => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = ["browser_outcome", "cause", "child_capability_id", "code", "effect_scope",
    "evidence_hash", "evidence_ref", "mutation_outcome"];
  const validRef = row.evidence_ref === null || (typeof row.evidence_ref === "string" && row.evidence_ref.length > 0);
  const validHash = row.evidence_hash === null || (
    typeof row.evidence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(row.evidence_hash)
  );
  const browserFactsAbsent = row.effect_scope === null
    && row.child_capability_id === null && row.browser_outcome === null;
  const browserFactsValid = ["target_local", "provider_effect"].includes(String(row.effect_scope))
    && typeof row.child_capability_id === "string" && row.child_capability_id.length > 0
    && ["DISPATCHED", "CONFIRMED", "REJECTED"].includes(String(row.browser_outcome))
    && (row.browser_outcome === "DISPATCHED"
      ? row.mutation_outcome === "dispatched" : row.mutation_outcome === "confirmed");
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(keys)
    && typeof row.code === "string" && row.code.length > 0
    && ["no", "dispatched", "confirmed"].includes(String(row.mutation_outcome))
    && (browserFactsAbsent || browserFactsValid)
    && validRef && validHash && validSerializedCause(row.cause);
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

const createProductionTables = (database: Database.Database): void => {
  database.exec(`create table production_tasks(
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
  );`);
};

const tableColumns = (database: Database.Database, table: string): ReadonlySet<string> => new Set(
  (database.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name),
);

const executionTables = [
  "production_steps", "production_attempt_failures", "production_continuations", "production_outbox",
  "production_checkpoints", "production_leases", "production_tasks",
] as const;

const currentCoreSchemaPresent = (database: Database.Database): boolean => {
  const tasks = tableColumns(database, "production_tasks");
  const outbox = tableColumns(database, "production_outbox");
  const failures = tableColumns(database, "production_attempt_failures");
  const continuations = tableColumns(database, "production_continuations");
  const failureColumns = ["job_id", "attempt_id", "failure_json", "created_at"] as const;
  return tasks.has("current_attempt_id") && tasks.has("current_reason")
    && tableColumns(database, "production_steps").size === 0
    && !tasks.has("failure_json") && !tasks.has("failure_reason")
    && failures.size === failureColumns.length
    && failureColumns.every((column) => failures.has(column))
    && outbox.has("last_error") && outbox.has("next_delivery_at")
    && continuations.has("continuation_ref") && continuations.has("provider_json")
    && !outbox.has("delivery_build_hash") && !outbox.has("delivery_attempt_count")
    && !outbox.has("delivery_parked_at");
};

const currentSchemaPresent = (database: Database.Database): boolean => {
  const continuations = tableColumns(database, "production_continuations");
  const reservationColumns = [
    "reservation_kind", "reservation_identity_hash", "origin_plugin_version", "source_checkpoint_hash",
    "reservation_fence_hash", "reservation_effect_hash", "origin_provenance_hash", "artifact_ref",
    "artifact_hash", "semantic_admission_receipt_ref", "semantic_admission_receipt_hash",
    "semantic_contract_hash", "semantic_admission_receipt_json",
    "opaque_read_grant_hash", "completion_receipt_hash",
  ] as const;
  return currentCoreSchemaPresent(database)
    && continuations.has("frontier_ref")
    && continuations.has("origin_provider_json")
    && continuations.has("origin_checkpoint_json")
    && continuations.has("current_checkpoint_json")
    && reservationColumns.every((column) => continuations.has(column));
};

const initializeOrAssertCurrentSchema = (database: Database.Database): void => {
  const productionTables = (database.prepare(`select name from sqlite_master
    where type='table' and name like 'production_%' order by name`).all() as Array<{ name: string }>)
    .map((row) => row.name);
  if (productionTables.length === 0) {
    const journalMode = String(database.pragma("journal_mode = WAL", { simple: true })).toLowerCase();
    if (journalMode !== "wal") throw executionFailure("failed", "PRODUCTION_SCHEMA_INITIALIZATION_FAILED");
    createProductionTables(database);
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
};

type ProductionOutboxObserver = (authority: ProductionOutboxAuthority) => void;

export abstract class ProductionStoreFoundation implements GptContinuationStorePort {
  protected readonly database: Database.Database;
  protected readonly dataDir: string;
  protected outboxDeliveryTail = Promise.resolve();
  private outboxObserver: ProductionOutboxObserver | null = null;

  public constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.database = new Database(path.join(dataDir, "production-runtime.sqlite"));
    this.database.pragma("synchronous = FULL");
    this.database.pragma("foreign_keys = ON");
    try {
      initializeOrAssertCurrentSchema(this.database);
    } catch (error) {
      this.database.close();
      throw error;
    }
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
