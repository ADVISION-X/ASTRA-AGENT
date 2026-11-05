import { randomUUID } from "node:crypto";
import { lstatSync } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  ClaimedProductionTaskSchema,
  ClaimBatchReceiptSchema,
  LeaseRenewReceiptSchema,
  UploadedResultReceiptSchema,
  parseJsonEnvelope,
  type ClaimedProductionTask,
  type UploadedResultReceipt,
} from "./transport-protocol.js";
import {
  RESULT_CONTRACT_ID,
  RESULT_CONTRACT_VERSION,
  WebsiteAgentResultSchema,
  hashCanonical,
  sha256,
  type LocalProductionMaterial,
  type ProductionHash,
  type WebsiteAgentResult,
} from "./contracts.js";
import { PRODUCTION_BUSINESS_CAPACITY_MAX } from "./control-contract-dependency.js";
import { ProductionWorkerSession } from "./worker-session.js";
import { ProductionRuntimeStore } from "./store.js";
import { assertProductionFileLinks } from "./runtime-storage-inventory.js";
import type { CompleteProductionOutput } from "./store-complete-output.js";
import { executionFailure } from "../../execution-failure.js";
import { productionCloudFetch } from "./cloud-transport.js";
import type { ProductionLeaseRelease } from "./lease-release-contract.js";
import type { AttemptFailureReleaseDescriptor } from "./terminal-failure.js";
import {
  runtimeTransportFailure,
  typedRuntimeTransportFailure,
} from "./transport-failure.js";

export type { ProductionLeaseRelease } from "./lease-release-contract.js";

const fenceHeaders = (job: ClaimedProductionTask): Record<string, string> => ({
  "x-ai-execution-fence-hash": job.grant.execution_fence.fence_hash,
});

const throwMaterialDownloadFailure = async (response: Response): Promise<never> => {
  try {
    const envelope = await response.json() as unknown;
    parseJsonEnvelope(envelope, response.status);
  } catch (error) {
    const remoteFailure = typedRuntimeTransportFailure(error);
    if (remoteFailure) throw remoteFailure;
    throw runtimeTransportFailure("MATERIAL_DOWNLOAD_RESPONSE_INVALID", response.status, error);
  }
  throw runtimeTransportFailure("MATERIAL_DOWNLOAD_RESPONSE_INVALID", response.status);
};

export async function claimProductionTasks(
  session: ProductionWorkerSession,
  limit: number,
  requestId = `aipclaim_${randomUUID()}`,
  forceCurrentAttestation = false,
  sourceEvidence: Parameters<ProductionWorkerSession["requestClaim"]>[3] = [],
  deliveryCandidates: Parameters<ProductionWorkerSession["requestClaim"]>[4] = [],
): Promise<Readonly<{
  outcome: "LEASE_GRANTED" | "NO_ELIGIBLE_JOB" | "CAPACITY_ZERO" | "CLAIM_BLOCKED" | "DRAINING";
  jobs: readonly ClaimedProductionTask[];
  server_now: string;
  next_claim_after_ms: number;
  reason_codes: readonly string[];
}>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > PRODUCTION_BUSINESS_CAPACITY_MAX) {
    throw new Error("V6_CLAIM_LIMIT_INVALID");
  }
  const receipt = ClaimBatchReceiptSchema.parse(
    await session.requestClaim(requestId, limit, forceCurrentAttestation,
      sourceEvidence, deliveryCandidates),
  );
  if (receipt.request_id !== requestId) throw executionFailure("failed", "V6_CLAIM_RECEIPT_MISMATCH");
  const jobs = receipt.jobs.map((raw) => ClaimedProductionTaskSchema.parse(raw));
  const uniqueJobIds = new Set(jobs.map((job) => job.job_id));
  if ((receipt.outcome === "LEASE_GRANTED") !== (jobs.length > 0)
    || jobs.length > PRODUCTION_BUSINESS_CAPACITY_MAX
    || uniqueJobIds.size !== jobs.length
    || jobs.some((job) => job.grant.worker_session_id !== session.workerSessionId
      || job.grant.worker_session_epoch !== session.workerSessionEpoch
      || job.grant.control_contract_version !== session.controlContractVersion)) {
    throw executionFailure("failed", "V6_CLAIM_BATCH_INVALID");
  }
  return {
    outcome: receipt.outcome,
    jobs: Object.freeze(jobs),
    server_now: receipt.server_now,
    next_claim_after_ms: receipt.next_claim_after_ms,
    reason_codes: Object.freeze(receipt.reason_codes),
  };
}

