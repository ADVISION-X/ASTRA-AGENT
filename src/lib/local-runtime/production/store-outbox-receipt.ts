import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import type { ProductionOutboxWrite } from "./store-foundation.js";

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
