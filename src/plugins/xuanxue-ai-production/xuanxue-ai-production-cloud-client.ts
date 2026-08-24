import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { ClaimBatchReceiptV6Schema, HandoverV6Schema, type ClaimBatchReceiptV6, type HandoverV6 } from "./generated/xuanxue-ai-production-v6.validator.js";
import {
  XuanxueAiProductionCloudClaimedJobSchema,
  type XuanxueAiProductionCloudClaimedJob,
} from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionResult } from "./xuanxue-ai-production.schema.js";
import type {
  XuanxueAiProductionCloudOutbox,
  XuanxueAiProductionCloudOutboxWrite,
} from "./xuanxue-ai-production-cloud-outbox.js";
import type { XuanxueAiProductionWorkerSessionV6 } from "./xuanxue-ai-production-worker-session.js";
import type {
  XuanxueAiProductionAttachmentCheckpointProof,
  XuanxueAiProductionClaimBatchResult,
  XuanxueAiProductionCloudTerminalStatus,
} from "./xuanxue-ai-production-cloud-client-contract.js";

interface UploadedOutputArtifact {
  readonly artifact_id: string; readonly object_ref: string;
  readonly sha256: `sha256:${string}`; readonly mime_type: "image/webp";
  readonly byte_count: number; readonly width: 1200; readonly height: 630;
  readonly state: "staged";
}

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
};
const hashCanonical = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const rootUrl = (session: XuanxueAiProductionWorkerSessionV6): string =>
  session.device.server_base_url.replace(/\/+$/u, "");
const fenceHeaders = (job: XuanxueAiProductionCloudClaimedJob): Record<string, string> => ({
  "x-ai-execution-fence-hash": job.grant.execution_fence.fence_hash,
});

const reportUnaddressableClaim = (raw: unknown, error: unknown): void => {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  process.stderr.write(`${JSON.stringify({
    level: "error", owner: "xuanxue-ai-production",
    code: "XUANXUE_AI_PRODUCTION_V6_CLAIM_ENVELOPE_INVALID",
    job_id: typeof record.job_id === "string" ? record.job_id : null,
    reason_code: error instanceof Error ? error.message.slice(0, 900) : String(error).slice(0, 900),
    at: new Date().toISOString(),
  })}\n`);
};

const parseClaimedJobs = (
  receipt: ClaimBatchReceiptV6,
): XuanxueAiProductionCloudClaimedJob[] => receipt.jobs.map((rawJob) => {
  const parsed = XuanxueAiProductionCloudClaimedJobSchema.safeParse(rawJob);
  if (parsed.success) return parsed.data;
  reportUnaddressableClaim(rawJob, parsed.error);
  throw new Error("XUANXUE_AI_PRODUCTION_V6_CLAIM_BATCH_PARTIAL_REJECTED");
});

const jobBelongsToSession = (
  job: XuanxueAiProductionCloudClaimedJob,
  session: XuanxueAiProductionWorkerSessionV6,
): boolean => job.grant.worker_session_id === session.workerSessionId
  && job.grant.worker_session_epoch === session.workerSessionEpoch;

const selectAddressableJobs = (
  parsedJobs: readonly XuanxueAiProductionCloudClaimedJob[],
  session: XuanxueAiProductionWorkerSessionV6,
  reconcilingSupersededClaim: boolean,
): XuanxueAiProductionCloudClaimedJob[] => {
  if (reconcilingSupersededClaim) return [];
  return parsedJobs.filter((job) => {
    if (jobBelongsToSession(job, session)) return true;
    reportUnaddressableClaim(job, new Error("SESSION_FENCE_MISMATCH"));
    return false;
  });
};

