import {
  XuanyuanCloudClaimedJobSchema,
  XUANYUAN_CLOUD_PROTOCOL_VERSION,
  type XuanyuanCloudClaimedJob,
  type XuanyuanCloudCredential,
} from "./xuanyuan-cloud-contract.js";

type JsonEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

function baseUrl(credential: XuanyuanCloudCredential): string {
  return credential.server_base_url.replace(/\/+$/u, "");
}

async function cloudRequest<T>(
  credential: XuanyuanCloudCredential,
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
      `XUANYUAN_CLOUD_API_FAILED:${body.error?.code ?? response.status}:${body.error?.message ?? "unknown"}`,
    );
  }
  return body.data;
}

export async function heartbeatXuanyuanCloudDevice(
  credential: XuanyuanCloudCredential,
): Promise<void> {
  await cloudRequest(credential, "/internal/ai-acceptance/devices/heartbeat", {
    method: "POST",
    body: "{}",
  });
}

export async function claimXuanyuanCloudJobs(
  credential: XuanyuanCloudCredential,
): Promise<XuanyuanCloudClaimedJob[]> {
  const result = await cloudRequest<{ jobs?: unknown[] }>(
    credential,
    "/internal/ai-acceptance/jobs/claim",
    {
      method: "POST",
      body: JSON.stringify({ limit: credential.max_in_flight }),
    },
  );
  return (result.jobs ?? []).map((job) => XuanyuanCloudClaimedJobSchema.parse(job));
}

function leaseHeaders(job: XuanyuanCloudClaimedJob): Record<string, string> {
  return {
    "x-ai-lease-token": job.lease_token,
    "x-ai-lease-version": String(job.lease_version),
  };
}

export async function downloadXuanyuanCloudInput(
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
  inputId: string,
): Promise<Uint8Array> {
  const response = await fetch(
    `${baseUrl(credential)}/internal/ai-acceptance/jobs/${encodeURIComponent(job.job_id)}/inputs/${encodeURIComponent(inputId)}`,
    {
      headers: {
        authorization: `Bearer ${credential.credential}`,
        ...leaseHeaders(job),
      },
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    throw new Error(`XUANYUAN_CLOUD_INPUT_DOWNLOAD_FAILED:${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function heartbeatXuanyuanCloudJob(
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-acceptance/jobs/${encodeURIComponent(job.job_id)}/heartbeat`,
    { method: "POST", headers: leaseHeaders(job), body: "{}" },
  );
}

export async function checkpointXuanyuanCloudJob(
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
  input: {
    status:
      | "inputs_downloading"
      | "provider_submitting"
      | "provider_submitted"
      | "waiting_provider"
      | "response_checkpointed"
      | "result_uploading"
      | "recovery_pending";
    providerExecutionRef?: string;
    rawResponseText?: string;
    rawResponseHash?: string;
    rawResponseByteCount?: number;
    providerProof?: unknown;
  },
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-acceptance/jobs/${encodeURIComponent(job.job_id)}/checkpoints`,
    {
      method: "POST",
      body: JSON.stringify({
        protocol_version: XUANYUAN_CLOUD_PROTOCOL_VERSION,
        lease_token: job.lease_token,
        lease_version: job.lease_version,
        idempotency_key: `${job.job_id}:lease:${job.lease_version}:${input.status}:${input.rawResponseHash ?? "none"}`,
        status: input.status,
        ...(input.providerExecutionRef
          ? { provider_execution_ref: input.providerExecutionRef }
          : {}),
        ...(input.rawResponseText !== undefined
          ? { raw_response_text: input.rawResponseText }
          : {}),
        ...(input.rawResponseHash
          ? { raw_response_hash: input.rawResponseHash }
          : {}),
        ...(input.rawResponseByteCount !== undefined
          ? { raw_response_byte_count: input.rawResponseByteCount }
          : {}),
        ...(input.providerProof !== undefined
          ? { provider_proof: input.providerProof }
          : {}),
      }),
    },
  );
}

export async function completeXuanyuanCloudJob(
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
  input: {
    providerExecutionRef: string;
    rawResponseText: string;
    rawResponseHash: string;
    rawResponseByteCount: number;
    providerProof: unknown;
    providerResponse: unknown;
    transportWarnings: readonly string[];
  },
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-acceptance/jobs/${encodeURIComponent(job.job_id)}/result`,
    {
      method: "POST",
      body: JSON.stringify({
        protocol_version: XUANYUAN_CLOUD_PROTOCOL_VERSION,
        lease_token: job.lease_token,
        lease_version: job.lease_version,
        idempotency_key: `${job.job_id}:completed:${input.rawResponseHash}`,
        provider_execution_ref: input.providerExecutionRef,
        raw_response_text: input.rawResponseText,
        raw_response_hash: input.rawResponseHash,
        raw_response_byte_count: input.rawResponseByteCount,
        provider_proof: input.providerProof,
        provider_response: input.providerResponse,
        transport_warnings: input.transportWarnings,
      }),
    },
  );
}

export async function failXuanyuanCloudJob(
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
  input: {
    status: "recovery_pending" | "review_required" | "failed";
    code: string;
    reason: string;
    recoverable: boolean;
    providerExecutionRef?: string;
  },
): Promise<void> {
  await cloudRequest(
    credential,
    `/internal/ai-acceptance/jobs/${encodeURIComponent(job.job_id)}/failure`,
    {
      method: "POST",
      body: JSON.stringify({
        lease_token: job.lease_token,
        lease_version: job.lease_version,
        idempotency_key: `${job.job_id}:lease:${job.lease_version}:failure:${input.code}`,
        status: input.status,
        code: input.code,
        reason: input.reason,
        recoverable: input.recoverable,
        ...(input.providerExecutionRef
          ? { provider_execution_ref: input.providerExecutionRef }
          : {}),
      }),
    },
  );
}
