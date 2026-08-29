import path from "node:path";
import Database from "better-sqlite3";

import type { GptContinuationStorePort } from "../../../capabilities/gpt/index.js";
import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";

export type ProductionTaskStatus = "accepted" | "running" | "recovery_pending" | "completed";
export type LegacyProductionTaskStatus = ProductionTaskStatus | "failed" | "review_required" | "cancelled";

export interface StoredProductionTask {
  readonly task: WebsiteAgentTask;
  readonly identity: DurablePluginIdentity;
  readonly status: ProductionTaskStatus;
  readonly result: WebsiteAgentResult | null;
  readonly staged_result: WebsiteAgentResult | null;
  readonly failure: SerializedExecutionFailure | null;
  readonly failure_reason: string | null;
  readonly updated_at: string;
}

export type TaskRow = {
  task_json: string;
  identity_json: string;
  status: LegacyProductionTaskStatus;
  result_json: string | null;
  staged_result_json: string | null;
  failure_json: string | null;
  failure_reason: string | null;
  updated_at: string;
};

export type StepRow = { input_hash: ProductionHash; result_json: string };

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
  state: "pending" | "delivered" | "failed" | "parked";
  deliveryBuildHash: ProductionHash | null;
  deliveryAttemptCount: number;
  nextDeliveryAttemptAt: string | null;
  parkedAt: string | null;
  failureCode: string | null;
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
  const keys = ["cause", "code", "evidence_hash", "evidence_ref", "mutation_outcome"];
  const validRef = row.evidence_ref === null || (typeof row.evidence_ref === "string" && row.evidence_ref.length > 0);
  const validHash = row.evidence_hash === null || (
    typeof row.evidence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(row.evidence_hash)
  );
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(keys)
    && typeof row.code === "string" && row.code.length > 0
    && ["no", "dispatched", "confirmed"].includes(String(row.mutation_outcome))
    && validRef && validHash && validSerializedCause(row.cause);
};

export const projectedTaskStatus = (status: LegacyProductionTaskStatus): ProductionTaskStatus =>
  status === "failed" || status === "review_required" || status === "cancelled" ? "recovery_pending" : status;

export const projectedFailure = (
  value: string | null,
  status: LegacyProductionTaskStatus,
): SerializedExecutionFailure | null => {
  if (!value) return status === "cancelled" ? Object.freeze({
    code: "USER_CANCELLED", mutation_outcome: "no", evidence_ref: null, evidence_hash: null, cause: null,
  }) : null;
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const { status: _legacyStatus, ...failure } = parsed;
  return failure as SerializedExecutionFailure;
};