export async function claimXuanxueAiProductionJobs(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  limit: number,
): Promise<XuanxueAiProductionClaimBatchResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("XUANXUE_AI_PRODUCTION_V6_CLAIM_LIMIT_INVALID");
  const pending = outbox.pendingClaimRequest();
  const attestation = pending ? null : await session.ensureFreshAttestation();
  const requestId = pending?.requestId ?? `aipclaim_${randomUUID()}`;
  const requestPayload = pending?.payload ?? {
    schema_version: "xuanxue-ai-claim-request.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId,
    worker_session_id: session.workerSessionId,
    worker_session_epoch: session.workerSessionEpoch,
    requested_limit: limit,
    runtime_attestation_receipt_hash: attestation!.receipt_hash,
  };
  const reconcilingSupersededClaim = requestPayload.worker_session_id !== session.workerSessionId
    || requestPayload.worker_session_epoch !== session.workerSessionEpoch;
  outbox.beginClaimRequest({ requestId, payload: requestPayload, payloadHash: hashCanonical(requestPayload) });
  const raw = await session.request<unknown>("/internal/ai-production/v6/jobs/claim", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });
  const receipt = ClaimBatchReceiptV6Schema.parse(raw);
  if (receipt.request_id !== requestId) throw new Error("XUANXUE_AI_PRODUCTION_V6_CLAIM_RECEIPT_MISMATCH");
  const parsedJobs = parseClaimedJobs(receipt);
  outbox.commitClaimReceipt({
    requestId,
    claims: parsedJobs.map((job) => ({
      jobId: job.job_id, attemptId: job.grant.attempt_id,
      leaseVersion: job.grant.lease_version, createdAt: job.created_at,
      grant: job.grant,
    })),
  });
  const jobs = selectAddressableJobs(parsedJobs, session, reconcilingSupersededClaim);
  if (!reconcilingSupersededClaim && receipt.outcome === "LEASE_GRANTED" && jobs.length !== receipt.jobs.length) throw new Error("XUANXUE_AI_PRODUCTION_V6_CLAIM_BATCH_PARTIAL_REJECTED");
  return Object.freeze({
    outcome: reconcilingSupersededClaim ? "CLAIM_BLOCKED" : receipt.outcome,
    jobs: Object.freeze(jobs),
    reasonCodes: Object.freeze(reconcilingSupersededClaim
      ? ["SUPERSEDED_CLAIM_RECONCILED"] : [...receipt.reason_codes]),
    nextClaimAfterMs: receipt.next_claim_after_ms, receipt,
  });
}

export async function readXuanxueAiProductionCloudTerminalStatus(
  session: XuanxueAiProductionWorkerSessionV6,
  jobId: string,
): Promise<XuanxueAiProductionCloudTerminalStatus> {
  if (!jobId.trim()) throw new Error("XUANXUE_AI_PRODUCTION_ATTESTATION_JOB_ID_INVALID");
  return session.request(`/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/device-status`, { method: "GET" });
}

