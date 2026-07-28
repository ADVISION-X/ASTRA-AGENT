import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  XuanxueAiProductionCloudClaimedJobSchema,
  type XuanxueAiProductionCloudClaimedJob,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionResult } from "./xuanxue-ai-production.schema.js";

interface JsonEnvelope<T> {
  readonly ok?: boolean;
  readonly data?: T;
  readonly error?: { readonly code?: string; readonly message?: string };
}

const baseUrl = (
  credential: XuanxueAiProductionCloudCredential,
): string => credential.server_base_url.replace(/\/+$/u, "");

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
});

export async function heartbeatXuanxueAiProductionDevice(
  credential: XuanxueAiProductionCloudCredential,
): Promise<void> {
  await cloudRequest(
    credential,
    "/internal/ai-production/devices/heartbeat",
    { method: "POST", body: "{}" },
  );
}

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
  return (result.jobs ?? []).map((job) =>
    XuanxueAiProductionCloudClaimedJobSchema.parse(job));
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
        idempotency_key:
          `${job.job_id}:lease:${job.lease_version}:${input.status}`,
        status: input.status,
        local_order_id: input.localOrderId ?? null,
        failure_reason: input.failureReason ?? null,
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
