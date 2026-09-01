import {
  ControlIntentSchema,
  UploadedResultReceiptSchema,
  parseJsonEnvelope,
  type ControlIntent,
} from "./transport-protocol.js";
import {
  hashCanonical,
  parseTerminalReceipt,
  parseTerminalReceiptExpectation,
  type ProductionHash,
} from "./contracts.js";
import { ProductionWorkerSession } from "./worker-session.js";
import type { ProductionOutboxWrite } from "./store.js";
import { executionFailure } from "../../typed-failure.js";
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

export type RemoteProductionDeviceJobStatus = Readonly<{
  job_id: string;
  status: string;
  current_reason: Readonly<Record<string, unknown>> | null;
  control_intent: ControlIntent;
  terminal_status: "completed" | null;
  terminal_payload_hash: ProductionHash | null;
  business_admission_receipt: Readonly<{
    schema_version: "xuanxue-ai-business-admission-receipt.v6";
    job_id: string;
    result_payload_hash: ProductionHash;
    consumer_ref: string;
    outcome: "completed";
    consumption_hash: ProductionHash;
    consumed_at: string;
  }> | null;
  business_consumer_error: string | null;
  accepted_attempt_count: number;
  write_receipts: readonly RemoteProductionWriteReceipt[];
}>;

const parseBusinessAdmissionReceipt = (
  jobId: string,
  value: unknown,
): RemoteProductionDeviceJobStatus["business_admission_receipt"] => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_RECEIPT_INVALID");
  }
  const row = value as Record<string, unknown>;
  const expectedHash = hashCanonical({
    job_id: row.job_id,
    result_payload_hash: row.result_payload_hash,
    consumer_ref: row.consumer_ref,
    outcome: row.outcome,
  });
  if (row.schema_version !== "xuanxue-ai-business-admission-receipt.v6"
    || row.job_id !== jobId
    || typeof row.result_payload_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.result_payload_hash)
    || typeof row.consumer_ref !== "string" || !row.consumer_ref
    || row.outcome !== "completed"
    || typeof row.consumption_hash !== "string" || row.consumption_hash !== expectedHash
    || typeof row.consumed_at !== "string" || !Number.isFinite(Date.parse(row.consumed_at))) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_RECEIPT_INVALID");
  }
  return Object.freeze({
    schema_version: row.schema_version,
    job_id: jobId,
    result_payload_hash: row.result_payload_hash as ProductionHash,
    consumer_ref: row.consumer_ref,
    outcome: "completed",
    consumption_hash: row.consumption_hash as ProductionHash,
    consumed_at: row.consumed_at,
  });
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
  return Object.freeze({
    job_id: jobId,
    status: row.status as string,
    current_reason: currentReason ? Object.freeze({ ...currentReason }) : null,
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