export async function downloadXuanxueAiProductionInput(
  session: XuanxueAiProductionWorkerSessionV6,
  job: XuanxueAiProductionCloudClaimedJob,
  stageId: string,
  inputId: string,
): Promise<Uint8Array> {
  const response = await fetch(
    `${rootUrl(session)}/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/materials/${encodeURIComponent(stageId)}/inputs/${encodeURIComponent(inputId)}`,
    { headers: await session.authorizationHeaders(fenceHeaders(job)), signal: AbortSignal.timeout(120_000) },
  );
  if (!response.ok) throw new Error(`XUANXUE_AI_PRODUCTION_INPUT_DOWNLOAD_FAILED:${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Parent replay inputs are resolved by the same child-fenced V6 material
// endpoint. There is no parallel continuation-parent transport route.
export const downloadXuanxueAiProductionParentReplayInput = downloadXuanxueAiProductionInput;

const sendOutboxJson = async (
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  write: Parameters<XuanxueAiProductionCloudOutbox["enqueue"]>[0],
): Promise<Record<string, unknown>> => {
  const queued = outbox.enqueue(write);
  const result = await session.request<Record<string, unknown>>(queued.pathname, {
    method: queued.method, headers: queued.headers, body: JSON.stringify(queued.body),
  });
  const bodyFile = outbox.acknowledge(queued.requestId);
  if (bodyFile) await rm(bodyFile, { force: true });
  return result;
};

const acknowledgeOutboxWrite = async (
  outbox: XuanxueAiProductionCloudOutbox,
  requestId: string,
): Promise<void> => {
  const bodyFile = outbox.acknowledge(requestId);
  if (bodyFile) await rm(bodyFile, { force: true });
};

const replayArtifactWrite = async (
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  write: XuanxueAiProductionCloudOutboxWrite,
): Promise<void> => {
  if (!write.bodyFile) throw new Error("XUANXUE_AI_PRODUCTION_OUTBOX_ARTIFACT_FILE_MISSING");
  const bytes = await readFile(write.bodyFile);
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actual !== write.payloadHash) throw new Error("XUANXUE_AI_PRODUCTION_OUTBOX_ARTIFACT_CHANGED");
  const response = await fetch(`${rootUrl(session)}${write.pathname}`, {
    method: "PUT", headers: await session.authorizationHeaders(write.headers), body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  const envelope = await response.json() as { ok?: boolean; data?: unknown };
  if (!response.ok || envelope.ok !== true || envelope.data === undefined) {
    throw new Error(`XUANXUE_AI_PRODUCTION_OUTBOX_REPLAY_FAILED:${response.status}`);
  }
  await acknowledgeOutboxWrite(outbox, write.requestId);
};

const reconcileTerminalWrite = async (
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  write: XuanxueAiProductionCloudOutboxWrite,
): Promise<boolean> => {
  if ((write.writeKind !== "terminal" && write.writeKind !== "cancel") || !write.body) return false;
  const status = await readXuanxueAiProductionCloudTerminalStatus(session, write.jobId);
  if (status.terminal_status === null) return false;
  if (status.terminal_payload_hash !== write.body.payload_hash
    || status.terminal_status !== write.body.terminal_status || !status.terminal_receipt) {
    throw new Error("XUANXUE_AI_PRODUCTION_TERMINAL_RECEIPT_CONFLICT");
  }
  await acknowledgeOutboxWrite(outbox, write.requestId);
  return true;
};

export async function flushXuanxueAiProductionCloudOutbox(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
): Promise<void> {
  for (const write of outbox.pending()) {
    if (write.writeKind === "artifact") {
      await replayArtifactWrite(session, outbox, write);
      continue;
    }
    if (await reconcileTerminalWrite(session, outbox, write)) continue;
    await session.request<Record<string, unknown>>(write.pathname, {
      method: write.method, headers: write.headers, body: JSON.stringify(write.body),
    });
    await acknowledgeOutboxWrite(outbox, write.requestId);
  }
}

export async function releaseXuanxueAiProductionLease(
  session: XuanxueAiProductionWorkerSessionV6,
  job: XuanxueAiProductionCloudClaimedJob,
  reasonCode: "CAPABILITY_CHANGED_BEFORE_ACCEPT" | "DEADLINE_BUDGET_EXHAUSTED" | "LOCAL_CAPACITY_CHANGED",
): Promise<void> {
  const requestId = `aiprelease_${randomUUID()}`;
  const payload = { reason_code: reasonCode, job_id: job.job_id, fence_hash: job.grant.execution_fence.fence_hash };
  await session.request(`/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/lease-release`, {
    method: "POST", body: JSON.stringify({
      schema_version: "xuanxue-ai-lease-release.v6", request_id: requestId,
      control_protocol_version: "xuanxue-ai-production-v6", idempotency_key: requestId,
      job_id: job.job_id, fence_hash: job.grant.execution_fence.fence_hash,
      worker_session_id: session.workerSessionId, worker_session_epoch: session.workerSessionEpoch,
      attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
      payload_hash: hashCanonical(payload), reason_code: reasonCode,
    }),
  });
}

export async function heartbeatXuanxueAiProductionJob(
  session: XuanxueAiProductionWorkerSessionV6,
  job: XuanxueAiProductionCloudClaimedJob,
  checkpointHash: `sha256:${string}` | null = null,
): Promise<Readonly<{
  server_now: string; lease_expires_at: string; renew_after_ms: 20_000;
  control_intent: Readonly<{ intent: "none" | "pause_requested" | "cancel_requested" | "handover_requested"; control_epoch: number; reason_code: string | null }>;
}>> {
  const requestId = `aiprenew_${randomUUID()}`;
  return session.request(`/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/renew`, {
    method: "POST", body: JSON.stringify({
      schema_version: "xuanxue-ai-lease-renew.v6", control_protocol_version: "xuanxue-ai-production-v6",
      request_id: requestId, idempotency_key: requestId,
      job_id: job.job_id, fence_hash: job.grant.execution_fence.fence_hash,
      worker_session_id: session.workerSessionId, worker_session_epoch: session.workerSessionEpoch,
      attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
      checkpoint_hash: checkpointHash,
    }),
  });
}

const writeXuanxueAiProductionCheckpoint = async (
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly status: "inputs_downloading" | "factory_running" | "recovery_pending";
    readonly localOrderId?: string; readonly failureReason?: string;
    readonly attachmentUploadProof?: XuanxueAiProductionAttachmentCheckpointProof;
    readonly checkpointKind?: string;
    readonly writeKind?: "checkpoint" | "handover";
  },
): Promise<Readonly<{ payloadHash: `sha256:${string}`; response: Record<string, unknown> }>> => {
  const requestId = `aipcheckpoint_${randomUUID()}`;
  const payloadHash = hashCanonical(input);
  const queued = outbox.enqueueCheckpoint({
    jobId: job.job_id,
    attemptId: job.grant.attempt_id,
    leaseVersion: job.grant.lease_version,
    buildWrite: (checkpointSequence) => {
      const body = {
        schema_version: "xuanxue-ai-checkpoint.v6", control_protocol_version: "xuanxue-ai-production-v6",
        request_id: requestId, idempotency_key: requestId,
        job_id: job.job_id, fence_hash: job.grant.execution_fence.fence_hash,
        worker_session_id: session.workerSessionId, worker_session_epoch: session.workerSessionEpoch,
        attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
        local_order_id: input.localOrderId ?? null, status: input.status,
        checkpoint_seq: checkpointSequence,
        checkpoint_kind: input.checkpointKind ?? input.status, payload_hash: payloadHash,
        object_receipts: input.attachmentUploadProof?.staging_manifest_hash
          ? [input.attachmentUploadProof.staging_manifest_hash] : [],
      } as const;
      return {
        requestId, jobId: job.job_id, writeKind: input.writeKind ?? "checkpoint", method: "POST",
        pathname: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/checkpoints`,
        headers: {}, body, bodyFile: null, payloadHash: hashCanonical(body),
      };
    },
  });
  const response = await sendOutboxJson(session, outbox, queued);
  return Object.freeze({ payloadHash, response });
};

