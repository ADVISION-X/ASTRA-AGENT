import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure, typedExecutionFailure } from "../../execution-failure.js";
import type {
  AttemptFailureFirstFact,
  SerializedExecutionFailure,
  SerializedTerminalFailure,
} from "./terminal-failure.js";
import type { WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";

export type ProductionTaskStatus = "failed" | "completed";

export interface StoredProductionTask {
  readonly task: WebsiteAgentTask;
  readonly status: ProductionTaskStatus;
  readonly result: WebsiteAgentResult | null;
  readonly staged_result: WebsiteAgentResult | null;
  readonly attempt_failure: AttemptFailureFirstFact | null;
  readonly current_attempt_id: string;
  readonly current_reason: string | null;
  readonly updated_at: string;
}

export type TaskRow = {
  job_id: string;
  request_hash: string;
  task_json: string;
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
  readonly kind: "artifact" | "terminal" | "provider_cooldown";
  readonly path: string;
  readonly method: "POST" | "PUT";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
}

export type ProductionOutboxAuthority = Readonly<{
  idempotencyKey: string;
  jobId: string;
  kind: ProductionOutboxWrite["kind"];
  state: "pending" | "delivered";
  lastError: string | null;
  responseHash: ProductionHash | null;
  receiptHash: ProductionHash | null;
}>;

export type ProductionAuthorityReader = Readonly<{
  readTask: (jobId: string) => StoredProductionTask | null;
  readOutboxAuthority: (idempotencyKey: string) => ProductionOutboxAuthority | null;
}>;

export type ProductionOutboxAuthorityRow = Readonly<{
  idempotency_key: string; kind: string; path: string; method: string; headers_json: string; body_blob: Buffer;
  created_at: string; sent_at: string | null; last_error: string | null; response_json: string | null;
  response_hash: string | null; receipt_hash: string | null;
}>;

export const now = (): string => new Date().toISOString();
export const json = (value: unknown): string => JSON.stringify(value);

/** The attempt a queued terminal body belongs to; a corrupt body has none and stays an unresolved candidate. */
export const terminalBodyAttemptId = (body: Buffer): string | null => {
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"));
    return typeof parsed === "object" && parsed !== null && "attempt_id" in parsed
      && typeof parsed.attempt_id === "string" && parsed.attempt_id.length > 0 ? parsed.attempt_id : null;
  } catch {
    return null;
  }
};

const validSerializedCause = (cause: unknown): boolean => cause === null || (
  Boolean(cause) && typeof cause === "object" && !Array.isArray(cause)
  && JSON.stringify(Object.keys(cause as Record<string, unknown>).sort()) === JSON.stringify(["code", "name"])
  && typeof (cause as Record<string, unknown>).name === "string"
  && ((cause as Record<string, unknown>).code === null || typeof (cause as Record<string, unknown>).code === "string")
);

const serializedFailureKeys = ["browser_outcome", "cause", "child_capability_id", "child_proof_hash",
  "child_proof_ref", "code", "effect_scope", "evidence_hash", "evidence_ref", "mutation_outcome",
  "stopped_empty_proof"];
const serializedTerminalFailureKeys = [...serializedFailureKeys,
  "provider_effect_identity_hash", "settled_result_payload_hash"].sort();
const stoppedProofRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const stoppedProofHash = (value: unknown): boolean => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const stoppedProofWalRef = (value: unknown): boolean => typeof value === "string" && /^browser-mutation:[^\s]+$/u.test(value);
const stoppedProofRetryValid = (value: unknown, index: number): value is Record<string, unknown> => stoppedProofRecord(value)
  && Object.keys(value).sort().join("|") === "effect_identity_hash|ordinal|pre_empty_observation_revision_hash|wal_authority_hash|wal_authority_ref"
  && value.ordinal === index + 1 && stoppedProofWalRef(value.wal_authority_ref)
  && [value.effect_identity_hash, value.wal_authority_hash, value.pre_empty_observation_revision_hash].every(stoppedProofHash);
