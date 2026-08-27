import path from "node:path";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";

import type {
  DurablePluginIdentity,
  WebsiteAgentResult,
  WebsiteAgentTask,
} from "./contracts.js";
import {
  WebsiteAgentResultSchema,
  hashCanonical,
  parseTerminalReceipt,
  parseTerminalReceiptExpectation,
  type ProductionHash,
} from "./contracts.js";
import type { ProviderTurnResult } from "./plugin.js";
import { routeProducesGeneratedImage } from "./route-policy.js";
import type {
  GptContinuationStorePort,
  GptProviderContinuation,
  StoredGptContinuation,
} from "../../../capabilities/gpt/index.js";

export type ProductionTaskStatus =
  | "accepted"
  | "running"
  | "recovery_pending"
  | "completed"
  | "review_required"
  | "failed"
  | "cancelled";

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

type TaskRow = {
  task_json: string;
  identity_json: string;
  status: ProductionTaskStatus;
  result_json: string | null;
  staged_result_json: string | null;
  failure_json: string | null;
  failure_reason: string | null;
  updated_at: string;
};

type StepRow = {
  input_hash: ProductionHash;
  result_json: string;
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
  state: "pending" | "delivered" | "failed";
  failureCode: string | null;
  responseHash: ProductionHash | null;
  receiptHash: ProductionHash | null;
}>;

type ProductionOutboxObserver = (authority: ProductionOutboxAuthority) => void;

type ProductionAuthorityReader = Readonly<{
  readTask: (jobId: string) => StoredProductionTask | null;
  readCheckpoint: (jobId: string) => ProductionCheckpointAuthority | null;
  readLease: (jobId: string) => ProductionLeaseAuthority | null;
  readOutboxAuthority: (idempotencyKey: string) => ProductionOutboxAuthority | null;
}>;

const resolveProductionAuthority = (
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
  if (!record) return "missing";
  return verify(record);
};