const writeProductionMaterial = async (destination: string, bytes: Uint8Array): Promise<void> => {
  try {
    const metadata = await lstat(destination);
    if (!metadata.isFile()) throw executionFailure("failed", "MATERIAL_LOCAL_IDENTITY_CONFLICT");
    assertProductionFileLinks(destination, metadata);
    const existing = await readFile(destination);
    if (existing.byteLength !== bytes.byteLength
      || sha256(existing) !== sha256(bytes)) {
      throw executionFailure("failed", "MATERIAL_LOCAL_IDENTITY_CONFLICT");
    }
    return;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  const temporary = `${destination}.${process.pid}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

export async function downloadProductionMaterials(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
  materialDir: string,
  signal: AbortSignal,
): Promise<readonly LocalProductionMaterial[]> {
  signal.throwIfAborted();
  const metadata = lstatSync(materialDir, { throwIfNoEntry: false });
  if (metadata && !metadata.isDirectory()) throw executionFailure("failed", "PRODUCTION_STORAGE_STRUCTURE_INVALID");
  await mkdir(materialDir, { recursive: true, mode: 0o700 });
  const verified: LocalProductionMaterial[] = [];
  const ordered = [...job.material_refs].sort((a, b) => a.ordinal - b.ordinal);
  for (const reference of ordered) {
    if (reference.role === "research_input") continue;
    signal.throwIfAborted();
    const headers = await session.authorizationHeaders(fenceHeaders(job));
    signal.throwIfAborted();
    const response = await productionCloudFetch(
      `${session.device.server_base_url.replace(/\/+$/u, "")}/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/materials/${encodeURIComponent(reference.material_id)}`,
      { headers, signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]) },
    );
    if (!response.ok) await throwMaterialDownloadFailure(response);
    const bytes = new Uint8Array(await response.arrayBuffer());
    signal.throwIfAborted();
    if (bytes.byteLength !== reference.bytes || sha256(bytes) !== reference.sha256) {
      throw executionFailure("failed", `MATERIAL_DOWNLOAD_IDENTITY_MISMATCH:${reference.material_id}`);
    }
    const localPath = path.join(materialDir, reference.display_name);
    await writeProductionMaterial(localPath, bytes);
    signal.throwIfAborted();
    verified.push({ ...reference, local_path: localPath });
  }
  signal.throwIfAborted();
  return Object.freeze(verified);
}

export async function renewProductionLease(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
  requestId = `aiprenew_${randomUUID()}`,
  signal?: AbortSignal,
) {
  const data = await session.request(
    `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/renew`,
    {
      method: "POST",
      headers: fenceHeaders(job),
      ...(signal ? { signal } : {}),
      body: JSON.stringify({
        schema_version: "xuanxue-ai-lease-renew.v6",
        control_protocol_version: "xuanxue-ai-production-v6",
        request_id: requestId,
        idempotency_key: requestId,
        job_id: job.job_id,
        worker_session_id: session.workerSessionId,
        worker_session_epoch: session.workerSessionEpoch,
        attempt_id: job.grant.attempt_id,
        lease_version: job.grant.lease_version,
        fence_hash: job.grant.execution_fence.fence_hash,
      }),
    },
  );
  try {
    const receipt = LeaseRenewReceiptSchema.parse(data);
    if (receipt.job_id !== job.job_id || receipt.control_intent.job_id !== job.job_id) {
      throw executionFailure("failed", "V6_RENEW_CONTROL_AUTHORITY_INVALID");
    }
    return receipt;
  } catch (error) {
    throw runtimeTransportFailure("AI_PRODUCTION_HTTP_ENVELOPE_INVALID", 200, error);
  }
}

export type ProductionLeaseReleaseRequest = Readonly<{
  schema_version: "xuanxue-ai-lease-release.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: ProductionHash;
  payload_hash: ProductionHash;
  reason_code: ProductionLeaseRelease["reasonCode"];
  attempt_failure: ProductionLeaseRelease["attemptFailure"];
}>;

export type BuiltProductionLeaseRelease = Readonly<{
  request: ProductionLeaseReleaseRequest;
  descriptor: AttemptFailureReleaseDescriptor;
}>;

export function buildProductionLeaseRelease(
  session: Pick<ProductionWorkerSession, "workerSessionId" | "workerSessionEpoch">,
  job: ClaimedProductionTask,
  release: ProductionLeaseRelease,
): BuiltProductionLeaseRelease {
  const payload = {
    reason_code: release.reasonCode,
    attempt_failure: release.attemptFailure,
    job_id: job.job_id,
    fence_hash: job.grant.execution_fence.fence_hash,
  };
  const payloadHash = hashCanonical(payload);
  const requestId = `aiprelease_${hashCanonical({
    job_id: job.job_id,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    payload_hash: payloadHash,
  }).slice(7, 47)}`;
  const request: ProductionLeaseReleaseRequest = Object.freeze({
    schema_version: "xuanxue-ai-lease-release.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId,
    job_id: job.job_id,
    worker_session_id: session.workerSessionId,
    worker_session_epoch: session.workerSessionEpoch,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    fence_hash: job.grant.execution_fence.fence_hash,
    payload_hash: payloadHash,
    reason_code: release.reasonCode,
    attempt_failure: release.attemptFailure,
  });
  return Object.freeze({
    request,
    descriptor: Object.freeze({
      attempt_id: request.attempt_id,
      lease_version: request.lease_version,
      request_id: request.request_id,
      body_payload_hash: request.payload_hash,
      write_request_payload_hash: hashCanonical(request),
    }),
  });
}

export async function releaseProductionLease(
  session: ProductionWorkerSession,
  built: BuiltProductionLeaseRelease,
): Promise<string> {
  const { request } = built;
  await session.request(`/internal/ai-production/v6/jobs/${encodeURIComponent(request.job_id)}/lease-release`, {
    method: "POST",
    headers: { "x-ai-execution-fence-hash": request.fence_hash },
    body: JSON.stringify(request),
  });
  return request.request_id;
}

async function uploadJsonObject(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  role: "result_payload" | "result_envelope",
  bytes: Buffer,
): Promise<UploadedResultReceipt> {
  const contentHash = sha256(bytes);
  const requestId = `aipresult_${hashCanonical({
    job_id: job.job_id, attempt_id: job.grant.attempt_id, role, content_hash: contentHash,
  }).slice(7, 47)}`;
  const attemptHash = hashCanonical({ attempt_id: job.grant.attempt_id }).slice(7, 23);
  const artifactId = `airesult_${job.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${attemptHash}_${role}_${contentHash.slice(-16)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/${role}/${encodeURIComponent(artifactId)}`;
  const durableHeaders = {
    ...fenceHeaders(job),
    "content-type": "application/json",
    "x-ai-request-id": requestId,
    "x-ai-content-sha256": contentHash,
    "x-ai-content-bytes": String(bytes.byteLength),
  };
  store.enqueue({ idempotency_key: requestId, kind: "artifact", path: pathname, method: "PUT", headers: durableHeaders, body: bytes });
  return store.deliverOutbox(requestId, async (write) => {
    const response = await productionCloudFetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${write.path}`, {
      method: write.method,
      headers: await session.authorizationHeaders(write.headers),
      body: Buffer.from(write.body),
      signal: AbortSignal.timeout(120_000),
    });
    return UploadedResultReceiptSchema.parse(parseJsonEnvelope(await response.json() as unknown, response.status));
  });
}

