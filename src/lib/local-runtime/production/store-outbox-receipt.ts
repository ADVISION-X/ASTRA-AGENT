import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, sha256, type ProductionHash, type WebsiteAgentResult } from "./contracts.js";
import { json, type ProductionOutboxWrite } from "./store-foundation.js";

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

export type StagedArtifactRow = Readonly<{
  path: string; body_blob: Buffer; response_json: string; receipt_hash: string;
}>;

export const sameTerminalSourceFirstFact = (firstRaw: string | null, sourceFact: unknown): boolean =>
  firstRaw === null ? sourceFact === null : Boolean(sourceFact
    && typeof sourceFact === "object" && !Array.isArray(sourceFact)
    && (sourceFact as Record<string, unknown>).raw_json === firstRaw
    && (sourceFact as Record<string, unknown>).hash === sha256(Buffer.from(firstRaw, "utf8")));

export const validPriorResultPayloadReceipt = (input: Readonly<{
  response: Readonly<Record<string, unknown>>;
  receiptHash: string;
  payloadHash: ProductionHash;
  artifactPath: string;
  payloadLength: number;
}>): boolean => input.response.role === "result_payload"
  && input.response.sha256 === input.payloadHash
  && input.response.receipt_hash === input.receiptHash
  && input.response.artifact_id === decodeURIComponent(input.artifactPath.split("/").at(-1) ?? "")
  && typeof input.response.object_ref === "string"
  && input.response.media_type === "application/json"
  && input.response.byte_length === input.payloadLength;

const stagedArtifactRole = (
  row: StagedArtifactRow, attemptId: string, result: WebsiteAgentResult,
): string | null => {
  let response: Record<string, unknown>;
  try { response = JSON.parse(row.response_json) as Record<string, unknown>; }
  catch { return null; }
  const role = response.role;
  const artifactId = response.artifact_id;
  const roleAttemptHash = role === "generated_image"
    ? hashCanonical({ attempt_id: attemptId, role }).slice(7, 23)
    : hashCanonical({ attempt_id: attemptId }).slice(7, 23);
  if (typeof role !== "string" || typeof artifactId !== "string"
    || !["result_payload", "result_envelope", "generated_image"].includes(role)
    || !artifactId.includes(roleAttemptHash)
    || !row.path.includes(`/artifacts/${role}/${encodeURIComponent(artifactId)}`)
    || response.receipt_hash !== row.receipt_hash) return null;
  if (role === "result_payload") return row.receipt_hash === result.result_object_receipt.receipt_hash
    && response.sha256 === result.result_payload_hash ? role : null;
  if (role === "result_envelope") {
    try { return json(JSON.parse(row.body_blob.toString("utf8"))) === json(result) ? role : null; }
    catch { return null; }
  }
  return role;
};

export const matchingLocalStagedArtifacts = (input: Readonly<{
  receipts: readonly unknown[]; selected: readonly StagedArtifactRow[];
  attemptId: string; result: WebsiteAgentResult;
}>): boolean => {
  if (input.selected.length !== input.receipts.length) return false;
  const roles: string[] = [];
  for (const row of input.selected) {
    const role = stagedArtifactRole(row, input.attemptId, input.result);
    if (role === null) return false;
    roles.push(role);
  }
  return roles.filter((role) => role === "result_payload").length === 1
    && roles.filter((role) => role === "result_envelope").length === 1;
};

export const matchingRemoteStagedArtifacts = (input: Readonly<{
  receipts: readonly unknown[];
  remoteReceipts: readonly Readonly<{ role: string; receipt_hash: ProductionHash }>[] | undefined;
  result: WebsiteAgentResult;
}>): boolean => {
  const remote = input.remoteReceipts;
  return remote !== undefined && remote.length === input.receipts.length
    && remote.every((item) => input.receipts.includes(item.receipt_hash))
    && remote.filter((item) => item.role === "result_payload").length === 1
    && remote.filter((item) => item.role === "result_envelope").length === 1
    && remote.find((item) => item.role === "result_payload")?.receipt_hash
      === input.result.result_object_receipt.receipt_hash;
};

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
