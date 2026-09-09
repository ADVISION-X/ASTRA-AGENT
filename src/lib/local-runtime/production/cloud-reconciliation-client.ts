import {
  ControlIntentSchema,
  PriorResultRejectionSchema,
  UploadedResultReceiptSchema,
  parseJsonEnvelope,
  type ControlIntent,
} from "./transport-protocol.js";
import type { PriorResultRejection } from "../../../mediator/product-plugin-contract.js";
import {
  hashCanonical,
  parseTerminalReceipt,
  parseTerminalReceiptExpectation,
  type ProductionHash,
} from "./contracts.js";
import { ProductionWorkerSession } from "./worker-session.js";
import type { ProductionOutboxWrite } from "./store.js";
import { executionFailure } from "../../execution-failure.js";
import { productionCloudFetch } from "./cloud-transport.js";

type RemoteProductionWriteKind =
  | "checkpoint" | "artifact" | "terminal" | "cancel" | "handover" | "lease_release" | "renew";

const remoteProductionWriteKinds = new Set<RemoteProductionWriteKind>([
  "checkpoint", "artifact", "terminal", "cancel", "handover", "lease_release", "renew",
]);

export type RemoteProductionWriteReceipt = Readonly<{
  request_id: string;
  write_kind: RemoteProductionWriteKind;
  payload_hash: ProductionHash;
  response_json: Record<string, unknown>;
}>;

type BaseBusinessAdmissionReceipt = Readonly<{
  schema_version: "xuanxue-ai-business-admission-receipt.v6";
  job_id: string;
  result_payload_hash: ProductionHash;
  consumer_ref: string;
  outcome: "completed";
  consumption_hash: ProductionHash;
  consumed_at: string;
}>;

export type BusinessAdmissionReceipt =
  | BaseBusinessAdmissionReceipt
  | Readonly<BaseBusinessAdmissionReceipt & {
    bazi_domain_admission_receipt_hash: ProductionHash;
    delivery_manifest_id: string;
    delivery_manifest_hash: ProductionHash;
  }>
  | Readonly<BaseBusinessAdmissionReceipt & { review_receipt_hash: ProductionHash }>;

export type RemoteProductionDeviceJobStatus = Readonly<{
  job_id: string;
  status: string;
  current_reason: Readonly<Record<string, unknown>> | null;
  prior_result_rejection: PriorResultRejection | null;
  control_intent: ControlIntent;
  terminal_status: "completed" | null;
  terminal_payload_hash: ProductionHash | null;
  business_admission_receipt: BusinessAdmissionReceipt | null;
  business_consumer_error: string | null;
  accepted_attempt_count: number;
  write_receipts: readonly RemoteProductionWriteReceipt[];
}>;

const admissionBaseKeys = [
  "schema_version", "job_id", "result_payload_hash", "consumer_ref",
  "outcome", "consumption_hash", "consumed_at",
];
const admissionBaziKeys = [
  "bazi_domain_admission_receipt_hash", "delivery_manifest_id", "delivery_manifest_hash",
];
const admissionReviewKeys = ["review_receipt_hash"];
type BusinessAdmissionKind = "base" | "bazi" | "review";
const exactAdmissionKeys = (row: Record<string, unknown>, extra: readonly string[]): boolean =>
  JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...admissionBaseKeys, ...extra].sort());
const admissionKind = (row: Record<string, unknown>): BusinessAdmissionKind | null => {
  if (exactAdmissionKeys(row, [])) return "base";
  if (exactAdmissionKeys(row, admissionBaziKeys)) return "bazi";
  if (exactAdmissionKeys(row, admissionReviewKeys)) return "review";
  return null;
};
const productionHash = (value: unknown): value is ProductionHash =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const admissionBaseValid = (
  row: Record<string, unknown>,
  jobId: string,
  expectedHash: ProductionHash,
): boolean => row.schema_version === "xuanxue-ai-business-admission-receipt.v6"
  && row.job_id === jobId && productionHash(row.result_payload_hash)
  && typeof row.consumer_ref === "string" && row.consumer_ref.length > 0
  && row.outcome === "completed" && row.consumption_hash === expectedHash
  && typeof row.consumed_at === "string" && Number.isFinite(Date.parse(row.consumed_at));
