import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
  XuanxueAiProductionCloudClaimedJobSchema,
  type XuanxueAiProductionCloudClaimedJob,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
} from "./xuanxue-ai-production-localization-contract.js";
import type { XuanxueAiProductionResult } from "./xuanxue-ai-production.schema.js";
import { readFile } from "node:fs/promises";

interface UploadedOutputArtifact {
  readonly artifact_id: string;
  readonly object_ref: string;
  readonly sha256: `sha256:${string}`;
  readonly mime_type: "image/webp";
  readonly byte_count: number;
  readonly width: 1200;
  readonly height: 630;
  readonly state: "staged";
}

export interface XuanxueAiProductionAttachmentCheckpointProof {
  readonly stage_id: string;
  readonly upload_attempt_id: string;
  readonly status: "skipped" | "attachments_stable" | "failed" | "review_required";
  readonly expected_count: number;
  readonly detected_count: number;
  readonly current_file_name: string | null;
  readonly staging_manifest_hash: `sha256:${string}` | null;
  readonly observed_at: string;
}

interface JsonEnvelope<T> {
  readonly ok?: boolean;
  readonly data?: T;
  readonly error?: { readonly code?: string; readonly message?: string };
}

export interface XuanxueAiProductionCloudDeviceAttestation {
  readonly device_id: string;
  readonly max_in_flight: number;
  readonly status: "active" | "revoked";
  readonly last_heartbeat_at: string | null;
  readonly contract_manifest_hash: `sha256:${string}` | null;
  readonly supported_product_contracts: Readonly<Record<string, string>>;
  readonly agent_build_fingerprint: string | null;
}

export interface XuanxueAiProductionCloudTerminalStatus {
  readonly job_id: string;
  readonly status: string;
}

const baseUrl = (
  credential: XuanxueAiProductionCloudCredential,
): string => credential.server_base_url.replace(/\/+$/u, "");

const agentBuildFingerprint = (): string =>
  process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim()
  || process.env.npm_package_version?.trim()
  || "grasseye-localization-contract-v1";

export const xuanxueAiProductionDeviceContractProof = (
  sourceFingerprint = agentBuildFingerprint(),
) => ({
  contract_manifest_hash: XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
  supported_product_contracts: XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
  agent_build_fingerprint: sourceFingerprint,
});

