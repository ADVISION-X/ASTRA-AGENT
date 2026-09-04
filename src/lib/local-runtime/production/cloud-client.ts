import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
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
  type DurablePluginIdentity,
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
import type { SerializedExecutionFailure } from "./terminal-failure.js";
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
      || job.grant.control_contract_manifest_hash !== session.device.control_manifest_hash)) {
    throw executionFailure("failed", "V6_CLAIM_BATCH_INVALID");
  }
  return {
    outcome: receipt.outcome,
    jobs: Object.freeze(jobs),
    next_claim_after_ms: receipt.next_claim_after_ms,
    reason_codes: Object.freeze(receipt.reason_codes),
  };
}

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
    const temporary = `${destination}.${process.pid}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    try { await rename(temporary, destination); } catch (error) { await rm(temporary, { force: true }); throw error; }
    result.push({ ...material, local_path: destination });
  }
  return Object.freeze(result);
}

export async function checkpointProductionTask(
  session: Pick<ProductionWorkerSession, "request" | "workerSessionEpoch" | "workerSessionId">,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  checkpointKind: "accepted" | "progress" | "attempt_failure" | "handover_acknowledgement",
  checkpointSeq: number,
  attemptFailure: SerializedExecutionFailure | null = null,
): Promise<Readonly<{ checkpointHash: ProductionHash; checkpointSeq: number; requestId: string }>> {
  if (!Number.isInteger(checkpointSeq) || checkpointSeq < 1) {
    throw executionFailure("failed", "V6_CHECKPOINT_SEQUENCE_INVALID");
  }
  const scheduledFailure = store.scheduledCheckpointFailure({
    jobId: job.job_id, attemptId: job.grant.attempt_id, checkpointSeq,
    checkpointKind, attemptFailure,
  });
  if (scheduledFailure) throw executionFailure("failed", scheduledFailure);
  const requestId = `aipcheckpoint_${hashCanonical({
    job_id: job.job_id,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    checkpoint_seq: checkpointSeq,
    checkpoint_kind: checkpointKind,
    attempt_failure: attemptFailure,
  }).slice(7, 47)}`;
  const body = {
    schema_version: "xuanxue-ai-checkpoint.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId,
    idempotency_key: requestId,
    job_id: job.job_id,
    worker_session_id: session.workerSessionId,
    worker_session_epoch: session.workerSessionEpoch,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    fence_hash: job.grant.execution_fence.fence_hash,
    local_order_id: job.job_id,
    checkpoint_seq: checkpointSeq,
    checkpoint_kind: checkpointKind,
    payload_hash: hashCanonical({
      job_id: job.job_id,
      attempt_id: job.grant.attempt_id,
      checkpoint_seq: checkpointSeq,
      checkpoint_kind: checkpointKind,
    }),
    object_receipts: [],
    attempt_failure: attemptFailure,
  } as const;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/checkpoints`;
  store.enqueue({ idempotency_key: requestId, kind: "checkpoint", path: pathname, method: "POST", headers: fenceHeaders(job), body: JSON.stringify(body) });
  const response = await store.deliverOutbox(requestId, async () => {
    const received = await session.request(pathname, {
      method: "POST", headers: fenceHeaders(job), body: JSON.stringify(body),
    }) as Record<string, unknown>;
    if (received.job_id !== job.job_id || received.checkpoint_seq !== checkpointSeq
      || typeof received.checkpoint_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(received.checkpoint_hash)
      || received.checkpoint_hash !== hashCanonical(body)) {
      throw executionFailure("failed", "V6_CHECKPOINT_RECEIPT_INVALID");
    }
    return received;
  });
  return Object.freeze({
    checkpointHash: response.checkpoint_hash as ProductionHash,
    checkpointSeq,
    requestId,
  });
}

export async function renewProductionLease(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
  checkpointHash: ProductionHash | null,
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
        checkpoint_hash: checkpointHash,
      }),
    },
  ));
}

export async function releaseProductionLease(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
  release: ProductionLeaseRelease,
  stableRequestId?: string,
): Promise<string> {
  const requestId = stableRequestId ?? `aiprelease_${randomUUID()}`;
  const payload = {
    reason_code: release.reasonCode,
    receiver_checkpoint: release.receiverCheckpoint,
    confirmed_submit: release.confirmedSubmit,
    job_id: job.job_id,
    fence_hash: job.grant.execution_fence.fence_hash,
  };
  await session.request(`/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/lease-release`, {
    method: "POST",
    headers: fenceHeaders(job),
    body: JSON.stringify({
      schema_version: "xuanxue-ai-lease-release.v6",
      control_protocol_version: "xuanxue-ai-production-v6",
      request_id: requestId,
      idempotency_key: requestId,
      job_id: job.job_id,
      worker_session_id: session.workerSessionId,
      worker_session_epoch: session.workerSessionEpoch,
      attempt_id: job.grant.attempt_id,
      lease_version: job.grant.lease_version,
      fence_hash: job.grant.execution_fence.fence_hash,
      payload_hash: hashCanonical(payload),
      reason_code: release.reasonCode,
      receiver_checkpoint: release.receiverCheckpoint,
      confirmed_submit: release.confirmedSubmit,
    }),
  });
  return requestId;
}

