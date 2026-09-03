import {
  WebsiteAgentResultSchema,
  WebsiteAgentTaskSchema,
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentResult,
} from "./contracts.js";
import {
  isSerializedTerminalFailure,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
  type ProductionOutboxAuthority,
  type ProductionOutboxAuthorityRow,
  type ProductionOutboxWrite,
  type StoredProductionTask,
  type TaskRow,
} from "./store-foundation.js";

export const persistedHash = (value: unknown): value is ProductionHash =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
export const persistedDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const authorityCorrupt = (): never => { throw new SyntaxError("PRODUCTION_AUTHORITY_ROW_CORRUPT"); };

export type ProductionCheckpointAuthorityRow = Readonly<{
  job_id: string;
  task_attempt_id: string;
  attempt_id: string;
  checkpoint_id: string | null;
  checkpoint_hash: ProductionHash | null;
  state: ProductionCheckpointAuthority["state"];
  updated_at: string;
}>;
export type ProductionLeaseAuthorityRow = Readonly<{
  job_id: string;
  task_attempt_id: string;
  attempt_id: string;
  lease_version: number;
  fence_hash: ProductionHash;
  state: ProductionLeaseAuthority["state"];
  expires_at: string | null;
  updated_at: string;
}>;

export const productionCheckpointAuthorityFromRow = (
  row: ProductionCheckpointAuthorityRow,
  expectedJobId: string,
): ProductionCheckpointAuthority => {
  const shapeValid = row.state === "none"
    ? row.checkpoint_id === null && row.checkpoint_hash === null
    : row.state === "persisted"
      ? Boolean(row.checkpoint_id) && persistedHash(row.checkpoint_hash)
      : row.state === "failed" && Boolean(row.checkpoint_id) && row.checkpoint_hash === null;
  if (row.job_id !== expectedJobId || !row.attempt_id || row.attempt_id !== row.task_attempt_id
    || !["none", "persisted", "failed"].includes(row.state) || !shapeValid || !persistedDate(row.updated_at)) {
    return authorityCorrupt();
  }
  return Object.freeze({
    jobId: row.job_id, attemptId: row.attempt_id, checkpointId: row.checkpoint_id,
    checkpointHash: row.checkpoint_hash, state: row.state,
  });
};

export const productionLeaseAuthorityFromRow = (
  row: ProductionLeaseAuthorityRow,
  expectedJobId: string,
): ProductionLeaseAuthority => {
  if (row.job_id !== expectedJobId || !row.attempt_id || row.attempt_id !== row.task_attempt_id
    || !Number.isSafeInteger(row.lease_version) || row.lease_version < 1 || !persistedHash(row.fence_hash)
    || !["absent", "active", "stale", "lost"].includes(row.state) || !persistedDate(row.updated_at)
    || (row.state === "active" ? !persistedDate(row.expires_at) : row.expires_at !== null)) {
    return authorityCorrupt();
  }
  return Object.freeze({
    jobId: row.job_id, attemptId: row.attempt_id, leaseVersion: row.lease_version,
    fenceHash: row.fence_hash, state: row.state, expiresAt: row.expires_at,
  });
};

const durableIdentityValid = (record: StoredProductionTask): boolean => {
  const identity = record.identity;
  return JSON.stringify(Object.keys(identity).sort()) === JSON.stringify([
    "catalog_hash", "checkpoint_schema_version", "plugin_id", "plugin_version", "request_hash", "skill_hash",
  ]) && [identity.catalog_hash, identity.request_hash, identity.skill_hash].every(persistedHash)
    && typeof identity.plugin_id === "string" && identity.plugin_id.length > 0
    && Number.isSafeInteger(identity.plugin_version) && Number(identity.plugin_version) > 0
    && Number.isSafeInteger(identity.checkpoint_schema_version) && Number(identity.checkpoint_schema_version) > 0
    && identity.request_hash === record.task.request_hash;
};
const resultValid = (record: StoredProductionTask, result: WebsiteAgentResult | null): boolean => !result
  || (WebsiteAgentResultSchema.safeParse(result).success && result.job_id === record.task.job_id
    && result.source_task_id === record.task.source_task_id && result.product_id === record.task.product_id
    && result.action_id === record.task.action_id && result.plugin_id === record.identity.plugin_id
    && result.plugin_version === record.identity.plugin_version);
