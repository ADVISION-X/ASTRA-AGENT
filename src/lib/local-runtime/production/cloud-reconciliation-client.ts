import {
  UploadedResultReceiptSchema,
  parseJsonEnvelope,
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

export type RemoteProductionWriteReceipt = Readonly<{
  request_id: string;
  write_kind: string;
  payload_hash: ProductionHash;
  response_json: Record<string, unknown>;
}>;

export type RemoteProductionDeviceJobStatus = Readonly<{
  job_id: string;
  status: string;
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
    || typeof item.write_kind !== "string" || !item.write_kind
    || typeof item.payload_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.payload_hash)
    || !item.response_json || typeof item.response_json !== "object" || Array.isArray(item.response_json)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  return Object.freeze({
    request_id: item.request_id,
    write_kind: item.write_kind,
    payload_hash: item.payload_hash as ProductionHash,
    response_json: item.response_json as Record<string, unknown>,
  });
};

export async function readProductionDeviceJobStatus(
  session: ProductionWorkerSession,
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
  if (row.job_id !== jobId || typeof row.status !== "string"
    || ![null, "completed"].includes(row.terminal_status as null | string)
    || !(row.terminal_payload_hash === null || typeof row.terminal_payload_hash === "string")
    || !(row.business_consumer_error === null || typeof row.business_consumer_error === "string")
    || !Array.isArray(row.write_receipts)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const terminalStatus = row.terminal_status as "completed" | null;
  const terminalPayloadHash = row.terminal_payload_hash as ProductionHash | null;
  if (terminalPayloadHash !== null && !/^sha256:[a-f0-9]{64}$/u.test(terminalPayloadHash)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID");
  }
  const admission = parseBusinessAdmissionReceipt(jobId, row.business_admission_receipt);
  if ((admission !== null) !== (terminalStatus === "completed")
    || (admission !== null && terminalPayloadHash === null)) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_AUTHORITY_INVALID");
  }
  return Object.freeze({
    job_id: jobId,
    status: row.status,
    terminal_status: terminalStatus,
    terminal_payload_hash: terminalPayloadHash,
    business_admission_receipt: admission,
    business_consumer_error: row.business_consumer_error as string | null,
    write_receipts: Object.freeze(row.write_receipts.map(parseRemoteWriteReceipt)),
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
