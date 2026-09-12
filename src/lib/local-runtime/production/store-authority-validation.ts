import {
  WebsiteAgentResultSchema,
  WebsiteAgentTaskSchema,
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentResult,
} from "./contracts.js";
import {
  isSerializedTerminalFailure,
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

const resultValid = (record: StoredProductionTask, result: WebsiteAgentResult | null): boolean => !result
  || (WebsiteAgentResultSchema.safeParse(result).success && result.job_id === record.task.job_id
    && result.source_task_id === record.task.source_task_id && result.product_id === record.task.product_id
    && result.action_id === record.task.action_id);
const taskStateValid = (record: StoredProductionTask): boolean => record.status === "completed"
  ? Boolean(record.result) && record.staged_result === null && record.current_reason === null
  : record.result === null && record.current_reason !== null;

export const productionTaskAuthorityValid = (record: StoredProductionTask): boolean =>
  WebsiteAgentTaskSchema.safeParse(record.task).success
  && resultValid(record, record.result) && resultValid(record, record.staged_result) && taskStateValid(record)
  && record.current_attempt_id.length > 0 && persistedDate(record.updated_at)
  && (record.attempt_failure === null || isSerializedTerminalFailure(record.attempt_failure));
export const productionTaskRowValid = (row: TaskRow, record: StoredProductionTask): boolean =>
  row.job_id === record.task.job_id && row.request_hash === record.task.request_hash
  && productionTaskAuthorityValid(record);

const outboxIdentityValid = (row: ProductionOutboxAuthorityRow, expectedKey?: string): boolean =>
  Boolean(row.idempotency_key) && (expectedKey === undefined || row.idempotency_key === expectedKey)
  && ["artifact", "terminal"].includes(row.kind) && ["POST", "PUT"].includes(row.method)
  && Buffer.isBuffer(row.body_blob) && persistedDate(row.created_at);
const outboxDeliveryValid = (row: ProductionOutboxAuthorityRow): boolean =>
  (row.sent_at === null || persistedDate(row.sent_at))
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
    state: row.sent_at ? "delivered" : "pending",
    lastError: row.last_error, responseHash: row.response_hash as ProductionHash | null,
    receiptHash: row.receipt_hash as ProductionHash | null,
  });
};
