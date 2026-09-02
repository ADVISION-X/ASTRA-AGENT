import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import { isSerializedTerminalFailure, type ProductionOutboxWrite } from "./store-foundation.js";

export type RemoteReceipt = Readonly<{
  request_id: string;
  write_kind: string;
  payload_hash: ProductionHash;
  response_json: Record<string, unknown>;
}>;

export type LocalReceiptIntent = Readonly<{
  kind: ProductionOutboxWrite["kind"];
  path: string;
  headers_json: string;
  body_blob: Buffer;
  response_json: string | null;
  response_hash: ProductionHash | null;
}>;

export type RecoveryOutboxRow = LocalReceiptIntent & Readonly<{
  idempotency_key: string;
  sent_at: string | null;
  last_error: string | null;
  next_delivery_at: string | null;
}>;

export type RecoveryCheckpointPrefix = Readonly<{
  checkpointSeq: number;
  checkpointHash: ProductionHash;
}>;

type RecoveryCheckpointProof = RecoveryCheckpointPrefix & Readonly<{ rejectedIncident: boolean }>;

const payloadHashOf = (local: LocalReceiptIntent): ProductionHash => {
  const headers = JSON.parse(local.headers_json) as Record<string, string>;
  return local.kind === "artifact" ? headers["x-ai-content-sha256"] as ProductionHash
    : hashCanonical(JSON.parse(local.body_blob.toString("utf8")) as unknown);
};

export const assertReceiptIdentity = (
  jobId: string,
  local: LocalReceiptIntent,
  receipt: RemoteReceipt,
): void => {
  const pathJobId = /\/jobs\/([^/]+)\//u.exec(local.path)?.[1];
  if (!pathJobId || decodeURIComponent(pathJobId) !== jobId || local.kind !== receipt.write_kind) {
    throw executionFailure("failed", "PRODUCTION_REMOTE_RECEIPT_IDENTITY_MISMATCH");
  }
  if (payloadHashOf(local) !== receipt.payload_hash) {
    throw executionFailure("failed", "PRODUCTION_REMOTE_RECEIPT_PAYLOAD_MISMATCH");
  }
};

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const checkpointEnvelopeValid = (body: Record<string, unknown>, row: RecoveryOutboxRow): boolean =>
  exactKeys(body, [
    "schema_version", "control_protocol_version", "request_id", "idempotency_key", "job_id",
    "worker_session_id", "worker_session_epoch", "attempt_id", "lease_version", "fence_hash",
    "local_order_id", "checkpoint_seq", "checkpoint_kind", "payload_hash", "object_receipts",
    "attempt_failure",
  ]) && body.schema_version === "xuanxue-ai-checkpoint.v6"
  && body.control_protocol_version === "xuanxue-ai-production-v6"
  && body.request_id === row.idempotency_key && body.idempotency_key === row.idempotency_key;

const checkpointIdentityValid = (
  body: Record<string, unknown>,
  jobId: string,
  attemptId: string,
): boolean => body.job_id === jobId && typeof body.attempt_id === "string" && body.attempt_id.length > 0
  && body.attempt_id === attemptId && body.local_order_id === jobId;

const checkpointFenceValid = (body: Record<string, unknown>): boolean =>
  typeof body.worker_session_id === "string" && body.worker_session_id.length > 0
  && Number.isInteger(body.worker_session_epoch) && Number(body.worker_session_epoch) >= 1
  && Number.isInteger(body.lease_version) && Number(body.lease_version) >= 1
  && typeof body.fence_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(body.fence_hash);

const checkpointPayloadValid = (
  body: Record<string, unknown>,
  jobId: string,
  attemptId: string,
): boolean => Number.isInteger(body.checkpoint_seq) && Number(body.checkpoint_seq) >= 1
  && ["accepted", "progress", "attempt_failure", "handover_acknowledgement"]
    .includes(String(body.checkpoint_kind))
  && body.payload_hash === hashCanonical({
    job_id: jobId,
    attempt_id: attemptId,
    checkpoint_seq: body.checkpoint_seq,
    checkpoint_kind: body.checkpoint_kind,
  })
  && Array.isArray(body.object_receipts);

const checkpointBody = (
  jobId: string,
  attemptId: string,
  row: RecoveryOutboxRow,
): Record<string, unknown> => {
  const body = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
  if (!checkpointEnvelopeValid(body, row) || !checkpointIdentityValid(body, jobId, attemptId)
    || !checkpointFenceValid(body) || !checkpointPayloadValid(body, jobId, attemptId)) {
    throw executionFailure("failed", "PRODUCTION_RECOVERY_CHECKPOINT_INTENT_INVALID");
  }
  return body;
};