type ProductionResultUploadInput = Readonly<{
  session: ProductionWorkerSession;
  store: ProductionRuntimeStore;
  job: ClaimedProductionTask;
  complete: CompleteProductionOutput;
}>;

const buildProductionResultEnvelope = (
  input: ProductionResultUploadInput,
  payloadReceipt: UploadedResultReceipt,
): WebsiteAgentResult => WebsiteAgentResultSchema.parse({
  schema_version: "website-agent-result.v1",
  job_id: input.job.job_id,
  source_task_id: input.job.source_task_id,
  product_id: input.job.product_id,
  action_id: input.job.action_id,
  result_contract_id: RESULT_CONTRACT_ID,
  result_contract_version: RESULT_CONTRACT_VERSION,
  result_payload_ref: payloadReceipt.object_ref,
  result_payload_hash: payloadReceipt.sha256,
  result_payload_bytes: payloadReceipt.byte_length,
  result_payload_media_type: payloadReceipt.media_type,
  result_object_receipt: {
    object_ref: payloadReceipt.object_ref,
    sha256: payloadReceipt.sha256,
    bytes: payloadReceipt.byte_length,
    media_type: payloadReceipt.media_type,
    receipt_hash: payloadReceipt.receipt_hash,
  },
  evidence_refs: input.complete.evidence_refs,
  execution_receipt_hash: input.complete.execution_receipt_hash,
}) as WebsiteAgentResult;

export async function uploadProductionResult(input: ProductionResultUploadInput): Promise<Readonly<{
  envelope: WebsiteAgentResult;
  payload_receipt: UploadedResultReceipt;
  envelope_receipt: UploadedResultReceipt;
  artifact_receipts: readonly UploadedResultReceipt[];
}>> {
  const payloadReceipt = await uploadJsonObject(
    input.session, input.store, input.job, "result_payload", Buffer.from(input.complete.payload_json, "utf8"),
  );
  const envelope = buildProductionResultEnvelope(input, payloadReceipt);
  const envelopeReceipt = await uploadJsonObject(
    input.session, input.store, input.job, "result_envelope", Buffer.from(JSON.stringify(envelope), "utf8"),
  );
  return {
    envelope,
    payload_receipt: payloadReceipt,
    envelope_receipt: envelopeReceipt,
    artifact_receipts: Object.freeze([
      ...input.complete.artifact_receipts,
      payloadReceipt, envelopeReceipt,
    ]),
  };
}
