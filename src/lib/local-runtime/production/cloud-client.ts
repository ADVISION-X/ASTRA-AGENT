import { randomUUID } from "node:crypto";
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
  parseTerminalReceipt,
  parseTerminalReceiptExpectation,
  sha256,
  type LocalProductionMaterial,
  type ProductionHash,
  type TerminalReceipt,
  type WebsiteAgentResult,
} from "./contracts.js";
import { ProductionWorkerSession } from "./worker-session.js";
import { ProductionRuntimeStore } from "./store.js";
import type {
  GeneratedImageArtifact,
  GeneratedImageResultReceipt,
  ProductPluginOutput,
} from "../../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../execution-failure.js";
import { productionCloudFetch } from "./cloud-transport.js";
import type { ProductionLeaseRelease } from "./lease-release-contract.js";
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
): Promise<Readonly<{
  outcome: "LEASE_GRANTED" | "NO_ELIGIBLE_JOB" | "CAPACITY_ZERO" | "CLAIM_BLOCKED" | "DRAINING";
  jobs: readonly ClaimedProductionTask[];
  next_claim_after_ms: number;
  reason_codes: readonly string[];
}>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("V6_CLAIM_LIMIT_INVALID");
  const receipt = ClaimBatchReceiptSchema.parse(await session.requestClaim(requestId, limit));
  if (receipt.request_id !== requestId) throw executionFailure("failed", "V6_CLAIM_RECEIPT_MISMATCH");
  const jobs = receipt.jobs.map((raw) => ClaimedProductionTaskSchema.parse(raw));
  if ((receipt.outcome === "LEASE_GRANTED") !== (jobs.length > 0)
    || jobs.some((job) => job.grant.worker_session_id !== session.workerSessionId
      || job.grant.worker_session_epoch !== session.workerSessionEpoch
      || job.grant.control_contract_version !== session.controlContractVersion)) {
    throw executionFailure("failed", "V6_CLAIM_BATCH_INVALID");
  }
  return {
    outcome: receipt.outcome,
    jobs: Object.freeze(jobs),
    next_claim_after_ms: receipt.next_claim_after_ms,
    reason_codes: Object.freeze(receipt.reason_codes),
  };
}