export async function checkpointXuanxueAiProductionJob(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly status: "inputs_downloading" | "factory_running" | "recovery_pending";
    readonly localOrderId?: string; readonly failureReason?: string;
    readonly attachmentUploadProof?: XuanxueAiProductionAttachmentCheckpointProof;
  },
): Promise<`sha256:${string}`> {
  const result = await writeXuanxueAiProductionCheckpoint(session, outbox, job, input);
  const checkpointHash = result.response.checkpoint_hash;
  if (typeof checkpointHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(checkpointHash)) {
    throw new Error("XUANXUE_AI_PRODUCTION_CHECKPOINT_RECEIPT_INVALID");
  }
  return checkpointHash as `sha256:${string}`;
}

export async function acknowledgeXuanxueAiProductionHandover(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  localOrderId: string,
): Promise<HandoverV6> {
  const result = await writeXuanxueAiProductionCheckpoint(session, outbox, job, {
    status: "recovery_pending",
    localOrderId,
    failureReason: "handover acknowledged at a local safe point",
    checkpointKind: "handover_acknowledgement",
    writeKind: "handover",
  });
  const handover = HandoverV6Schema.parse(result.response);
  if (handover.job_id !== job.job_id
    || handover.predecessor_fence_hash !== job.grant.execution_fence.fence_hash) {
    throw new Error("XUANXUE_AI_PRODUCTION_HANDOVER_RECEIPT_MISMATCH");
  }
  return handover;
}

