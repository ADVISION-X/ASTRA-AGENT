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
  sha256,
  type DurablePluginIdentity,
  type LocalProductionMaterial,
  type ProductionHash,
  type WebsiteAgentResult,
} from "./contracts.js";
import { ProductionWorkerSession } from "./worker-session.js";
import { ProductionRuntimeStore, type ProductionOutboxWrite } from "./store.js";

const fenceHeaders = (job: ClaimedProductionTask): Record<string, string> => ({
  "x-ai-execution-fence-hash": job.grant.execution_fence.fence_hash,
});

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
  const attestation = await session.ensureFreshAttestation();
  const request = {
    schema_version: "xuanxue-ai-claim-request.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId,
    worker_session_id: session.workerSessionId,
    worker_session_epoch: session.workerSessionEpoch,
    requested_limit: limit,
    runtime_attestation_receipt_hash: attestation.receipt_hash,
  } as const;
  const receipt = ClaimBatchReceiptSchema.parse(await session.request(
    "/internal/ai-production/v6/jobs/claim",
    { method: "POST", body: JSON.stringify(request) },
  ));
  if (receipt.request_id !== request.request_id) throw new Error("V6_CLAIM_RECEIPT_MISMATCH");
  const jobs = receipt.jobs.map((raw) => ClaimedProductionTaskSchema.parse(raw));
  if ((receipt.outcome === "LEASE_GRANTED") !== (jobs.length > 0)
    || jobs.some((job) => job.grant.worker_session_id !== session.workerSessionId
      || job.grant.worker_session_epoch !== session.workerSessionEpoch)) {
    throw new Error("V6_CLAIM_BATCH_INVALID");
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
    const response = await fetch(
      `${session.device.server_base_url.replace(/\/+$/u, "")}/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/materials/${encodeURIComponent(material.material_id)}`,
      {
        headers: await session.authorizationHeaders(fenceHeaders(job)),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!response.ok) throw new Error(`MATERIAL_DOWNLOAD_FAILED:${response.status}:${material.material_id}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== material.bytes || sha256(bytes) !== material.sha256) {
      throw new Error(`MATERIAL_DOWNLOAD_IDENTITY_MISMATCH:${material.material_id}`);
    }
    const destination = path.join(materialDir, `${String(material.ordinal).padStart(3, "0")}-${material.display_name}`);
    const temporary = `${destination}.${process.pid}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    try { await rename(temporary, destination); } catch (error) { await rm(temporary, { force: true }); throw error; }
    result.push({ ...material, local_path: destination });
  }
  return Object.freeze(result);
}

export async function checkpointProductionTask(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  status: "inputs_downloading" | "factory_running" | "recovery_pending",
  checkpointKind: string,
): Promise<ProductionHash> {
  const requestId = `aipcheckpoint_${randomUUID()}`;
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
    status,
    checkpoint_seq: status === "inputs_downloading" ? 1 : status === "factory_running" ? 2 : 3,
    checkpoint_kind: checkpointKind,
    payload_hash: hashCanonical({ job_id: job.job_id, status, checkpoint_kind: checkpointKind }),
    object_receipts: [],
  } as const;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/checkpoints`;
  store.enqueue({ idempotency_key: requestId, kind: "checkpoint", path: pathname, method: "POST", headers: fenceHeaders(job), body: JSON.stringify(body) });
  const response = await session.request(pathname, { method: "POST", headers: fenceHeaders(job), body: JSON.stringify(body) }) as Record<string, unknown>;
  store.markOutboxSent(requestId);
  if (typeof response.checkpoint_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(response.checkpoint_hash)) {
    throw new Error("V6_CHECKPOINT_RECEIPT_INVALID");
  }
  return response.checkpoint_hash as ProductionHash;
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
  reason: "CAPABILITY_CHANGED_BEFORE_ACCEPT" | "DEADLINE_BUDGET_EXHAUSTED" | "LOCAL_CAPACITY_CHANGED",
): Promise<void> {
  const requestId = `aiprelease_${randomUUID()}`;
  const payload = { reason_code: reason, job_id: job.job_id, fence_hash: job.grant.execution_fence.fence_hash };
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
      reason_code: reason,
    }),
  });
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
  const requestId = `aipresult_${randomUUID()}`;
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
  const response = await fetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
    method: "PUT",
    headers: await session.authorizationHeaders(durableHeaders),
    body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  const raw = await response.json() as unknown;
  const receipt = UploadedResultReceiptSchema.parse(parseJsonEnvelope(raw));
  store.markOutboxSent(requestId);
  return receipt;
}

export async function uploadProductionResult(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  identity: DurablePluginIdentity,
  output: Readonly<{ payload: unknown; evidence_refs: readonly string[] }>,
  continuationRef: string | null,
): Promise<Readonly<{
  envelope: WebsiteAgentResult;
  payload_receipt: UploadedResultReceipt;
  envelope_receipt: UploadedResultReceipt;
}>> {
  const payloadReceipt = await uploadJsonObject(session, store, job, "result_payload", output.payload);
  const envelope = WebsiteAgentResultSchema.parse({
    schema_version: "website-agent-result.v1",
    job_id: job.job_id,
    source_task_id: job.source_task_id,
    product_id: job.product_id,
    action_id: job.action_id,
    plugin_id: identity.plugin_id,
    plugin_version: identity.plugin_version,
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
    evidence_refs: output.evidence_refs,
    execution_receipt_hash: hashCanonical({
      job_id: job.job_id,
      attempt_id: job.grant.attempt_id,
      durable_identity: identity,
      payload_hash: payloadReceipt.sha256,
      evidence_refs: output.evidence_refs,
    }),
    ...(continuationRef ? { continuation_ref: continuationRef } : {}),
  }) as WebsiteAgentResult;
  const envelopeReceipt = await uploadJsonObject(session, store, job, "result_envelope", envelope);
  return { envelope, payload_receipt: payloadReceipt, envelope_receipt: envelopeReceipt };
}

export async function terminalProductionTask(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  job: ClaimedProductionTask,
  input: Readonly<{
    status: "completed" | "failed" | "review_required" | "cancelled";
    payload_hash: ProductionHash;
    result_receipt_hashes: readonly ProductionHash[];
  }>,
): Promise<Record<string, unknown>> {
  const requestId = `aipterminal_${randomUUID()}`;
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
    payload_hash: input.payload_hash,
    result_object_receipts: input.result_receipt_hashes,
  });
  store.enqueue({ idempotency_key: requestId, kind: "terminal", path: pathname, method: "POST", headers: fenceHeaders(job), body });
  const response = await session.request(pathname, {
    method: "POST",
    headers: fenceHeaders(job),
    body,
  }) as Record<string, unknown>;
  store.markOutboxSent(requestId);
  return response;
}

export const sendProductionOutboxWrite = async (
  session: ProductionWorkerSession,
  write: ProductionOutboxWrite,
): Promise<void> => {
  if (write.kind === "artifact") {
    const response = await fetch(`${session.device.server_base_url.replace(/\/+$/u, "")}${write.path}`, {
      method: write.method,
      headers: await session.authorizationHeaders(write.headers),
      body: Buffer.from(write.body),
      signal: AbortSignal.timeout(120_000),
    });
    const raw = await response.json() as unknown;
    parseJsonEnvelope(raw);
    return;
  }
  await session.request(write.path, {
    method: write.method,
    headers: write.headers,
    body: typeof write.body === "string" ? write.body : Buffer.from(write.body).toString("utf8"),
  });
};