const taskStateValid = (record: StoredProductionTask): boolean => record.status === "completed"
  ? Boolean(record.result) && record.staged_result === null && record.current_reason === null
  : record.result === null && record.current_reason !== null;

export const productionTaskAuthorityValid = (record: StoredProductionTask): boolean =>
  WebsiteAgentTaskSchema.safeParse(record.task).success && durableIdentityValid(record)
  && resultValid(record, record.result) && resultValid(record, record.staged_result) && taskStateValid(record)
  && record.current_attempt_id.length > 0 && persistedDate(record.updated_at)
  && (record.attempt_failure === null || isSerializedTerminalFailure(record.attempt_failure));
export const productionTaskRowValid = (row: TaskRow, record: StoredProductionTask): boolean =>
  row.job_id === record.task.job_id && row.request_hash === record.task.request_hash
  && row.request_hash === record.identity.request_hash && productionTaskAuthorityValid(record);

const outboxIdentityValid = (row: ProductionOutboxAuthorityRow, expectedKey?: string): boolean =>
  Boolean(row.idempotency_key) && (expectedKey === undefined || row.idempotency_key === expectedKey)
  && ["checkpoint", "artifact", "terminal"].includes(row.kind) && ["POST", "PUT"].includes(row.method)
  && Buffer.isBuffer(row.body_blob) && persistedDate(row.created_at);
const outboxDeliveryValid = (row: ProductionOutboxAuthorityRow): boolean =>
  (row.sent_at === null || persistedDate(row.sent_at))
  && (row.next_delivery_at === null || persistedDate(row.next_delivery_at))
  && (row.response_hash === null || persistedHash(row.response_hash))
  && (row.receipt_hash === null || persistedHash(row.receipt_hash))
  && (row.sent_at === null) === (row.response_hash === null)
  && (row.response_json === null) === (row.response_hash === null);
const outboxPayloadValid = (row: ProductionOutboxAuthorityRow): boolean => {
  try {
    const headers = JSON.parse(row.headers_json) as unknown;
    if (!headers || typeof headers !== "object" || Array.isArray(headers)
      || !Object.values(headers as Record<string, unknown>).every((value) => typeof value === "string")) return false;
    if (row.kind !== "artifact") JSON.parse(row.body_blob.toString("utf8"));
    return row.response_json === null
      || hashCanonical(JSON.parse(row.response_json) as unknown) === row.response_hash;
  } catch { return false; }
};
const outboxJobId = (path: string): string => {
  const encoded = /\/jobs\/([^/]+)\//u.exec(path)?.[1];
  if (!encoded) return authorityCorrupt();
  try { return decodeURIComponent(encoded) || authorityCorrupt(); }
  catch { return authorityCorrupt(); }
};

export const productionOutboxAuthorityFromRow = (
  row: ProductionOutboxAuthorityRow,
  expectedKey?: string,
): ProductionOutboxAuthority => {
  const jobId = outboxJobId(row.path);
  if (!outboxIdentityValid(row, expectedKey) || !outboxDeliveryValid(row) || !outboxPayloadValid(row)) {
    return authorityCorrupt();
  }
  return Object.freeze({
    idempotencyKey: row.idempotency_key, jobId, kind: row.kind as ProductionOutboxWrite["kind"],
    state: row.sent_at ? "delivered" : "pending", nextDeliveryAt: row.next_delivery_at,
    lastError: row.last_error, responseHash: row.response_hash as ProductionHash | null,
    receiptHash: row.receipt_hash as ProductionHash | null,
  });
};