export const storedTaskFromRow = (row: TaskRow): StoredProductionTask => ({
  task: JSON.parse(row.task_json) as WebsiteAgentTask,
  identity: JSON.parse(row.identity_json) as DurablePluginIdentity,
  status: projectedTaskStatus(row.status),
  result: row.result_json ? JSON.parse(row.result_json) as WebsiteAgentResult : null,
  staged_result: row.staged_result_json ? JSON.parse(row.staged_result_json) as WebsiteAgentResult : null,
  failure: projectedFailure(row.failure_json, row.status),
  failure_reason: row.failure_reason,
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
  database.exec(`create table if not exists production_tasks(
    job_id text primary key, request_hash text not null, task_json text not null,
    identity_json text not null, status text not null, result_json text,
    staged_result_json text, failure_json text, failure_reason text,
    created_at text not null, updated_at text not null
  );
  create table if not exists production_steps(
    job_id text not null references production_tasks(job_id) on delete restrict,
    step_id text not null, input_hash text not null, result_json text not null,
    completed_at text not null, primary key(job_id,step_id)
  );
  create table if not exists production_continuations(
    continuation_ref text primary key,
    origin_job_id text not null references production_tasks(job_id) on delete restrict,
    plugin_id text not null, owner_ref text not null, subject_ref text not null,
    authorization_ref text not null, conversation_identity_hash text not null,
    provider_json text not null, lane_version integer not null,
    lane_owner_job_id text, created_at text not null
  );
  create table if not exists production_outbox(
    idempotency_key text primary key, kind text not null, path text not null,
    method text not null, headers_json text not null, body_blob blob not null,
    created_at text not null, sent_at text, failure_code text,
    response_json text, response_hash text, receipt_hash text,
    delivery_build_hash text, delivery_attempt_count integer not null default 0,
    next_delivery_attempt_at text, delivery_parked_at text
  );
  create table if not exists production_checkpoints(
    job_id text primary key references production_tasks(job_id) on delete restrict,
    attempt_id text not null, checkpoint_id text, checkpoint_hash text,
    state text not null check(state in ('none','persisted','failed')), updated_at text not null
  );
  create table if not exists production_leases(
    job_id text primary key references production_tasks(job_id) on delete restrict,
    attempt_id text not null, lease_version integer not null, fence_hash text not null,
    state text not null check(state in ('absent','active','stale','lost')),
    expires_at text, updated_at text not null
  );`);
};

const tableColumns = (database: Database.Database, table: string): ReadonlySet<string> => new Set(
  (database.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name),
);

const ensureContinuationSchema = (database: Database.Database): void => {
  const columns = tableColumns(database, "production_continuations");
  const required = ["continuation_ref", "origin_job_id", "plugin_id", "owner_ref", "subject_ref",
    "authorization_ref", "conversation_identity_hash", "provider_json", "lane_version", "lane_owner_job_id", "created_at"];
  if (required.every((column) => columns.has(column))) return;
  const count = Number((database.prepare("select count(*) as count from production_continuations").get() as { count: number }).count);
  if (count !== 0) throw executionFailure(
    "review_required", "PRODUCTION_CONTINUATION_SCHEMA_MIGRATION_REQUIRES_REVIEW",
  );
  database.exec(`drop table production_continuations;
    create table production_continuations(
      continuation_ref text primary key,
      origin_job_id text not null references production_tasks(job_id) on delete restrict,
      plugin_id text not null, owner_ref text not null, subject_ref text not null,
      authorization_ref text not null, conversation_identity_hash text not null,
      provider_json text not null, lane_version integer not null,
      lane_owner_job_id text, created_at text not null
    );`);
};

const ensureOutboxSchema = (database: Database.Database): void => {
  const columns = tableColumns(database, "production_outbox");
  if (!columns.has("failure_code")) database.exec("alter table production_outbox add column failure_code text");
  if (!columns.has("response_json")) database.exec("alter table production_outbox add column response_json text");
  if (!columns.has("response_hash")) database.exec("alter table production_outbox add column response_hash text");
  if (!columns.has("receipt_hash")) database.exec("alter table production_outbox add column receipt_hash text");
  if (!columns.has("delivery_build_hash")) database.exec(
    "alter table production_outbox add column delivery_build_hash text",
  );
  if (!columns.has("delivery_attempt_count")) database.exec(
    "alter table production_outbox add column delivery_attempt_count integer not null default 0",
  );
  if (!columns.has("next_delivery_attempt_at")) database.exec(
    "alter table production_outbox add column next_delivery_attempt_at text",
  );
  if (!columns.has("delivery_parked_at")) database.exec(
    "alter table production_outbox add column delivery_parked_at text",
  );
};

const ensureTaskSchema = (database: Database.Database): void => {
  const columns = tableColumns(database, "production_tasks");
  if (!columns.has("staged_result_json")) database.exec("alter table production_tasks add column staged_result_json text");
  if (!columns.has("failure_json")) database.exec("alter table production_tasks add column failure_json text");
};

const migrateFailedTaskTerminalsToRecovery = (database: Database.Database): void => {
  const timestamp = now();
  database.transaction(() => {
    database.prepare(`update production_tasks
      set status='recovery_pending',result_json=null,
          failure_reason=coalesce(failure_reason,json_extract(failure_json,'$.code'),'HISTORICAL_FAILED_TASK_RECOVERY'),
          updated_at=?
      where status in ('failed','review_required','cancelled')`).run(timestamp);
    database.prepare(`update production_outbox
      set failure_code='HISTORICAL_FAILED_COMPLETION_RETIRED',sent_at=coalesce(sent_at,?),
          response_json=null,response_hash=null,receipt_hash=null
      where kind='terminal'
        and json_extract(cast(body_blob as text),'$.terminal_status') in ('failed','review_required','cancelled')`
    ).run(timestamp);
  })();
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
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    createProductionTables(this.database);
    ensureContinuationSchema(this.database);
    ensureTaskSchema(this.database);
    ensureOutboxSchema(this.database);
    migrateFailedTaskTerminalsToRecovery(this.database);
  }

  public setOutboxObserver(observer: ProductionOutboxObserver): void { this.outboxObserver = observer; }
  protected notifyOutbox(authority: ProductionOutboxAuthority | null): void {
    if (authority) this.outboxObserver?.(authority);
  }
  public close(): void { this.database.close(); }

  public abstract createGptContinuation(continuation: Parameters<GptContinuationStorePort["createGptContinuation"]>[0]): void;
  public abstract readGptContinuation(ref: string): ReturnType<GptContinuationStorePort["readGptContinuation"]>;
  public abstract acquireGptContinuationLane(ref: string, jobId: string): ReturnType<GptContinuationStorePort["acquireGptContinuationLane"]>;
  public abstract advanceGptContinuationLane(input: Parameters<GptContinuationStorePort["advanceGptContinuationLane"]>[0]): void;
  public abstract releaseGptContinuationLane(ref: string, jobId: string, version: number): void;
}