const receiptAttemptCountValid = (input: Readonly<{
  acceptedAttemptCount: number;
  currentAttempt: boolean;
  responseAttemptCount: number;
}>): boolean => Number.isInteger(input.responseAttemptCount) && input.responseAttemptCount >= 1
  && (input.currentAttempt
    ? input.responseAttemptCount === input.acceptedAttemptCount
    : input.responseAttemptCount <= input.acceptedAttemptCount);

const remoteReceiptMatchesIntent = (input: Readonly<{
  row: RecoveryOutboxRow;
  body: Record<string, unknown>;
  receipt: RemoteReceipt;
}>): boolean => input.receipt.request_id === input.row.idempotency_key
  && input.receipt.write_kind === "checkpoint"
  && input.receipt.payload_hash === hashCanonical(input.body);

const responseMatchesCheckpoint = (input: Readonly<{
  jobId: string;
  body: Record<string, unknown>;
  receipt: RemoteReceipt;
}>): boolean => {
  const response = input.receipt.response_json;
  const responseAttempt = response.attempt_id;
  return response.job_id === input.jobId
    && (responseAttempt === undefined || responseAttempt === input.body.attempt_id)
    && response.checkpoint_seq === input.body.checkpoint_seq
    && response.checkpoint_hash === input.receipt.payload_hash
    && response.status === "failed" && typeof response.accepted_at === "string"
    && Number.isFinite(Date.parse(response.accepted_at));
};

const localDeliveryMatchesResponse = (row: RecoveryOutboxRow, response: Record<string, unknown>): boolean => {
  if (!row.sent_at || !row.response_hash || !row.response_json
    || row.last_error !== null || row.next_delivery_at !== null) return false;
  try {
    const localResponse = JSON.parse(row.response_json) as unknown;
    return hashCanonical(localResponse) === row.response_hash
      && row.response_hash === hashCanonical(response);
  } catch {
    return false;
  }
};

const assertCheckpointReceipt = (input: Readonly<{
  jobId: string;
  acceptedAttemptCount: number;
  currentAttempt: boolean;
  row: RecoveryOutboxRow;
  body: Record<string, unknown>;
  receipt: RemoteReceipt;
}>): void => {
  assertReceiptIdentity(input.jobId, input.row, input.receipt);
  const response = input.receipt.response_json;
  if (!remoteReceiptMatchesIntent(input) || !responseMatchesCheckpoint(input)
    || !receiptAttemptCountValid({
      acceptedAttemptCount: input.acceptedAttemptCount,
      currentAttempt: input.currentAttempt,
      responseAttemptCount: Number(response.accepted_attempt_count),
    })
    || !localDeliveryMatchesResponse(input.row, response)) {
    throw executionFailure("failed", "PRODUCTION_RECOVERY_CHECKPOINT_RECEIPT_INVALID");
  }
};

type RecoveryCheckpointEvidence = Readonly<{
  row: RecoveryOutboxRow;
  body: Record<string, unknown>;
  receipt: RemoteReceipt;
}>;

const validateRecoveryReceipts = (input: Readonly<{
  jobId: string;
  attemptId: string;
  acceptedAttemptCount: number;
  rows: readonly RecoveryOutboxRow[];
  receipts: readonly RemoteReceipt[];
}>): ReadonlyMap<string, RemoteReceipt> => {
  const localByRequest = new Map(input.rows.map((row) => [row.idempotency_key, row]));
  const remoteByRequest = new Map<string, RemoteReceipt>();
  for (const receipt of input.receipts) {
    if (receipt.write_kind === "renew" || receipt.write_kind === "lease_release") continue;
    if (receipt.write_kind !== "checkpoint") {
      throw executionFailure("failed", "PRODUCTION_RECOVERY_RESULT_WRITE_PRESENT");
    }
    if (remoteByRequest.has(receipt.request_id)) {
      throw executionFailure("failed", "PRODUCTION_RECOVERY_RECEIPT_AMBIGUOUS");
    }
    const local = localByRequest.get(receipt.request_id);
    if (!local) throw executionFailure("failed", "PRODUCTION_RECOVERY_REMOTE_INTENT_MISSING");
    const raw = JSON.parse(local.body_blob.toString("utf8")) as Record<string, unknown>;
    const body = checkpointBody(input.jobId, String(raw.attempt_id), local);
    assertCheckpointReceipt({
      jobId: input.jobId, acceptedAttemptCount: input.acceptedAttemptCount,
      currentAttempt: body.attempt_id === input.attemptId, row: local, body, receipt,
    });
    remoteByRequest.set(receipt.request_id, receipt);
  }
  return remoteByRequest;
};

export const isDeterministicallyRejectedSequenceRow = (row: Readonly<{
  sent_at: string | null;
  response_hash: ProductionHash | null;
  response_json: string | null;
  last_error: string | null;
  next_delivery_at: string | null;
}>): boolean => row.sent_at === null
  && row.response_hash === null && row.response_json === null
  && row.last_error === "AI_V6_CHECKPOINT_SEQUENCE_INVALID"
  && row.next_delivery_at !== null && Number.isFinite(Date.parse(row.next_delivery_at));