async function cloudRequest<T>(
  credential: XuanxueAiProductionCloudCredential,
  pathname: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl(credential)}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${credential.credential}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json() as JsonEnvelope<T>;
  if (!response.ok || body.ok !== true || body.data === undefined) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_CLOUD_API_FAILED:`
      + `${body.error?.code ?? response.status}:`
      + `${body.error?.message ?? "unknown"}`,
    );
  }
  return body.data;
}

const leaseHeaders = (
  job: XuanxueAiProductionCloudClaimedJob,
): Record<string, string> => ({
  "x-ai-lease-token": job.lease_token,
  "x-ai-lease-version": String(job.lease_version),
  "x-ai-attempt-id": job.grant.attempt_id,
  "x-ai-execution-fence-hash": job.grant.execution_fence.fence_hash,
});

export async function heartbeatXuanxueAiProductionDevice(
  credential: XuanxueAiProductionCloudCredential,
  sourceFingerprint?: string,
): Promise<XuanxueAiProductionCloudDeviceAttestation> {
  return cloudRequest<XuanxueAiProductionCloudDeviceAttestation>(
    credential,
    "/internal/ai-production/devices/heartbeat",
    {
      method: "POST",
      body: JSON.stringify(xuanxueAiProductionDeviceContractProof(sourceFingerprint)),
    },
  );
}

export async function readXuanxueAiProductionCloudTerminalStatus(
  credential: XuanxueAiProductionCloudCredential,
  jobId: string,
): Promise<XuanxueAiProductionCloudTerminalStatus> {
  if (!jobId.trim()) throw new Error("XUANXUE_AI_PRODUCTION_ATTESTATION_JOB_ID_INVALID");
  return cloudRequest<XuanxueAiProductionCloudTerminalStatus>(
    credential,
    `/internal/ai-production/jobs/${encodeURIComponent(jobId)}/device-status`,
    { method: "GET" },
  );
}

const claimFailureReason = (error: unknown): string => {
  if (error && typeof error === "object" && "issues" in error) {
    try {
      return JSON.stringify((error as { issues?: unknown }).issues).slice(0, 900);
    } catch {
      return "claim schema validation failed";
    }
  }
  return (error instanceof Error ? error.message : String(error)).slice(0, 900);
};

const reportUnaddressableClaim = (raw: unknown, error: unknown): void => {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  process.stderr.write(`${JSON.stringify({
    level: "error",
    owner: "xuanxue-ai-production",
    code: "XUANXUE_AI_PRODUCTION_CLAIM_ENVELOPE_INVALID",
    job_id: typeof record.job_id === "string" ? record.job_id : null,
    product_id: typeof record.product_id === "string" ? record.product_id : null,
    contract_manifest_hash:
      typeof record.contract_manifest_hash === "string"
        ? record.contract_manifest_hash : null,
    product_contract_hash:
      typeof record.product_contract_hash === "string"
        ? record.product_contract_hash : null,
    reason: claimFailureReason(error),
    at: new Date().toISOString(),
  })}\n`);
};

export async function claimXuanxueAiProductionJobs(
  credential: XuanxueAiProductionCloudCredential,
  limit: number,
): Promise<XuanxueAiProductionCloudClaimedJob[]> {
  if (!Number.isInteger(limit) || limit < 1) return [];
  const result = await cloudRequest<{ readonly jobs?: readonly unknown[] }>(
    credential,
    "/internal/ai-production/jobs/claim",
    {
      method: "POST",
      body: JSON.stringify({
        limit: Math.min(limit, credential.max_in_flight),
      }),
    },
  );
  const accepted: XuanxueAiProductionCloudClaimedJob[] = [];
  for (const rawJob of result.jobs ?? []) {
    const parsed = XuanxueAiProductionCloudClaimedJobSchema.safeParse(rawJob);
    if (parsed.success) {
      accepted.push(parsed.data);
      continue;
    }
    // A malformed V5 grant is not an authority to call any lifecycle endpoint.
    // The Cloud lease expires into its own recovery path; the Worker never
    // manufactures a partial terminal request from an old envelope.
    reportUnaddressableClaim(rawJob, parsed.error);
  }
  return accepted;
}

export async function downloadXuanxueAiProductionInput(
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
  stageId: string,
  inputId: string,
): Promise<Uint8Array> {
  const response = await fetch(
    `${baseUrl(credential)}/internal/ai-production/jobs/`
    + `${encodeURIComponent(job.job_id)}/materials/`
    + `${encodeURIComponent(stageId)}/inputs/${encodeURIComponent(inputId)}`,
    {
      headers: {
        authorization: `Bearer ${credential.credential}`,
        ...leaseHeaders(job),
      },
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_INPUT_DOWNLOAD_FAILED:${response.status}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function downloadXuanxueAiProductionParentReplayInput(
  credential: XuanxueAiProductionCloudCredential,
  child: XuanxueAiProductionCloudClaimedJob,
  stageId: string,
  inputId: string,
): Promise<Uint8Array> {
  const response = await fetch(
    `${baseUrl(credential)}/internal/ai-production/jobs/`
    + `${encodeURIComponent(child.job_id)}/continuation-parent/materials/`
    + `${encodeURIComponent(stageId)}/inputs/${encodeURIComponent(inputId)}`,
    {
      headers: {
        authorization: `Bearer ${credential.credential}`,
        ...leaseHeaders(child),
      },
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_INPUT_DOWNLOAD_FAILED:"
      + response.status,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function uploadXuanxueAiProductionOutputArtifact(
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly stageId: "article_image_generation";
    readonly artifactId: string;
    readonly filePath: string;
    readonly sha256: `sha256:${string}`;
    readonly originalSha256: `sha256:${string}`;
    readonly executionId: string;
    readonly providerOutputRef: string;
    readonly checkpointProofRef: string;
    readonly byteCount: number;
  },
): Promise<UploadedOutputArtifact> {
  const bytes = await readFile(input.filePath);
  if (bytes.byteLength !== input.byteCount) {
    throw new Error("XUANXUE_AI_PRODUCTION_OUTPUT_LOCAL_BYTES_CHANGED");
  }
  const response = await fetch(
    `${baseUrl(credential)}/internal/ai-production/jobs/`
    + `${encodeURIComponent(job.job_id)}/artifacts/`
    + `${encodeURIComponent(input.stageId)}/${encodeURIComponent(input.artifactId)}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${credential.credential}`,
        ...leaseHeaders(job),
        "content-type": "image/webp",
        "x-ai-content-sha256": input.sha256,
        "x-ai-original-sha256": input.originalSha256,
        "x-ai-execution-id": input.executionId,
        "x-ai-provider-output-ref": input.providerOutputRef,
        "x-ai-checkpoint-proof-ref": input.checkpointProofRef,
        "x-ai-content-bytes": String(input.byteCount),
      },
      body: bytes,
      signal: AbortSignal.timeout(120_000),
    },
  );
  const body = await response.json() as JsonEnvelope<UploadedOutputArtifact>;
  if (!response.ok || body.ok !== true || !body.data) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_OUTPUT_UPLOAD_FAILED:${body.error?.code ?? response.status}`,
    );
  }
  return body.data;
}

