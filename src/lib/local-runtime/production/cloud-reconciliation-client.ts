import {
  UploadedResultReceiptSchema,
  parseJsonEnvelope,
} from "./transport-protocol.js";
import {
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
): Promise<Readonly<{
  job_id: string;
  status: string;
  terminal_status: "completed" | "failed" | null;
  write_receipts: readonly RemoteProductionWriteReceipt[];
}>> {
  const value = await session.request(
    `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/device-status`,
    { method: "GET" },
  );
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const row = value as Record<string, unknown>;
  if (row.job_id !== jobId || typeof row.status !== "string"
    || ![null, "completed", "failed"].includes(row.terminal_status as null | string)
    || !Array.isArray(row.write_receipts)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  return Object.freeze({
    job_id: jobId,
    status: row.status,
    terminal_status: row.terminal_status as "completed" | "failed" | null,
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