const serializedStoppedEmptyProofValid = (value: unknown): boolean => {
  if (value === null) return true;
  if (!stoppedProofRecord(value) || Object.keys(value).sort().join("|") !== ["schema_version", "original_effect_identity_hash",
    "original_wal_authority_ref", "original_wal_authority_hash", "retries", "terminal_observation_revision_hash",
    "terminal_observed_at"].sort().join("|") || value.schema_version !== "gpt-stopped-empty-after-five-retries.v1"
    || ![value.original_effect_identity_hash, value.original_wal_authority_hash, value.terminal_observation_revision_hash].every(stoppedProofHash)
    || !stoppedProofWalRef(value.original_wal_authority_ref) || typeof value.terminal_observed_at !== "string"
    || !Number.isFinite(Date.parse(value.terminal_observed_at)) || new Date(value.terminal_observed_at).toISOString() !== value.terminal_observed_at
    || !Array.isArray(value.retries) || value.retries.length !== 5 || !value.retries.every(stoppedProofRetryValid)) return false;
  return new Set([value.original_effect_identity_hash, ...value.retries.map(retry => retry.effect_identity_hash)]).size === 6
    && new Set([value.original_wal_authority_ref, ...value.retries.map(retry => retry.wal_authority_ref)]).size === 6;
};
const serializedEvidenceValid = (row: Record<string, unknown>): boolean => {
  const refValid = row.evidence_ref === null
    || (typeof row.evidence_ref === "string" && row.evidence_ref.length > 0);
  const hashValid = row.evidence_hash === null
    || (typeof row.evidence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(row.evidence_hash));
  return refValid && hashValid;
};
const serializedChildProofValid = (row: Record<string, unknown>): boolean => {
  const bothNull = row.child_proof_ref === null && row.child_proof_hash === null;
  const bothPresent = typeof row.child_proof_ref === "string" && row.child_proof_ref.length > 0
    && typeof row.child_proof_hash === "string"
    && /^sha256:[a-f0-9]{64}$/u.test(row.child_proof_hash);
  return bothNull || bothPresent;
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
const serializedFailureCoreValid = (row: Record<string, unknown>): boolean =>
  typeof row.code === "string" && row.code.length > 0
  && ["no", "dispatched", "confirmed"].includes(String(row.mutation_outcome))
  && (browserFailureFactsAbsent(row) || browserFailureFactsValid(row))
  && serializedEvidenceValid(row) && validSerializedCause(row.cause);

export const isSerializedTerminalFailure = (value: unknown): value is SerializedExecutionFailure => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(serializedFailureKeys)
    && serializedFailureCoreValid(row) && serializedChildProofValid(row)
    && serializedStoppedEmptyProofValid(row.stopped_empty_proof)
    && (row.code === "GPT_RESPONSE_STOPPED_EMPTY"
      ? row.stopped_empty_proof !== null && row.child_proof_ref !== null
        : row.stopped_empty_proof === null);
};

const providerEffectIdentityValid = (row: Record<string, unknown>): boolean =>
  row.effect_scope === "provider_effect"
    ? typeof row.provider_effect_identity_hash === "string"
      && /^sha256:[a-f0-9]{64}$/u.test(row.provider_effect_identity_hash)
    : row.provider_effect_identity_hash === null;

const settledResultHashValid = (row: Record<string, unknown>): boolean =>
  row.code === "RESULT_SETTLED_UNUSABLE"
    ? row.effect_scope === "provider_effect" && row.browser_outcome === "CONFIRMED"
      && row.mutation_outcome === "confirmed"
      && typeof row.settled_result_payload_hash === "string"
      && /^sha256:[a-f0-9]{64}$/u.test(row.settled_result_payload_hash)
    : row.settled_result_payload_hash === null;