export async function heartbeatXuanxueAiProductionJob(
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-production/jobs/${encodeURIComponent(job.job_id)}/heartbeat`,
    { method: "POST", headers: leaseHeaders(job), body: "{}" },
  );
}

export async function checkpointXuanxueAiProductionJob(
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly status:
      | "inputs_downloading"
      | "factory_running"
      | "recovery_pending";
    readonly localOrderId?: string;
    readonly failureReason?: string;
    readonly attachmentUploadProof?: XuanxueAiProductionAttachmentCheckpointProof;
  },
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-production/jobs/${encodeURIComponent(job.job_id)}/checkpoints`,
    {
      method: "POST",
      body: JSON.stringify({
        protocol_version:
          XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
        lease_token: job.lease_token,
        lease_version: job.lease_version,
        attempt_id: job.grant.attempt_id,
        execution_fence_hash: job.grant.execution_fence.fence_hash,
        idempotency_key:
          `${job.job_id}:lease:${job.lease_version}:${input.status}`
          + (input.attachmentUploadProof
            ? `:attachment:${input.attachmentUploadProof.stage_id}:${input.attachmentUploadProof.upload_attempt_id}`
            : ""),
        status: input.status,
        local_order_id: input.localOrderId ?? null,
        failure_reason: input.failureReason ?? null,
        attachment_upload_proof: input.attachmentUploadProof ?? null,
      }),
    },
  );
}

export async function completeXuanxueAiProductionJob(
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
  result: XuanxueAiProductionResult,
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-production/jobs/${encodeURIComponent(job.job_id)}/result`,
    {
      method: "POST",
      body: JSON.stringify({
        protocol_version:
          XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
        lease_token: job.lease_token,
        lease_version: job.lease_version,
        attempt_id: job.grant.attempt_id,
        execution_fence_hash: job.grant.execution_fence.fence_hash,
        idempotency_key:
          `${job.job_id}:completed:${result.requestHash}`,
        result_json: result,
      }),
    },
  );
}

export async function failXuanxueAiProductionJob(
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
  input: {
    readonly status: "recovery_pending" | "review_required" | "failed";
    readonly code: string;
    readonly reason: string;
    readonly recoverable: boolean;
    readonly localOrderId?: string;
  },
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-production/jobs/${encodeURIComponent(job.job_id)}/failure`,
    {
      method: "POST",
      body: JSON.stringify({
        protocol_version:
          XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
        lease_token: job.lease_token,
        lease_version: job.lease_version,
        attempt_id: job.grant.attempt_id,
        execution_fence_hash: job.grant.execution_fence.fence_hash,
        idempotency_key:
          `${job.job_id}:lease:${job.lease_version}:failure:${input.code}`,
        status: input.status,
        code: input.code,
        reason: input.reason,
        recoverable: input.recoverable,
        local_order_id: input.localOrderId ?? null,
      }),
    },
  );
}
