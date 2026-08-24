import { randomUUID } from "node:crypto";

import {
  checkpointXuanxueAiProductionJob,
  hashXuanxueAiProductionCloudPayload,
  sendXuanxueAiProductionOutboxJson,
} from "./xuanxue-ai-production-cloud-client.js";
import type { XuanxueAiProductionCloudClaimedJob } from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionCloudOutbox } from "./xuanxue-ai-production-cloud-outbox.js";
import type { XuanxueAiProductionWorkerSessionV6 } from "./xuanxue-ai-production-worker-session.js";
import type { XuanxueAiProductionResult } from "./xuanxue-ai-production.schema.js";

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
    terminal_status: status, payload_hash: hashXuanxueAiProductionCloudPayload(payload),
    result_object_receipts: [...objectReceipts],
  } as const;
  await sendXuanxueAiProductionOutboxJson(session, outbox, {
    requestId, jobId: job.job_id, writeKind: status === "cancelled" ? "cancel" : "terminal",
    method: "POST", pathname: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/terminal`,
    headers: {}, body, bodyFile: null, payloadHash: hashXuanxueAiProductionCloudPayload(body),
  });
};

export async function completeXuanxueAiProductionJob(
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
  job: XuanxueAiProductionCloudClaimedJob,
  result: XuanxueAiProductionResult,
): Promise<void> {
  const receipts = [
    hashXuanxueAiProductionCloudPayload(result),
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