const now = (): string => new Date().toISOString();
const json = (value: unknown): string => JSON.stringify(value);
const isSerializedTerminalFailure = (value: unknown, status: "review_required" | "failed"): value is SerializedExecutionFailure => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = ["cause", "code", "evidence_hash", "evidence_ref", "mutation_outcome", "status"];
  const cause = row.cause;
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(keys)
    && row.status === status && typeof row.code === "string" && row.code.length > 0
    && ["no", "yes", "unknown"].includes(String(row.mutation_outcome))
    && (row.evidence_ref === null || (typeof row.evidence_ref === "string" && row.evidence_ref.length > 0))
    && (row.evidence_hash === null || (typeof row.evidence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(row.evidence_hash)))
    && (cause === null || (Boolean(cause) && typeof cause === "object" && !Array.isArray(cause)
      && JSON.stringify(Object.keys(cause as Record<string, unknown>).sort()) === JSON.stringify(["code", "name"])
      && typeof (cause as Record<string, unknown>).name === "string"
      && ((cause as Record<string, unknown>).code === null || typeof (cause as Record<string, unknown>).code === "string")));
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
    response_json text, response_hash text, receipt_hash text
  );
  create table if not exists production_checkpoints(
    job_id text primary key references production_tasks(job_id) on delete restrict,
    attempt_id text not null, checkpoint_id text, checkpoint_hash text,
    state text not null check(state in ('none','persisted','failed')),
    updated_at text not null
  );
  create table if not exists production_leases(
    job_id text primary key references production_tasks(job_id) on delete restrict,
    attempt_id text not null, lease_version integer not null, fence_hash text not null,
    state text not null check(state in ('absent','active','stale','lost')),
    expires_at text, updated_at text not null
  );
  `);
};

const ensureContinuationSchema = (database: Database.Database): void => {
  const columns = new Set((database.prepare("pragma table_info(production_continuations)").all() as Array<{ name: string }>)
    .map((column) => column.name));
  const required = [
    "continuation_ref", "origin_job_id", "plugin_id", "owner_ref", "subject_ref",
    "authorization_ref", "conversation_identity_hash", "provider_json", "lane_version",
    "lane_owner_job_id", "created_at",
  ];
  if (required.every((column) => columns.has(column))) return;
  const count = Number((database.prepare("select count(*) as count from production_continuations").get() as { count: number }).count);
  if (count !== 0) throw executionFailure("review_required", "PRODUCTION_CONTINUATION_SCHEMA_MIGRATION_REQUIRES_REVIEW");
  database.exec(`
    drop table production_continuations;
    create table production_continuations(
      continuation_ref text primary key,
      origin_job_id text not null references production_tasks(job_id) on delete restrict,
      plugin_id text not null, owner_ref text not null, subject_ref text not null,
      authorization_ref text not null, conversation_identity_hash text not null,
      provider_json text not null, lane_version integer not null,
      lane_owner_job_id text, created_at text not null
    );
  `);
};

const ensureOutboxSchema = (database: Database.Database): void => {
  const columns = new Set((database.prepare("pragma table_info(production_outbox)").all() as Array<{ name: string }>)
    .map((column) => column.name));
  if (!columns.has("failure_code")) database.exec("alter table production_outbox add column failure_code text");
  if (!columns.has("response_json")) database.exec("alter table production_outbox add column response_json text");
  if (!columns.has("response_hash")) database.exec("alter table production_outbox add column response_hash text");
  if (!columns.has("receipt_hash")) database.exec("alter table production_outbox add column receipt_hash text");
};

const ensureTaskSchema = (database: Database.Database): void => {
  const columns = new Set((database.prepare("pragma table_info(production_tasks)").all() as Array<{ name: string }>)
    .map((column) => column.name));
  if (!columns.has("staged_result_json")) database.exec("alter table production_tasks add column staged_result_json text");
  if (!columns.has("failure_json")) database.exec("alter table production_tasks add column failure_json text");
};

export class ProductionRuntimeStore implements GptContinuationStorePort {
  private readonly database: Database.Database;
  private outboxObserver: ProductionOutboxObserver | null = null;
  private outboxDeliveryTail = Promise.resolve();

  public constructor(dataDir: string) {
    this.database = new Database(path.join(dataDir, "production-runtime.sqlite"));
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    createProductionTables(this.database);
    ensureContinuationSchema(this.database);
    ensureTaskSchema(this.database);
    ensureOutboxSchema(this.database);
  }

  public setOutboxObserver(observer: ProductionOutboxObserver): void {
    this.outboxObserver = observer;
  }

  public acceptTask(task: WebsiteAgentTask, identity: DurablePluginIdentity): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) throw executionFailure("review_required", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      if (json(existing.identity) !== json(identity)) {
        throw executionFailure("review_required", "PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY");
      }
      return existing;
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,identity_json,status,created_at,updated_at
    ) values(?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), json(identity), "accepted", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare("select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at from production_tasks where job_id=?")
      .get(jobId) as TaskRow | undefined;
    if (!row) return null;
    return {
      task: JSON.parse(row.task_json) as WebsiteAgentTask,
      identity: JSON.parse(row.identity_json) as DurablePluginIdentity,
      status: row.status,
      result: row.result_json ? JSON.parse(row.result_json) as WebsiteAgentResult : null,
      staged_result: row.staged_result_json ? JSON.parse(row.staged_result_json) as WebsiteAgentResult : null,
      failure: row.failure_json ? JSON.parse(row.failure_json) as SerializedExecutionFailure : null,
      failure_reason: row.failure_reason,
      updated_at: row.updated_at,
    };
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare("select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at from production_tasks order by updated_at,job_id")
      .all() as TaskRow[];
    return rows.map((row) => ({
      task: JSON.parse(row.task_json) as WebsiteAgentTask,
      identity: JSON.parse(row.identity_json) as DurablePluginIdentity,
      status: row.status,
      result: row.result_json ? JSON.parse(row.result_json) as WebsiteAgentResult : null,
      staged_result: row.staged_result_json ? JSON.parse(row.staged_result_json) as WebsiteAgentResult : null,
      failure: row.failure_json ? JSON.parse(row.failure_json) as SerializedExecutionFailure : null,
      failure_reason: row.failure_reason,
      updated_at: row.updated_at,
    }));
  }

  public markRunning(jobId: string): void {
    this.database.prepare("update production_tasks set status='running',failure_reason=null,updated_at=? where job_id=? and status in ('accepted','recovery_pending')")
      .run(now(), jobId);
  }

  public readStep(jobId: string, stepId: string, inputHash: ProductionHash): ProviderTurnResult | null {
    const row = this.database.prepare("select input_hash,result_json from production_steps where job_id=? and step_id=?")
      .get(jobId, stepId) as StepRow | undefined;
    if (!row) return null;
    if (row.input_hash !== inputHash) throw executionFailure("review_required", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
    return JSON.parse(row.result_json) as ProviderTurnResult;
  }

  public writeStep(jobId: string, stepId: string, inputHash: ProductionHash, result: ProviderTurnResult): void {
    const existing = this.readStep(jobId, stepId, inputHash);
    if (existing) {
      if (json(existing) !== json(result)) throw executionFailure("review_required", `PLUGIN_CHECKPOINT_RESULT_DRIFT:${stepId}`);
      return;
    }
    this.database.prepare("insert into production_steps(job_id,step_id,input_hash,result_json,completed_at) values(?,?,?,?,?)")
      .run(jobId, stepId, inputHash, json(result), now());
  }

  public createGptContinuation(continuation: StoredGptContinuation): void {
    this.database.prepare(`insert into production_continuations(
      continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,authorization_ref,
      conversation_identity_hash,provider_json,lane_version,lane_owner_job_id,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)`).run(
      continuation.continuation_ref,
      continuation.origin_job_id,
      continuation.plugin_id,
      continuation.owner_ref,
      continuation.subject_ref,
      continuation.authorization_ref,
      continuation.conversation_identity_hash,
      json(continuation.provider),
      continuation.lane_version,
      continuation.lane_owner_job_id,
      now(),
    );
  }

  public readGptContinuation(continuationRef: string): StoredGptContinuation | null {
    const row = this.database.prepare(`select continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,
      authorization_ref,conversation_identity_hash,provider_json,lane_version,lane_owner_job_id
      from production_continuations where continuation_ref=?`)
      .get(continuationRef) as Omit<StoredGptContinuation, "provider"> & { provider_json: string } | undefined;
    return row ? {
      ...row,
      provider: JSON.parse(row.provider_json) as GptProviderContinuation,
    } : null;
  }

  public acquireGptContinuationLane(continuationRef: string, ownerJobId: string): StoredGptContinuation {
    const changed = this.database.prepare(`update production_continuations
      set lane_owner_job_id=?,lane_version=case when lane_owner_job_id is null then lane_version+1 else lane_version end
      where continuation_ref=? and (lane_owner_job_id is null or lane_owner_job_id=?)`)
      .run(ownerJobId, continuationRef, ownerJobId);
    if (changed.changes !== 1) throw executionFailure("review_required", "GPT_CONTINUATION_LANE_BUSY");
    return this.readGptContinuation(continuationRef)!;
  }

  public advanceGptContinuationLane(input: Readonly<{
    continuationRef: string;
    ownerJobId: string;
    laneVersion: number;
    pluginId: string;
    provider: GptProviderContinuation;
    conversationIdentityHash: ProductionHash;
  }>): void {
    const changed = this.database.prepare(`update production_continuations
      set plugin_id=?,conversation_identity_hash=?,provider_json=?,lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`).run(
      input.pluginId,
      input.conversationIdentityHash,
      json(input.provider),
      input.continuationRef,
      input.ownerJobId,
      input.laneVersion,
    );
    if (changed.changes !== 1) throw executionFailure("review_required", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
  }

  public releaseGptContinuationLane(continuationRef: string, ownerJobId: string, laneVersion: number): void {
    this.database.prepare(`update production_continuations set lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`)
      .run(continuationRef, ownerJobId, laneVersion);
  }

  public stageResult(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    const accepted = this.readTask(jobId);
    if (!accepted || result.job_id !== accepted.task.job_id
      || result.source_task_id !== accepted.task.source_task_id
      || result.product_id !== accepted.task.product_id || result.action_id !== accepted.task.action_id
      || result.plugin_id !== accepted.identity.plugin_id || result.plugin_version !== accepted.identity.plugin_version) {
      throw executionFailure("review_required", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
    }
    if (accepted.staged_result && json(accepted.staged_result) !== json(result)) {
      throw executionFailure("review_required", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    const changed = this.database.prepare(`update production_tasks set staged_result_json=?,updated_at=?
      where job_id=? and status not in ('completed','review_required','failed','cancelled')`)
      .run(json(result), now(), jobId);
    if (changed.changes !== 1) throw executionFailure("review_required", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
  }

  public setTerminal(jobId: string, status: Extract<ProductionTaskStatus, "completed" | "review_required" | "failed" | "cancelled">, failure: SerializedExecutionFailure | null, result: WebsiteAgentResult | null): void {
    if (status === "completed") {
      if (!result) throw new Error("PRODUCTION_COMPLETED_RESULT_REQUIRED");
      WebsiteAgentResultSchema.parse(result);
      const accepted = this.readTask(jobId);
      if (!accepted || result.job_id !== accepted.task.job_id
        || result.source_task_id !== accepted.task.source_task_id
        || result.product_id !== accepted.task.product_id
        || result.action_id !== accepted.task.action_id
        || result.plugin_id !== accepted.identity.plugin_id
        || result.plugin_version !== accepted.identity.plugin_version) {
        throw executionFailure("review_required", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
      }
      if (failure) throw new Error("PRODUCTION_COMPLETED_FAILURE_FORBIDDEN");
    } else if (result) {
      throw new Error("PRODUCTION_NONCOMPLETED_RESULT_FORBIDDEN");
    } else if ((status === "failed" || status === "review_required")
      && !isSerializedTerminalFailure(failure, status)) {
      throw new Error("PRODUCTION_TYPED_TERMINAL_FAILURE_REQUIRED");
    } else if (status === "cancelled" && failure) {
      throw new Error("PRODUCTION_CANCELLED_FAILURE_FORBIDDEN");
    }
    const changed = this.database.prepare(`update production_tasks set status=?,failure_json=?,failure_reason=?,result_json=?,staged_result_json=null,updated_at=?
      where job_id=? and status not in ('completed','review_required','failed','cancelled')`).run(
      status, failure ? json(failure) : null, failure?.code ?? null, result ? json(result) : null, now(), jobId,
    );
    if (changed.changes === 0) {
      const existing = this.readTask(jobId);
      if (!existing || existing.status !== status || json(existing.result) !== json(result)
        || json(existing.failure) !== json(failure)) {
        throw executionFailure("review_required", "PRODUCTION_TASK_FIRST_TERMINAL_CONFLICT");
      }
    }
  }

  public setRecoveryPending(jobId: string, reason: string): void {
    this.database.prepare("update production_tasks set status='recovery_pending',failure_json=null,failure_reason=?,updated_at=? where job_id=? and status in ('accepted','running','recovery_pending')")
      .run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordCheckpoint(authority: ProductionCheckpointAuthority): ProductionCheckpointAuthority {
    this.database.prepare(`insert into production_checkpoints(
      job_id,attempt_id,checkpoint_id,checkpoint_hash,state,updated_at
    ) values(?,?,?,?,?,?) on conflict(job_id) do update set
      attempt_id=excluded.attempt_id,checkpoint_id=excluded.checkpoint_id,
      checkpoint_hash=excluded.checkpoint_hash,state=excluded.state,updated_at=excluded.updated_at`).run(
      authority.jobId, authority.attemptId, authority.checkpointId,
      authority.checkpointHash, authority.state, now(),
    );
    return this.readCheckpoint(authority.jobId)!;
  }

  public readCheckpoint(jobId: string): ProductionCheckpointAuthority | null {
    const row = this.database.prepare(`select job_id,attempt_id,checkpoint_id,checkpoint_hash,state
      from production_checkpoints where job_id=?`).get(jobId) as Readonly<{
      job_id: string; attempt_id: string; checkpoint_id: string | null;
      checkpoint_hash: ProductionHash | null; state: ProductionCheckpointAuthority["state"];
    }> | undefined;
    return row ? Object.freeze({
      jobId: row.job_id,
      attemptId: row.attempt_id,
      checkpointId: row.checkpoint_id,
      checkpointHash: row.checkpoint_hash,
      state: row.state,
    }) : null;
  }

  public recordLease(authority: ProductionLeaseAuthority): ProductionLeaseAuthority {
    this.database.prepare(`insert into production_leases(
      job_id,attempt_id,lease_version,fence_hash,state,expires_at,updated_at
    ) values(?,?,?,?,?,?,?) on conflict(job_id) do update set
      attempt_id=excluded.attempt_id,lease_version=excluded.lease_version,
      fence_hash=excluded.fence_hash,state=excluded.state,
      expires_at=excluded.expires_at,updated_at=excluded.updated_at`).run(
      authority.jobId, authority.attemptId, authority.leaseVersion,
      authority.fenceHash, authority.state, authority.expiresAt, now(),
    );
    return this.readLease(authority.jobId)!;
  }

  public readLease(jobId: string): ProductionLeaseAuthority | null {
    const row = this.database.prepare(`select job_id,attempt_id,lease_version,fence_hash,state,expires_at
      from production_leases where job_id=?`).get(jobId) as Readonly<{
      job_id: string; attempt_id: string; lease_version: number; fence_hash: ProductionHash;
      state: ProductionLeaseAuthority["state"]; expires_at: string | null;
    }> | undefined;
    return row ? Object.freeze({
      jobId: row.job_id,
      attemptId: row.attempt_id,
      leaseVersion: row.lease_version,
      fenceHash: row.fence_hash,
      state: row.state,
      expiresAt: row.expires_at,
    }) : null;
  }

  public enqueue(write: ProductionOutboxWrite): void {
    const bytes = typeof write.body === "string" ? Buffer.from(write.body) : Buffer.from(write.body);
    const headers = json(write.headers);
    const existing = this.database.prepare(`select kind,path,method,headers_json,body_blob
      from production_outbox where idempotency_key=?`).get(write.idempotency_key) as
      | { kind: string; path: string; method: string; headers_json: string; body_blob: Buffer }
      | undefined;
    if (existing) {
      if (existing.kind !== write.kind || existing.path !== write.path || existing.method !== write.method
        || existing.headers_json !== headers || !existing.body_blob.equals(bytes)) {
        throw executionFailure("review_required", "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
      }
      const authority = this.readOutboxAuthority(write.idempotency_key);
      if (authority) this.outboxObserver?.(authority);
      return;
    }
    this.database.prepare(`insert into production_outbox(
      idempotency_key,kind,path,method,headers_json,body_blob,created_at
    ) values(?,?,?,?,?,?,?)`).run(
      write.idempotency_key, write.kind, write.path, write.method, headers, bytes, now(),
    );
    this.outboxObserver?.(this.readOutboxAuthority(write.idempotency_key)!);
  }

  public pendingOutbox(): readonly ProductionOutboxWrite[] {
    const rows = this.database.prepare("select idempotency_key,kind,path,method,headers_json,body_blob from production_outbox where sent_at is null order by created_at,idempotency_key")
      .all() as Array<{ idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string; method: ProductionOutboxWrite["method"]; headers_json: string; body_blob: Buffer }>;
    return rows.map((row) => ({
      idempotency_key: row.idempotency_key,
      kind: row.kind,
      path: row.path,
      method: row.method,
      headers: JSON.parse(row.headers_json) as Record<string, string>,
      body: row.body_blob,
    }));
  }

  public markOutboxSent(idempotencyKey: string, response: unknown): void {
    const transaction = this.database.transaction(() => {
      const existing = this.database.prepare(`select kind,body_blob,sent_at,response_json,response_hash from production_outbox
        where idempotency_key=?`).get(idempotencyKey) as
        { kind: ProductionOutboxWrite["kind"]; body_blob: Buffer; sent_at: string | null;
          response_json: string | null; response_hash: string | null } | undefined;
      if (!existing) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      const validatedResponse = existing.kind === "terminal"
        ? parseTerminalReceipt(response, parseTerminalReceiptExpectation(existing.body_blob.toString("utf8")))
        : response;
      const responseJson = json(validatedResponse);
      const responseHash = hashCanonical(validatedResponse);
      const receiptHash = validatedResponse && typeof validatedResponse === "object" && !Array.isArray(validatedResponse)
        && typeof (validatedResponse as Record<string, unknown>).receipt_hash === "string"
        && /^sha256:[a-f0-9]{64}$/u.test((validatedResponse as Record<string, unknown>).receipt_hash as string)
        ? (validatedResponse as Record<string, unknown>).receipt_hash as ProductionHash : null;
      if (existing.sent_at) {
        if (existing.response_json !== responseJson || existing.response_hash !== responseHash) {
          throw executionFailure("review_required", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
        }
        return;
      }
      this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
        sent_at=?,failure_code=null where idempotency_key=? and sent_at is null`)
        .run(responseJson, responseHash, receiptHash, now(), idempotencyKey);
    });
    transaction();
    const authority = this.readOutboxAuthority(idempotencyKey);
    if (authority) this.outboxObserver?.(authority);
  }

  public readOutboxResponse(idempotencyKey: string): unknown | null {
    const row = this.database.prepare("select response_json from production_outbox where idempotency_key=?")
      .get(idempotencyKey) as { response_json: string | null } | undefined;
    return row?.response_json ? JSON.parse(row.response_json) as unknown : null;
  }

  public deliverOutbox<T>(idempotencyKey: string, send: () => Promise<T>): Promise<T> {
    const operation = async (): Promise<T> => {
      const authority = this.readOutboxAuthority(idempotencyKey);
      if (!authority) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (authority.state === "delivered") return this.readOutboxResponse(idempotencyKey) as T;
      if (authority.state === "failed") this.markOutboxPending(idempotencyKey);
      try {
        const response = await send();
        this.markOutboxSent(idempotencyKey, response);
        return response;
      } catch (error) {
        this.markOutboxFailed(idempotencyKey, "OUTBOX_DELIVERY_FAILED");
        throw error;
      }
    };
    const result = this.outboxDeliveryTail.then(operation, operation);
    this.outboxDeliveryTail = result.then(() => undefined, () => undefined);
    return result;
  }

  public markOutboxPending(idempotencyKey: string): void {
    this.database.prepare("update production_outbox set failure_code=null where idempotency_key=? and sent_at is null")
      .run(idempotencyKey);
    const authority = this.readOutboxAuthority(idempotencyKey);
    if (authority) this.outboxObserver?.(authority);
  }

  public markOutboxFailed(idempotencyKey: string, failureCode: string): void {
    this.database.prepare("update production_outbox set failure_code=? where idempotency_key=? and sent_at is null")
      .run(failureCode, idempotencyKey);
    const authority = this.readOutboxAuthority(idempotencyKey);
    if (authority) this.outboxObserver?.(authority);
  }

  public readOutboxAuthority(idempotencyKey: string): ProductionOutboxAuthority | null {
    const row = this.database.prepare(`select idempotency_key,kind,path,sent_at,failure_code,response_hash,receipt_hash
      from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
      idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string;
      sent_at: string | null; failure_code: string | null;
      response_hash: ProductionHash | null; receipt_hash: ProductionHash | null;
    }> | undefined;
    if (!row) return null;
    const match = /\/jobs\/([^/]+)\//u.exec(row.path);
    if (!match?.[1]) throw new Error("PRODUCTION_OUTBOX_JOB_ID_MISSING");
    return Object.freeze({
      idempotencyKey: row.idempotency_key,
      jobId: decodeURIComponent(match[1]),
      kind: row.kind,
      state: row.sent_at && row.response_hash ? "delivered" : row.failure_code ? "failed" : "pending",
      failureCode: row.failure_code,
      responseHash: row.response_hash,
      receiptHash: row.receipt_hash,
    });
  }

  public outboxAuthorities(): readonly ProductionOutboxAuthority[] {
    const rows = this.database.prepare("select idempotency_key from production_outbox order by created_at,idempotency_key")
      .all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => this.readOutboxAuthority(row.idempotency_key)!));
  }

  public reconcileDeliveredTerminals(): number {
    const rows = this.database.prepare(`select body_blob,response_json from production_outbox
      where kind='terminal' and sent_at is not null and response_hash is not null
      order by created_at,idempotency_key`).all() as Array<{ body_blob: Buffer; response_json: string | null }>;
    let reconciled = 0;
    for (const row of rows) {
      const expected = parseTerminalReceiptExpectation(row.body_blob.toString("utf8"));
      let rawReceipt: unknown;
      try { rawReceipt = row.response_json ? JSON.parse(row.response_json) as unknown : null; }
      catch (cause) {
        throw executionFailure("review_required", "PRODUCTION_TERMINAL_RECEIPT_PERSISTED_INVALID", { cause });
      }
      const receipt = parseTerminalReceipt(rawReceipt, expected);
      const task = this.readTask(receipt.job_id);
      if (!task) throw executionFailure("review_required", "PRODUCTION_TERMINAL_TASK_MISSING");
      if (["completed", "failed", "review_required", "cancelled"].includes(task.status)) {
        const failureMatches = task.status === "failed" || task.status === "review_required"
          ? hashCanonical(task.failure) === hashCanonical(receipt.failure)
          : task.failure === null && receipt.failure === null;
        const resultMatches = task.status === "completed"
          ? Boolean(task.result) && hashCanonical(task.result) === receipt.payload_hash
          : task.result === null;
        if (task.status !== receipt.terminal_status || !failureMatches || !resultMatches) {
          throw executionFailure("review_required", "PRODUCTION_TERMINAL_RECEIPT_LOCAL_STATE_MISMATCH");
        }
        continue;
      }
      const status = receipt.terminal_status;
      const failure = receipt.failure;
      const result = status === "completed" ? task.staged_result : null;
      if (status === "completed" && (!result || receipt.payload_hash !== hashCanonical(result))) {
        throw executionFailure("review_required", "PRODUCTION_TERMINAL_OUTBOX_RESULT_MISSING");
      }
      if ((status === "failed" || status === "review_required")
        && receipt.payload_hash !== hashCanonical({ job_id: receipt.job_id, failure })) {
        throw executionFailure("review_required", "PRODUCTION_TERMINAL_RECEIPT_FAILURE_HASH_MISMATCH");
      }
      this.setTerminal(receipt.job_id, status,
        status === "failed" || status === "review_required" ? failure : null,
        result);
      reconciled += 1;
    }
    return reconciled;
  }

  public resolveAuthority(
    authorityRef: string,
    authorityHash: ProductionHash,
  ): "verified" | "missing" | "mismatch" {
    return resolveProductionAuthority(this, authorityRef, authorityHash);
  }

  public pendingOutboxCount(): number {
    return Number((this.database.prepare("select count(*) as count from production_outbox where sent_at is null").get() as { count: number }).count);
  }

  public isLedgerConsistent(activeJobIds: ReadonlySet<string>): boolean {
    const tasks = new Map(this.taskAuthorities().map((record) => [record.task.job_id, record] as const));
    const outbox = this.outboxAuthorities();
    if (outbox.some((authority) => authority.state !== "delivered"
      || !authority.responseHash
      || (authority.kind === "artifact" && !authority.receiptHash))) return false;
    const rows = this.database.prepare(`select kind,path,body_blob,response_json,receipt_hash from production_outbox
      order by created_at,idempotency_key`).all() as Array<{
      kind: ProductionOutboxWrite["kind"];
      path: string;
      body_blob: Buffer;
      response_json: string | null;
      receipt_hash: ProductionHash | null;
    }>;
    const terminalByJob = new Map<string, Record<string, unknown>>();
    const artifactCountByJob = new Map<string, number>();
    const artifactReceiptsByJob = new Map<string, ProductionHash[]>();
    const generatedImageByJob = new Set<string>();
    for (const row of rows) {
      const match = /\/jobs\/([^/]+)\//u.exec(row.path);
      if (!match?.[1]) return false;
      const jobId = decodeURIComponent(match[1]);
      if (row.kind === "artifact") {
        artifactCountByJob.set(jobId, (artifactCountByJob.get(jobId) ?? 0) + 1);
        if (!row.receipt_hash) return false;
        artifactReceiptsByJob.set(jobId, [...(artifactReceiptsByJob.get(jobId) ?? []), row.receipt_hash]);
        if (row.path.includes("/artifacts/generated_image/")) generatedImageByJob.add(jobId);
      }
      if (row.kind === "terminal") {
        try {
          const terminal = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
          const expected = parseTerminalReceiptExpectation(terminal);
          if (expected.job_id !== jobId || !row.response_json) return false;
          parseTerminalReceipt(JSON.parse(row.response_json) as unknown, expected);
          terminalByJob.set(jobId, terminal);
        }
        catch { return false; }
      }
    }
    for (const [jobId, task] of tasks) {
      const terminal = terminalByJob.get(jobId);
      const isTerminal = ["completed", "failed", "review_required", "cancelled"].includes(task.status);
      if (isTerminal !== Boolean(terminal) || (terminal && terminal.terminal_status !== task.status)) return false;
      if ((task.status === "failed" || task.status === "review_required")
        && (!task.failure || terminal?.failure === undefined
          || json(task.failure) !== json(terminal.failure))) return false;
      if ((task.status === "completed" || task.status === "cancelled") && task.failure) return false;
      if (task.status === "completed") {
        if (!task.result || terminal?.payload_hash !== hashCanonical(task.result)
          || task.result.evidence_refs.length === 0
          || task.result.evidence_refs.some((ref) => !/^rec-[a-f0-9]{64}$/u.test(ref))) return false;
        const expectedArtifacts = generatedImageByJob.has(jobId) ? 3 : 2;
        if (generatedImageByJob.has(jobId) && !routeProducesGeneratedImage(task.task)) return false;
        if (artifactCountByJob.get(jobId) !== expectedArtifacts) return false;
        const terminalReceipts = terminal?.result_object_receipts;
        if (!Array.isArray(terminalReceipts)
          || terminalReceipts.some((receipt) => typeof receipt !== "string")
          || [...terminalReceipts].sort().join("\0")
            !== [...(artifactReceiptsByJob.get(jobId) ?? [])].sort().join("\0")) return false;
      } else if (!isTerminal) {
        const lease = this.readLease(jobId);
        const checkpoint = this.readCheckpoint(jobId);
        if (!activeJobIds.has(jobId) || lease?.state !== "active" || !checkpoint) return false;
        if ((artifactCountByJob.get(jobId) ?? 0) > 0) return false;
      }
    }
    const orphanLane = this.database.prepare(`select lane_owner_job_id from production_continuations
      where lane_owner_job_id is not null`).all() as Array<{ lane_owner_job_id: string }>;
    return orphanLane.every((row) => activeJobIds.has(row.lane_owner_job_id));
  }

  public close(): void {
    this.database.close();
  }
}

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
    const reader: ProductionAuthorityReader = {
      readTask: (jobId) => {
        const row = database!.prepare(`select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at
          from production_tasks where job_id=?`).get(jobId) as TaskRow | undefined;
        return row ? {
          task: JSON.parse(row.task_json) as WebsiteAgentTask,
          identity: JSON.parse(row.identity_json) as DurablePluginIdentity,
          status: row.status,
          result: row.result_json ? JSON.parse(row.result_json) as WebsiteAgentResult : null,
          staged_result: row.staged_result_json ? JSON.parse(row.staged_result_json) as WebsiteAgentResult : null,
          failure: row.failure_json ? JSON.parse(row.failure_json) as SerializedExecutionFailure : null,
          failure_reason: row.failure_reason,
          updated_at: row.updated_at,
        } : null;
      },
      readCheckpoint: (jobId) => {
        const row = database!.prepare(`select job_id,attempt_id,checkpoint_id,checkpoint_hash,state
          from production_checkpoints where job_id=?`).get(jobId) as Readonly<{
          job_id: string; attempt_id: string; checkpoint_id: string | null;
          checkpoint_hash: ProductionHash | null; state: ProductionCheckpointAuthority["state"];
        }> | undefined;
        return row ? {
          jobId: row.job_id, attemptId: row.attempt_id, checkpointId: row.checkpoint_id,
          checkpointHash: row.checkpoint_hash, state: row.state,
        } : null;
      },
      readLease: (jobId) => {
        const row = database!.prepare(`select job_id,attempt_id,lease_version,fence_hash,state,expires_at
          from production_leases where job_id=?`).get(jobId) as Readonly<{
          job_id: string; attempt_id: string; lease_version: number; fence_hash: ProductionHash;
          state: ProductionLeaseAuthority["state"]; expires_at: string | null;
        }> | undefined;
        return row ? {
          jobId: row.job_id, attemptId: row.attempt_id, leaseVersion: row.lease_version,
          fenceHash: row.fence_hash, state: row.state, expiresAt: row.expires_at,
        } : null;
      },
      readOutboxAuthority: (idempotencyKey) => {
        const row = database!.prepare(`select idempotency_key,kind,path,sent_at,failure_code,response_hash,receipt_hash
          from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
          idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string;
          sent_at: string | null; failure_code: string | null;
          response_hash: ProductionHash | null; receipt_hash: ProductionHash | null;
        }> | undefined;
        if (!row) return null;
        const match = /\/jobs\/([^/]+)\//u.exec(row.path);
        if (!match?.[1]) return null;
        return {
          idempotencyKey: row.idempotency_key,
          jobId: decodeURIComponent(match[1]),
          kind: row.kind,
          state: row.sent_at && row.response_hash ? "delivered" : row.failure_code ? "failed" : "pending",
          failureCode: row.failure_code,
          responseHash: row.response_hash,
          receiptHash: row.receipt_hash,
        };
      },
    };
    return resolveProductionAuthority(reader, authorityRef, authorityHash);
  } catch {
    return "missing";
  } finally {
    database?.close();
  }
};