async function uploadJsonObject(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  role: "result_payload" | "result_envelope" | "execution_context",
  value: unknown,
): Promise<UploadedResultReceipt> {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  const contentHash = sha256(bytes);
  const requestId = `aipresult_${hashCanonical({
    job_id: job.job_id, attempt_id: job.grant.attempt_id, role, content_hash: contentHash,
  }).slice(7, 47)}`;
  const artifactId = `airesult_${job.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-80)}_${role}_${contentHash.slice(-16)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/${role}/${encodeURIComponent(artifactId)}`;
  const durableHeaders = {
    ...fenceHeaders(job),
    "content-type": "application/json",
    "x-ai-request-id": requestId,
    "x-ai-content-sha256": contentHash,
    "x-ai-content-bytes": String(bytes.byteLength),
  };
  store.enqueue({ idempotency_key: requestId, kind: "artifact", path: pathname, method: "PUT", headers: durableHeaders, body: bytes });
  return store.deliverOutbox(requestId, async () => {
    const response = await productionCloudFetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
      method: "PUT",
      headers: await session.authorizationHeaders(durableHeaders),
      body: bytes,
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
  const requestId = `aipresult_${hashCanonical({ job_id: job.job_id, role: "generated_image", hash: image.sha256 }).slice(7, 47)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/generated_image/${encodeURIComponent(image.artifact_id)}`;
  const delivered = store.readOutboxAuthority(requestId);
  if (delivered?.state === "delivered") {
    return UploadedResultReceiptSchema.parse(store.readOutboxResponse(requestId));
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
  return store.deliverOutbox(requestId, async () => {
    const response = await productionCloudFetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
      method: "PUT",
      headers: await session.authorizationHeaders(durableHeaders),
      body: bytes,
      signal: AbortSignal.timeout(120_000),
    });
    return UploadedResultReceiptSchema.parse(parseJsonEnvelope(await response.json() as unknown, response.status));
  });
}

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
  identity: DurablePluginIdentity;
  output: ProductPluginOutput;
  continuationRef: string | null;
  priorArtifactReceipts?: readonly UploadedResultReceipt[];
}>;

const buildProductionResultEnvelope = (
  input: ProductionResultUploadInput,
  payloadReceipt: UploadedResultReceipt,
  executionContextReceipt: UploadedResultReceipt | null,
): WebsiteAgentResult => WebsiteAgentResultSchema.parse({
  schema_version: "website-agent-result.v1",
  job_id: input.job.job_id,
  source_task_id: input.job.source_task_id,
  product_id: input.job.product_id,
  action_id: input.job.action_id,
  plugin_id: input.identity.plugin_id,
  plugin_version: input.identity.plugin_version,
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
  ...(executionContextReceipt ? { execution_context_object_receipt: {
    object_ref: executionContextReceipt.object_ref,
    sha256: executionContextReceipt.sha256,
    bytes: executionContextReceipt.byte_length,
    media_type: "application/json",
    receipt_hash: executionContextReceipt.receipt_hash,
  } } : {}),
  evidence_refs: input.output.evidence_refs,
  execution_receipt_hash: hashCanonical({
    job_id: input.job.job_id,
    attempt_id: input.job.grant.attempt_id,
    durable_identity: input.identity,
    payload_hash: payloadReceipt.sha256,
    execution_context_receipt_hash: executionContextReceipt?.receipt_hash ?? null,
    evidence_refs: input.output.evidence_refs,
  }),
  ...(input.continuationRef ? { continuation_ref: input.continuationRef } : {}),
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
  const executionContextReceipt = input.output.execution_context === undefined ? null
    : await uploadJsonObject(
      input.session, input.store, input.job, "execution_context", input.output.execution_context,
    );
  const envelope = buildProductionResultEnvelope(input, payloadReceipt, executionContextReceipt);
  const envelopeReceipt = await uploadJsonObject(
    input.session, input.store, input.job, "result_envelope", envelope,
  );
  return {
    envelope,
    payload_receipt: payloadReceipt,
    envelope_receipt: envelopeReceipt,
    artifact_receipts: Object.freeze([
      ...(input.priorArtifactReceipts ?? []),
      ...(executionContextReceipt ? [executionContextReceipt] : []),
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
  const response = await store.deliverOutbox(requestId, async () => session.request(pathname, {
    method: "POST",
    headers: fenceHeaders(job),
    body,
  }));
  return parseTerminalReceipt(response, expected);
}