const admissionExtensionValid = (
  row: Record<string, unknown>,
  kind: BusinessAdmissionKind,
): boolean => kind === "base"
  || (kind === "bazi" && productionHash(row.bazi_domain_admission_receipt_hash)
    && typeof row.delivery_manifest_id === "string" && row.delivery_manifest_id.length > 0
    && productionHash(row.delivery_manifest_hash))
  || (kind === "review" && productionHash(row.review_receipt_hash));
const admissionHash = (
  row: Record<string, unknown>,
  kind: BusinessAdmissionKind,
): ProductionHash => hashCanonical({
  job_id: row.job_id,
  result_payload_hash: row.result_payload_hash,
  ...(kind === "bazi" ? {
    bazi_domain_admission_receipt_hash: row.bazi_domain_admission_receipt_hash,
    delivery_manifest_id: row.delivery_manifest_id,
    delivery_manifest_hash: row.delivery_manifest_hash,
  } : {}),
  ...(kind === "review" ? { review_receipt_hash: row.review_receipt_hash } : {}),
  consumer_ref: row.consumer_ref,
  outcome: row.outcome,
});
const freezeAdmission = (
  row: Record<string, unknown>,
  kind: BusinessAdmissionKind,
): BusinessAdmissionReceipt => Object.freeze({
  schema_version: "xuanxue-ai-business-admission-receipt.v6",
  job_id: row.job_id as string,
  result_payload_hash: row.result_payload_hash as ProductionHash,
  ...(kind === "bazi" ? {
    bazi_domain_admission_receipt_hash: row.bazi_domain_admission_receipt_hash as ProductionHash,
    delivery_manifest_id: row.delivery_manifest_id as string,
    delivery_manifest_hash: row.delivery_manifest_hash as ProductionHash,
  } : {}),
  ...(kind === "review" ? { review_receipt_hash: row.review_receipt_hash as ProductionHash } : {}),
  consumer_ref: row.consumer_ref as string,
  outcome: "completed",
  consumption_hash: row.consumption_hash as ProductionHash,
  consumed_at: row.consumed_at as string,
}) as BusinessAdmissionReceipt;

const parseBusinessAdmissionReceipt = (
  jobId: string,
  value: unknown,
): RemoteProductionDeviceJobStatus["business_admission_receipt"] => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_RECEIPT_INVALID");
  }
  const row = value as Record<string, unknown>;
  const kind = admissionKind(row);
  if (!kind || !admissionBaseValid(row, jobId, admissionHash(row, kind))
    || !admissionExtensionValid(row, kind)) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_RECEIPT_INVALID");
  }
  return freezeAdmission(row, kind);
};

const parseRemoteWriteReceipt = (receipt: unknown): RemoteProductionWriteReceipt => {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const item = receipt as Record<string, unknown>;
  if (typeof item.request_id !== "string" || !item.request_id
    || typeof item.write_kind !== "string"
    || !remoteProductionWriteKinds.has(item.write_kind as RemoteProductionWriteKind)
    || typeof item.payload_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.payload_hash)
    || !item.response_json || typeof item.response_json !== "object" || Array.isArray(item.response_json)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  return Object.freeze({
    request_id: item.request_id,
    write_kind: item.write_kind as RemoteProductionWriteKind,
    payload_hash: item.payload_hash as ProductionHash,
    response_json: item.response_json as Record<string, unknown>,
  });
};

const deviceStatusIdentityValid = (row: Record<string, unknown>, jobId: string): boolean =>
  row.schema_version === "xuanxue-ai-device-job-status.v6"
  && row.job_id === jobId && ["failed", "completed"].includes(row.status as string);

const deviceStatusAuthorityFieldsValid = (row: Record<string, unknown>): boolean =>
  [null, "completed"].includes(row.terminal_status as null | string)
  && (row.terminal_payload_hash === null || typeof row.terminal_payload_hash === "string")
  && (row.current_reason === null || (typeof row.current_reason === "object"
    && !Array.isArray(row.current_reason)))
  && (row.prior_result_rejection === null || (typeof row.prior_result_rejection === "object"
    && !Array.isArray(row.prior_result_rejection)))
  && (row.business_consumer_error === null || typeof row.business_consumer_error === "string")
  && Array.isArray(row.write_receipts);

const deviceStatusAttemptAuthorityValid = (row: Record<string, unknown>): boolean =>
  Number.isSafeInteger(row.accepted_attempt_count) && Number(row.accepted_attempt_count) >= 0;