const writeProductionMaterial = async (destination: string, bytes: Uint8Array): Promise<void> => {
  try {
    const metadata = await lstat(destination);
    const existing = await readFile(destination);
    if (!metadata.isFile() || existing.byteLength !== bytes.byteLength
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
): Promise<readonly LocalProductionMaterial[]> {
  await mkdir(materialDir, { recursive: true, mode: 0o700 });
  const result: LocalProductionMaterial[] = [];
  for (const material of [...job.material_refs].sort((left, right) => left.ordinal - right.ordinal)) {
    const response = await productionCloudFetch(
      `${session.device.server_base_url.replace(/\/+$/u, "")}/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/materials/${encodeURIComponent(material.material_id)}`,
      {
        headers: await session.authorizationHeaders(fenceHeaders(job)),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!response.ok) await throwMaterialDownloadFailure(response);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== material.bytes || sha256(bytes) !== material.sha256) {
      throw executionFailure("failed", `MATERIAL_DOWNLOAD_IDENTITY_MISMATCH:${material.material_id}`);
    }
    const destination = path.join(materialDir, material.display_name);
    await writeProductionMaterial(destination, bytes);
    result.push({ ...material, local_path: destination });
  }
  return Object.freeze(result);
}

export async function renewProductionLease(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
) {
  const requestId = `aiprenew_${randomUUID()}`;
  return LeaseRenewReceiptSchema.parse(await session.request(
    `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/renew`,
    {
      method: "POST",
      headers: fenceHeaders(job),
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
  ));
}

export async function releaseProductionLease(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
  release: ProductionLeaseRelease,
): Promise<string> {
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
  await session.request(`/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/lease-release`, {
    method: "POST",
    headers: fenceHeaders(job),
    body: JSON.stringify({
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
    }),
  });
  return requestId;
}

async function uploadJsonObject(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  role: "result_payload" | "result_envelope",
  value: unknown,
): Promise<UploadedResultReceipt> {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
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

async function uploadGeneratedImage(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  image: GeneratedImageArtifact,
): Promise<UploadedResultReceipt> {
  const uploadArtifactId = `${image.artifact_id}_${hashCanonical({
    attempt_id: job.grant.attempt_id,
    role: "generated_image",
  }).slice(7, 23)}`;
  const requestId = `aipresult_${hashCanonical({ job_id: job.job_id, attempt_id: job.grant.attempt_id,
    role: "generated_image", hash: image.sha256 }).slice(7, 47)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/generated_image/${encodeURIComponent(uploadArtifactId)}`;
  const delivered = store.readOutboxAuthority(requestId);
  if (delivered?.state === "delivered") {
    return exactGeneratedImageReceipt(store.readOutboxResponse(requestId), image, uploadArtifactId);
  }
  const bytes = Buffer.from(image.webp_bytes);
  if (bytes.byteLength !== image.bytes || sha256(bytes) !== image.sha256
    || image.original_bytes.byteLength < 1 || sha256(image.original_bytes) !== image.original_sha256
    || image.media_type !== "image/webp" || image.width !== 1200 || image.height !== 630) {
    throw executionFailure("failed", "GENERATED_IMAGE_LOCAL_IDENTITY_MISMATCH");
  }
  const durableHeaders = {
    ...fenceHeaders(job),
    "content-type": "image/webp",
    "x-ai-request-id": requestId,
    "x-ai-content-sha256": image.sha256,
    "x-ai-content-bytes": String(image.bytes),
  };
  store.enqueue({ idempotency_key: requestId, kind: "artifact", path: pathname, method: "PUT", headers: durableHeaders, body: bytes });
  return store.deliverOutbox(requestId, async (write) => {
    const response = await productionCloudFetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${write.path}`, {
      method: write.method,
      headers: await session.authorizationHeaders(write.headers),
      body: Buffer.from(write.body),
      signal: AbortSignal.timeout(120_000),
    });
    return exactGeneratedImageReceipt(
      parseJsonEnvelope(await response.json() as unknown, response.status),
      image, uploadArtifactId,
    );
  });
}

const exactGeneratedImageReceipt = (
  value: unknown,
  image: GeneratedImageArtifact,
  uploadArtifactId: string,
): UploadedResultReceipt => {
  const receipt = UploadedResultReceiptSchema.parse(value);
  if (receipt.artifact_id !== uploadArtifactId
    || receipt.role !== "generated_image"
    || receipt.sha256 !== image.sha256
    || receipt.byte_length !== image.bytes
    || receipt.media_type !== image.media_type) {
    throw executionFailure("failed", "GENERATED_IMAGE_WEBSITE_RECEIPT_MISMATCH");
  }
  return receipt;
};

export async function uploadProductionGeneratedImage(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  image: GeneratedImageArtifact,
): Promise<Readonly<{
  receipt: GeneratedImageResultReceipt;
  transportReceipt: UploadedResultReceipt;
}>> {
  const transportReceipt = await uploadGeneratedImage(session, store, job, image);
  return Object.freeze({
    transportReceipt,
    receipt: Object.freeze({
      artifact_id: transportReceipt.artifact_id,
      object_ref: transportReceipt.object_ref,
      sha256: transportReceipt.sha256,
      receipt_hash: transportReceipt.receipt_hash,
      bytes: transportReceipt.byte_length,
      mime_type: image.media_type,
      width: image.width,
      height: image.height,
    }),
  });
}

type ProductionResultUploadInput = Readonly<{
  session: ProductionWorkerSession;
  store: ProductionRuntimeStore;
  job: ClaimedProductionTask;
  output: ProductPluginOutput;
  priorArtifactReceipts?: readonly UploadedResultReceipt[];
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
  evidence_refs: input.output.evidence_refs,
  execution_receipt_hash: hashCanonical({
    job_id: input.job.job_id,
    attempt_id: input.job.grant.attempt_id,
    request_hash: input.job.request_hash,
    product_id: input.job.product_id,
    action_id: input.job.action_id,
    payload_hash: payloadReceipt.sha256,
    evidence_refs: input.output.evidence_refs,
  }),
}) as WebsiteAgentResult;

export async function uploadProductionResult(input: ProductionResultUploadInput): Promise<Readonly<{
  envelope: WebsiteAgentResult;
  payload_receipt: UploadedResultReceipt;
  envelope_receipt: UploadedResultReceipt;
  artifact_receipts: readonly UploadedResultReceipt[];
}>> {
  const payloadReceipt = await uploadJsonObject(
    input.session, input.store, input.job, "result_payload", input.output.payload,
  );
  const envelope = buildProductionResultEnvelope(input, payloadReceipt);
  const envelopeReceipt = await uploadJsonObject(
    input.session, input.store, input.job, "result_envelope", envelope,
  );
  return {
    envelope,
    payload_receipt: payloadReceipt,
    envelope_receipt: envelopeReceipt,
    artifact_receipts: Object.freeze([
      ...(input.priorArtifactReceipts ?? []),
      payloadReceipt, envelopeReceipt,
    ]),
  };
}

export async function terminalProductionTask(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  input: Readonly<{
    status: "completed";
    payload_hash: ProductionHash;
    result_receipt_hashes: readonly ProductionHash[];
  }>,
): Promise<TerminalReceipt> {
  const requestId = `aipterminal_${hashCanonical({
    job_id: job.job_id,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    terminal_status: input.status,
    failure: null,
    payload_hash: input.payload_hash,
    result_object_receipts: input.result_receipt_hashes,
  }).slice(7, 47)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/terminal`;
  const body = JSON.stringify({
    schema_version: "xuanxue-ai-terminal-cas.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId,
    idempotency_key: requestId,
    job_id: job.job_id,
    worker_session_id: session.workerSessionId,
    worker_session_epoch: session.workerSessionEpoch,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    fence_hash: job.grant.execution_fence.fence_hash,
    terminal_status: input.status,
    failure: null,
    payload_hash: input.payload_hash,
    result_object_receipts: input.result_receipt_hashes,
  });
  const expected = parseTerminalReceiptExpectation(body);
  store.enqueue({ idempotency_key: requestId, kind: "terminal", path: pathname, method: "POST", headers: fenceHeaders(job), body });
  const response = await store.deliverOutbox(requestId, async (write) => session.request(write.path, {
    method: write.method,
    headers: write.headers,
    body: Buffer.from(write.body),
  }));
  return parseTerminalReceipt(response, expected);
}