export const isRejectedCheckpointSequenceFailure = (
  value: unknown,
): value is SerializedExecutionFailure =>
  isSerializedTerminalFailure(value) && value.code === "AI_V6_CHECKPOINT_SEQUENCE_INVALID"
  && value.mutation_outcome === "no" && value.evidence_ref === null && value.evidence_hash === null
  && value.effect_scope === null && value.child_capability_id === null && value.browser_outcome === null
  && value.cause?.name === "Error" && value.cause.code === null;

const allowedRejectedIncidentRow = (row: RecoveryOutboxRow, body: Record<string, unknown>): boolean => {
  if (!isDeterministicallyRejectedSequenceRow(row)
    || (body.object_receipts as unknown[]).length !== 0) return false;
  if (body.checkpoint_seq === 1 && body.checkpoint_kind === "accepted") {
    return body.attempt_failure === null;
  }
  return body.checkpoint_seq === 2 && body.checkpoint_kind === "attempt_failure"
    && isRejectedCheckpointSequenceFailure(body.attempt_failure);
};

const deliveredPrefixValid = (input: Readonly<{
  delivered: readonly RecoveryCheckpointEvidence[];
  rejectedAccepted: number;
  rejectedFailure: number;
}>): boolean => {
  const rejectedIncident = input.rejectedAccepted > 0 || input.rejectedFailure > 0;
  const minimumLength = rejectedIncident ? 2 : 1;
  return (rejectedIncident
      ? input.rejectedAccepted >= 1 && input.rejectedFailure >= 1
      : input.rejectedAccepted === 0 && input.rejectedFailure === 0)
    && input.delivered.length >= minimumLength
    && input.delivered.every(({ body }, index) => body.checkpoint_seq === index + 1
      && body.checkpoint_kind === (index === 0 ? "accepted" : "progress")
      && body.attempt_failure === null
      && (body.object_receipts as unknown[]).length === 0);
};

const currentRecoveryPrefix = (input: Readonly<{
  jobId: string;
  attemptId: string;
  acceptedAttemptCount: number;
  rows: readonly RecoveryOutboxRow[];
  remoteByRequest: ReadonlyMap<string, RemoteReceipt>;
}>): Readonly<{
  delivered: readonly RecoveryCheckpointEvidence[];
  rejectedCount: number;
}> => {
  const delivered: RecoveryCheckpointEvidence[] = [];
  let rejectedCount = 0;
  let rejectedAccepted = 0;
  let rejectedFailure = 0;
  for (const row of input.rows) {
    const raw = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
    if (raw.attempt_id !== input.attemptId) continue;
    const body = checkpointBody(input.jobId, input.attemptId, row);
    if (!row.sent_at && !row.response_hash) {
      if (!allowedRejectedIncidentRow(row, body)) {
        throw executionFailure("failed", "PRODUCTION_RECOVERY_LOCAL_PREFIX_INVALID");
      }
      if (body.checkpoint_kind === "accepted") rejectedAccepted += 1;
      else rejectedFailure += 1;
      rejectedCount += 1;
      continue;
    }
    const receipt = input.remoteByRequest.get(row.idempotency_key);
    if (!receipt) throw executionFailure("failed", "PRODUCTION_RECOVERY_REMOTE_RECEIPT_MISSING");
    assertCheckpointReceipt({
      jobId: input.jobId, acceptedAttemptCount: input.acceptedAttemptCount,
      currentAttempt: true, row, body, receipt,
    });
    delivered.push({ row, body, receipt });
  }
  delivered.sort((left, right) => Number(left.body.checkpoint_seq) - Number(right.body.checkpoint_seq));
  if (!deliveredPrefixValid({
    delivered, rejectedAccepted, rejectedFailure,
  })) {
    throw executionFailure("failed", "PRODUCTION_RECOVERY_CHECKPOINT_PREFIX_INVALID");
  }
  return Object.freeze({ delivered: Object.freeze(delivered), rejectedCount });
};

export const proveRecoveryCheckpointPrefix = (input: Readonly<{
  jobId: string;
  attemptId: string;
  acceptedAttemptCount: number;
  rows: readonly RecoveryOutboxRow[];
  receipts: readonly RemoteReceipt[];
}>): RecoveryCheckpointProof => {
  const remoteByRequest = validateRecoveryReceipts(input);
  const current = currentRecoveryPrefix({ ...input, remoteByRequest });
  const cursor = current.delivered.at(-1)!;
  return Object.freeze({
    checkpointSeq: Number(cursor.body.checkpoint_seq),
    checkpointHash: cursor.receipt.payload_hash,
    rejectedIncident: current.rejectedCount > 0,
  });
};