const parseDeviceTerminalAuthority = (row: Record<string, unknown>): Readonly<{
  terminalStatus: "completed" | null;
  terminalPayloadHash: ProductionHash | null;
}> => {
  const terminalStatus = row.terminal_status as "completed" | null;
  const terminalPayloadHash = row.terminal_payload_hash as ProductionHash | null;
  if (terminalPayloadHash !== null && !/^sha256:[a-f0-9]{64}$/u.test(terminalPayloadHash)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID");
  }
  if ((terminalStatus === "completed") !== (terminalPayloadHash !== null)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID");
  }
  return { terminalStatus, terminalPayloadHash };
};

const assertBusinessAdmissionAuthority = (
  row: Record<string, unknown>,
  admission: RemoteProductionDeviceJobStatus["business_admission_receipt"],
  terminalStatus: "completed" | null,
): void => {
  if ((row.status === "completed") !== (admission !== null)
    || (admission !== null && terminalStatus !== "completed")) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_AUTHORITY_INVALID");
  }
};

const parseDeviceControlAuthority = (
  row: Record<string, unknown>,
  jobId: string,
): Readonly<{
  controlIntent: ControlIntent;
  currentReason: Readonly<Record<string, unknown>> | null;
}> => {
  const parsed = ControlIntentSchema.safeParse(row.control_intent);
  if (!parsed.success) throw executionFailure("failed", "V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID");
  const controlIntent = parsed.data;
  const currentReason = row.current_reason as Readonly<Record<string, unknown>> | null;
  const deletionAuthorized = controlIntent.intent === "cancel_requested"
    && controlIntent.reason_code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";
  if (controlIntent.job_id !== jobId
    || deletionAuthorized !== (currentReason?.code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED")) {
    throw executionFailure("failed", "V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID");
  }
  return { controlIntent, currentReason };
};

export async function readProductionDeviceJobStatus(
  session: Pick<ProductionWorkerSession, "request">,
  jobId: string,
): Promise<RemoteProductionDeviceJobStatus> {
  const value = await session.request(
    `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/device-status`,
    { method: "GET" },
  );
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const row = value as Record<string, unknown>;
  if (!deviceStatusIdentityValid(row, jobId) || !deviceStatusAuthorityFieldsValid(row)
    || !deviceStatusAttemptAuthorityValid(row)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const { terminalStatus, terminalPayloadHash } = parseDeviceTerminalAuthority(row);
  const admission = parseBusinessAdmissionReceipt(jobId, row.business_admission_receipt);
  assertBusinessAdmissionAuthority(row, admission, terminalStatus);
  const { controlIntent, currentReason } = parseDeviceControlAuthority(row, jobId);
  const priorResultRejection = row.prior_result_rejection === null
    ? null
    : PriorResultRejectionSchema.parse(row.prior_result_rejection);
  if (priorResultRejection && priorResultRejection.job_id !== jobId) {
    throw executionFailure("failed", "V6_PRIOR_RESULT_REJECTION_JOB_MISMATCH");
  }
  return Object.freeze({
    job_id: jobId,
    status: row.status as string,
    current_reason: currentReason ? Object.freeze({ ...currentReason }) : null,
    prior_result_rejection: priorResultRejection,
    control_intent: controlIntent,
    terminal_status: terminalStatus,
    terminal_payload_hash: terminalPayloadHash,
    business_admission_receipt: admission,
    business_consumer_error: row.business_consumer_error as string | null,
    accepted_attempt_count: row.accepted_attempt_count as number,
    write_receipts: Object.freeze((row.write_receipts as unknown[]).map(parseRemoteWriteReceipt)),
  });
}

export const sendProductionOutboxWrite = async (
  session: ProductionWorkerSession,
  write: ProductionOutboxWrite,
): Promise<unknown> => {
  if (write.kind === "artifact") {
    const response = await productionCloudFetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${write.path}`, {
      method: write.method,
      headers: await session.authorizationHeaders(write.headers),
      body: Buffer.from(write.body),
      signal: AbortSignal.timeout(120_000),
    });
    return UploadedResultReceiptSchema.parse(parseJsonEnvelope(await response.json() as unknown, response.status));
  }
  const response = await session.request(write.path, {
    method: write.method,
    headers: write.headers,
    body: typeof write.body === "string" ? write.body : Buffer.from(write.body).toString("utf8"),
  });
  if (write.kind !== "terminal") return response;
  const body = typeof write.body === "string" ? write.body : Buffer.from(write.body).toString("utf8");
  return parseTerminalReceipt(response, parseTerminalReceiptExpectation(body));
};