const stoppedEmptyTransportValid = (row: Record<string, unknown>): boolean => {
  if (row.code !== "GPT_RESPONSE_STOPPED_EMPTY") return row.stopped_empty_proof === null
    && row.child_proof_ref === null && row.child_proof_hash === null;
  const proof = row.stopped_empty_proof;
  const terminal = stoppedProofRecord(proof) && Array.isArray(proof.retries) ? proof.retries[4] : null;
  return row.effect_scope === "provider_effect" && row.browser_outcome === "CONFIRMED"
    && row.child_capability_id === "retry_exact_gpt_response_once" && row.mutation_outcome === "confirmed"
    && proof !== null && serializedStoppedEmptyProofValid(proof) && serializedChildProofValid(row)
    && stoppedProofRecord(terminal) && row.provider_effect_identity_hash === terminal.effect_identity_hash
    && row.evidence_ref === terminal.wal_authority_ref && row.evidence_hash === terminal.wal_authority_hash;
};

const terminalFailureTransportValid = (row: Record<string, unknown>): boolean =>
  providerEffectIdentityValid(row) && settledResultHashValid(row) && stoppedEmptyTransportValid(row)
    && !(row.effect_scope === "provider_effect"
      && row.browser_outcome === "CONFIRMED" && row.mutation_outcome === "no");

export const isSerializedTerminalFailureTransport = (
  value: unknown,
): value is SerializedTerminalFailure => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const executionFailure = Object.fromEntries(serializedFailureKeys.map((key) => [key, row[key]]));
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(serializedTerminalFailureKeys)
    && isSerializedTerminalFailure(executionFailure)
    && terminalFailureTransportValid(row);
};

const releaseDescriptorValid = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify([
    "attempt_id", "body_payload_hash", "lease_version", "request_id", "write_request_payload_hash",
  ])
    && typeof row.attempt_id === "string" && row.attempt_id.length > 0
    && Number.isSafeInteger(row.lease_version) && Number(row.lease_version) > 0
    && typeof row.request_id === "string" && row.request_id.length > 0
    && [row.body_payload_hash, row.write_request_payload_hash]
      .every((hash) => typeof hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(hash));
};

export const isAttemptFailureFirstFact = (value: unknown): value is AttemptFailureFirstFact => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify(["failure_core", "release_descriptor"])
    && isSerializedTerminalFailureTransport(row.failure_core)
    && releaseDescriptorValid(row.release_descriptor);
};

const typedAttemptFailureOrNull = (raw: string | null): AttemptFailureFirstFact | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAttemptFailureFirstFact(parsed) ? parsed : null;
  } catch { return null; }
};