export async function uploadXuanxueAiProductionOutputArtifact(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly stageId: "article_image_generation"; readonly artifactId: string;
    readonly filePath: string; readonly sha256: `sha256:${string}`;
    readonly originalSha256: `sha256:${string}`; readonly executionId: string;
    readonly providerOutputRef: string; readonly checkpointProofRef: string;
    readonly byteCount: number;
  },
): Promise<UploadedOutputArtifact> {
  const bytes = await readFile(input.filePath);
  if (bytes.byteLength !== input.byteCount
    || `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== input.sha256) {
    throw new Error("XUANXUE_AI_PRODUCTION_OUTPUT_LOCAL_BYTES_CHANGED");
  }
  const requestId = `aipartifact_${randomUUID()}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/${encodeURIComponent(input.stageId)}/${encodeURIComponent(input.artifactId)}`;
  const headers = {
    ...fenceHeaders(job), "content-type": "image/webp",
    "x-ai-request-id": requestId, "x-ai-content-sha256": input.sha256,
    "x-ai-original-sha256": input.originalSha256,
    "x-ai-execution-id": input.executionId,
    "x-ai-provider-output-ref": input.providerOutputRef,
    "x-ai-checkpoint-proof-ref": input.checkpointProofRef,
    "x-ai-content-bytes": String(input.byteCount),
  };
  const queued = outbox.enqueue({
    requestId, jobId: job.job_id, writeKind: "artifact", method: "PUT", pathname,
    headers, body: null, bodyFile: input.filePath, payloadHash: input.sha256,
  });
  const response = await fetch(`${rootUrl(session)}${pathname}`, {
    method: "PUT", headers: await session.authorizationHeaders(headers), body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  const envelope = await response.json() as { ok?: boolean; data?: UploadedOutputArtifact };
  if (!response.ok || envelope.ok !== true || !envelope.data) throw new Error(`XUANXUE_AI_PRODUCTION_OUTPUT_UPLOAD_FAILED:${response.status}`);
  const acknowledgedBodyFile = outbox.acknowledge(queued.requestId);
  if (acknowledgedBodyFile) await rm(acknowledgedBodyFile, { force: true });
  return envelope.data;
}

export async function uploadXuanxueAiProductionProductResult(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  dataDir: string,
  result: XuanxueAiProductionResult,
): Promise<`sha256:${string}`> {
  const canonical = canonicalJson(result);
  const bytes = Buffer.from(canonical, "utf8");
  const contentHash = hashCanonical(result);
  const directory = path.join(dataDir, "plugin-tasks", "xuanxue-ai-production", "cloud-result-outbox");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filePath = path.join(directory, `${job.job_id}-${job.grant.attempt_id}.json`);
  const handle = await open(filePath, "w", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const requestId = `aipresult_${randomUUID()}`;
  const artifactId = `airesult_${job.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-80)}_${contentHash.slice(-16)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/product_result/${encodeURIComponent(artifactId)}`;
  const headers = {
    ...fenceHeaders(job), "content-type": "application/json",
    "x-ai-request-id": requestId, "x-ai-content-sha256": contentHash,
    "x-ai-content-bytes": String(bytes.byteLength),
  };
  const queued = outbox.enqueue({
    requestId, jobId: job.job_id, writeKind: "artifact", method: "PUT", pathname,
    headers, body: null, bodyFile: filePath, payloadHash: contentHash,
  });
  const response = await fetch(`${rootUrl(session)}${pathname}`, {
    method: "PUT", headers: await session.authorizationHeaders(headers), body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  const envelope = await response.json() as { ok?: boolean; data?: { sha256?: string } };
  if (!response.ok || envelope.ok !== true || envelope.data?.sha256 !== contentHash) {
    throw new Error(`XUANXUE_AI_PRODUCTION_RESULT_UPLOAD_FAILED:${response.status}`);
  }
  const acknowledgedBodyFile = outbox.acknowledge(queued.requestId);
  if (acknowledgedBodyFile) await rm(acknowledgedBodyFile, { force: true });
  return contentHash;
}

const terminalWrite = async (
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  status: "completed" | "failed" | "review_required" | "cancelled",
  payload: unknown,
  objectReceipts: readonly `sha256:${string}`[],
): Promise<void> => {
  const requestId = `aipterminal_${randomUUID()}`;
  const body = {
    schema_version: "xuanxue-ai-terminal-cas.v6", control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId, idempotency_key: requestId,
    job_id: job.job_id, fence_hash: job.grant.execution_fence.fence_hash,
    worker_session_id: session.workerSessionId, worker_session_epoch: session.workerSessionEpoch,
    attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
    terminal_status: status, payload_hash: hashCanonical(payload),
    result_object_receipts: [...objectReceipts],
  } as const;
  await sendOutboxJson(session, outbox, {
    requestId, jobId: job.job_id, writeKind: status === "cancelled" ? "cancel" : "terminal",
    method: "POST", pathname: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/terminal`,
    headers: {}, body, bodyFile: null, payloadHash: hashCanonical(body),
  });
};

export async function completeXuanxueAiProductionJob(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  result: XuanxueAiProductionResult,
): Promise<void> {
  const receipts = [
    hashCanonical(result),
    ...result.stages.flatMap((stage) => stage.artifact?.sha256 ? [stage.artifact.sha256] : []),
  ];
  await terminalWrite(session, outbox, job, "completed", result, receipts);
}

export async function cancelXuanxueAiProductionJob(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  await terminalWrite(session, outbox, job, "cancelled", payload, []);
}

export async function failXuanxueAiProductionJob(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly status: "recovery_pending" | "review_required" | "failed";
    readonly code: string; readonly reason: string; readonly recoverable: boolean;
    readonly localOrderId?: string;
  },
): Promise<void> {
  if (input.recoverable || input.status === "recovery_pending") {
    await checkpointXuanxueAiProductionJob(session, outbox, job, {
      status: "recovery_pending", ...(input.localOrderId ? { localOrderId: input.localOrderId } : {}),
      failureReason: `${input.code}:${input.reason}`,
    });
    return;
  }
  await terminalWrite(session, outbox, job, input.status === "review_required" ? "review_required" : "failed", input, []);
}