export const storedTaskFromRow = (row: TaskRow): StoredProductionTask => ({
  task: JSON.parse(row.task_json) as WebsiteAgentTask,
  status: row.status,
  result: row.result_json ? JSON.parse(row.result_json) as WebsiteAgentResult : null,
  staged_result: row.staged_result_json ? JSON.parse(row.staged_result_json) as WebsiteAgentResult : null,
  attempt_failure: typedAttemptFailureOrNull(row.attempt_failure_json),
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
  if (!authorityRef.startsWith("production-task:")) return "missing";
  const jobId = authorityRef.slice("production-task:".length);
  if (!jobId) return "missing";
  const record = reader.readTask(jobId);
  return record ? verify(record) : "missing";
};

const productionSchemaSql = `create table production_tasks(
    job_id text primary key, request_hash text not null, task_json text not null,
    status text not null check(status in ('failed','completed')),
    result_json text, staged_result_json text, attempt_failure_json text,
    current_attempt_id text not null, current_reason text,
    created_at text not null, updated_at text not null,
    check((status='failed' and result_json is null and current_reason is not null)
      or (status='completed' and result_json is not null and staged_result_json is null and current_reason is null))
  );
  create table production_outbox(
    idempotency_key text primary key, kind text not null, path text not null,
    method text not null, headers_json text not null, body_blob blob not null,
    created_at text not null, sent_at text, last_error text,
    response_json text, response_hash text, receipt_hash text
  );
  create table production_attempt_handoffs(
    job_id text not null, source_attempt_id text not null,
    issued_attempt_id text, seal_hash text,
    source_manifest_json text, first_fact_raw text,
    sealed_at text, accepted_at text,
    readback_observations_json text not null,
    primary key(job_id,source_attempt_id)
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
  "production_steps", "production_outbox", "production_tasks", "production_attempt_handoffs",
] as const;

const tableShapes = {
  production_tasks: ["job_id:TEXT:0:1", "request_hash:TEXT:1:0", "task_json:TEXT:1:0",
    "status:TEXT:1:0", "result_json:TEXT:0:0", "staged_result_json:TEXT:0:0",
    "attempt_failure_json:TEXT:0:0", "current_attempt_id:TEXT:1:0", "current_reason:TEXT:0:0",
    "created_at:TEXT:1:0", "updated_at:TEXT:1:0"],
  production_outbox: ["idempotency_key:TEXT:0:1", "kind:TEXT:1:0", "path:TEXT:1:0", "method:TEXT:1:0",
    "headers_json:TEXT:1:0", "body_blob:BLOB:1:0", "created_at:TEXT:1:0", "sent_at:TEXT:0:0",
    "last_error:TEXT:0:0", "response_json:TEXT:0:0", "response_hash:TEXT:0:0", "receipt_hash:TEXT:0:0"],
  production_attempt_handoffs: ["job_id:TEXT:1:1", "source_attempt_id:TEXT:1:2",
    "issued_attempt_id:TEXT:0:0", "seal_hash:TEXT:0:0", "source_manifest_json:TEXT:0:0",
    "first_fact_raw:TEXT:0:0", "sealed_at:TEXT:0:0", "accepted_at:TEXT:0:0",
    "readback_observations_json:TEXT:1:0"],
} as const;

const expectedIndexes: Readonly<Record<keyof typeof tableShapes, readonly string[]>> = {
  production_tasks: ["1:pk:0:job_id"],
  production_outbox: ["1:pk:0:idempotency_key"],
  production_attempt_handoffs: ["1:pk:0:job_id,source_attempt_id"],
};

const expectedForeignKeys: Readonly<Record<keyof typeof tableShapes, readonly string[]>> = {
  production_tasks: [], production_outbox: [],
  production_attempt_handoffs: [],
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
  (select count(*) from production_tasks where not json_valid(task_json)
    or (result_json is not null and not json_valid(result_json))
    or (staged_result_json is not null and not json_valid(staged_result_json)))
  +(select count(*) from production_outbox where not json_valid(headers_json)
    or (kind!='artifact' and not json_valid(cast(body_blob as text)))
    or (response_json is not null and not json_valid(response_json)))
  +(select count(*) from production_attempt_handoffs where
    (source_manifest_json is not null and not json_valid(source_manifest_json))
    or not json_valid(readback_observations_json)
    or (first_fact_raw is not null and not json_valid(first_fact_raw))) as count`).get() as { count: number }).count);

export const stateInvariantFailureCount = (database: Database.Database): number => {
  const row = database.prepare(`select
    (select count(*) from production_tasks where job_id!=json_extract(task_json,'$.job_id')
      or request_hash!=json_extract(task_json,'$.request_hash') or current_attempt_id='')
    +(select count(*) from production_outbox where (response_json is null)!=(response_hash is null)
      or (response_hash is not null and sent_at is null)) as count`).get() as { count: number };
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
  if (invalidJsonCount(database) !== 0 || stateInvariantFailureCount(database) !== 0) {
    throw executionFailure("failed", "PRODUCTION_DATA_CORRUPT");
  }
};

type ProductionOutboxObserver = (authority: ProductionOutboxAuthority) => void;

export abstract class ProductionStoreFoundation {
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

}
