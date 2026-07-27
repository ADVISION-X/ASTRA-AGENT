import { createHash } from "node:crypto";
import type { XuanyuanTaskRecord } from "./xuanyuan.schema.js";
import type {
  XuanyuanCloudClaimedJob,
  XuanyuanCloudCredential,
  XuanyuanCloudWorkerHandle,
} from "./xuanyuan-cloud-contract.js";
import { readXuanyuanCloudCredential } from "./xuanyuan-cloud-credential.js";
import {
  checkpointXuanyuanCloudJob,
  claimXuanyuanCloudJobs,
  completeXuanyuanCloudJob,
  failXuanyuanCloudJob,
  heartbeatXuanyuanCloudDevice,
  heartbeatXuanyuanCloudJob,
} from "./xuanyuan-cloud-client.js";
import {
  cleanXuanyuanCloudJobStaging,
  stageXuanyuanCloudJob,
} from "./xuanyuan-cloud-staging.js";

interface XuanyuanCloudExecutionPort {
  enqueueTask(input: unknown): Promise<XuanyuanTaskRecord>;
  getTaskStatus(taskId: string): Promise<XuanyuanTaskRecord | null>;
}

interface WorkerState {
  abort: AbortController;
  active: Map<string, Promise<void>>;
  credential: XuanyuanCloudCredential;
  dataDir: string;
  execution: XuanyuanCloudExecutionPort;
  lastDeviceHeartbeatAt: number;
}

const terminalStatuses = new Set([
  "response_captured",
  "recovery_pending",
  "review_required",
  "failed",
]);

function reportWorkerError(code: string, error: unknown): void {
  const raw = error instanceof Error ? error.message : String(error);
  const safeReason = raw.split(":").slice(0, 2).join(":").slice(0, 240);
  process.stderr.write(`${JSON.stringify({
    level: "error",
    owner: "xuanyuan-cloud-worker",
    code,
    reason_code: safeReason,
    at: new Date().toISOString(),
  })}\n`);
}

function pollIntervalMs(): number {
  const value = Number(process.env.XUANYUAN_CLOUD_POLL_INTERVAL_MS);
  return Number.isFinite(value) && value >= 1_000 && value <= 60_000 ? value : 5_000;
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function responseHash(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function providerResponseForCloud(task: XuanyuanTaskRecord): Record<string, unknown> {
  const snapshot = task.requestSnapshot;
  const proof = task.providerProof && typeof task.providerProof === "object"
    ? {
        ...task.providerProof,
        outputRefs: [],
      }
    : task.providerProof;
  return {
    taskId: task.taskId,
    requestId: task.requestId,
    taskName: task.taskName,
    taskLabelKey: task.taskLabelKey,
    sourceProject: task.sourceProject,
    scenario: task.scenario,
    providerKind: task.providerKind,
    status: task.status,
    rawOutputHash: task.rawOutputHash,
    providerProof: proof,
    transportWarnings: task.transportWarnings,
    progress: task.progress,
    failureReason: task.failureReason,
    reviewRequiredReason: task.reviewRequiredReason,
    requestSnapshot: {
      scenario: snapshot.scenario,
      promptPackageId: snapshot.promptPackageId,
      promptContractId: snapshot.promptContractId,
      expectedOutputSchemaRef: snapshot.expectedOutputSchemaRef,
      inputRefs: snapshot.inputRefs.map((ref) => ({
        id: ref.id,
        kind: ref.kind,
        summary: ref.summary,
        fileName: ref.fileName,
        mimeType: ref.mimeType,
        sha256: ref.sha256,
        byteCount: ref.byteCount,
      })),
    },
  };
}

function checkpointStatus(
  task: XuanyuanTaskRecord,
): Parameters<typeof checkpointXuanyuanCloudJob>[2]["status"] | null {
  const phase = task.progress.phase;
  if (phase === "recovery_pending") return "recovery_pending";
  if (phase === "response_checkpointed") return "response_checkpointed";
  if (phase === "waiting_provider") {
    return "waiting_provider";
  }
  if (phase === "waiting_for_capacity" || phase === "waiting_for_submit_slot" || phase === "submitting") {
    return "provider_submitting";
  }
  return null;
}

async function sendProgressCheckpoint(
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
  task: XuanyuanTaskRecord,
  previous: string | null,
): Promise<string | null> {
  const status = checkpointStatus(task);
  if (!status || status === previous) return previous;
  const orderedStatuses = status === "waiting_provider"
    ? ["provider_submitted", "waiting_provider"] as const
    : status === "response_checkpointed"
      ? ["provider_submitted", "waiting_provider", "response_checkpointed"] as const
      : [status];
  let current = previous;
  for (const next of orderedStatuses) {
    if (next === current) continue;
    await checkpointXuanyuanCloudJob(credential, job, {
      status: next,
      providerExecutionRef: task.taskId,
      providerProof: task.providerProof,
    });
    current = next;
  }
  return current;
}

async function waitForLocalTerminal(
  state: WorkerState,
  job: XuanyuanCloudClaimedJob,
  taskId: string,
): Promise<XuanyuanTaskRecord> {
  let lastCheckpoint: string | null = null;
  let lastHeartbeatAt = 0;
  while (!state.abort.signal.aborted) {
    const task = await state.execution.getTaskStatus(taskId);
    if (!task) throw new Error("XUANYUAN_CLOUD_LOCAL_TASK_MISSING");
    lastCheckpoint = await sendProgressCheckpoint(
      state.credential,
      job,
      task,
      lastCheckpoint,
    );
    if (terminalStatuses.has(task.status)) return task;
    if (Date.now() - lastHeartbeatAt >= 20_000) {
      await heartbeatXuanyuanCloudJob(state.credential, job);
      lastHeartbeatAt = Date.now();
    }
    await wait(pollIntervalMs(), state.abort.signal);
  }
  throw new Error("XUANYUAN_CLOUD_WORKER_STOPPED");
}

async function publishTerminal(
  state: WorkerState,
  job: XuanyuanCloudClaimedJob,
  task: XuanyuanTaskRecord,
): Promise<void> {
  if (task.status === "response_captured" && task.rawResponseText && task.rawOutputHash) {
    const digest = responseHash(task.rawResponseText);
    const normalizedTaskHash = `sha256:${task.rawOutputHash.replace(/^sha256:/u, "")}`;
    if (digest !== normalizedTaskHash) {
      throw new Error("XUANYUAN_CLOUD_LOCAL_RESPONSE_HASH_MISMATCH");
    }
    await checkpointXuanyuanCloudJob(state.credential, job, {
      status: "result_uploading",
      providerExecutionRef: task.taskId,
    });
    await completeXuanyuanCloudJob(state.credential, job, {
      providerExecutionRef: task.taskId,
      rawResponseText: task.rawResponseText,
      rawResponseHash: digest,
      rawResponseByteCount: Buffer.byteLength(task.rawResponseText, "utf8"),
      providerProof: task.providerProof,
      providerResponse: providerResponseForCloud(task),
      transportWarnings: task.transportWarnings,
    });
    await cleanXuanyuanCloudJobStaging(state.dataDir, job.job_id);
    return;
  }
  const recoverable = task.status === "recovery_pending" || task.recovery.recoverable;
  await failXuanyuanCloudJob(state.credential, job, {
    status: recoverable
      ? "recovery_pending"
      : task.status === "review_required"
        ? "review_required"
        : "failed",
    code: recoverable
      ? "XUANYUAN_LOCAL_RECOVERY_PENDING"
      : task.status === "review_required"
        ? "XUANYUAN_LOCAL_REVIEW_REQUIRED"
        : "XUANYUAN_LOCAL_EXECUTION_FAILED",
    reason:
      task.failureReason
      ?? task.reviewRequiredReason
      ?? task.recovery.lastFailureReason
      ?? "local execution ended without a captured response",
    recoverable,
    providerExecutionRef: task.taskId,
  });
}

async function executeCloudJob(
  state: WorkerState,
  job: XuanyuanCloudClaimedJob,
): Promise<void> {
  try {
    await checkpointXuanyuanCloudJob(state.credential, job, {
      status: "inputs_downloading",
    });
    const request = await stageXuanyuanCloudJob(
      state.dataDir,
      state.credential,
      job,
    );
    await checkpointXuanyuanCloudJob(state.credential, job, {
      status: "provider_submitting",
    });
    const accepted = await state.execution.enqueueTask(request);
    const terminal = await waitForLocalTerminal(state, job, accepted.taskId);
    await publishTerminal(state, job, terminal);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const recoverable = /CLOUD_API_FAILED|INPUT_DOWNLOAD_FAILED|WORKER_STOPPED|RECOVERY/u.test(reason);
    try {
      await failXuanyuanCloudJob(state.credential, job, {
        status: recoverable ? "recovery_pending" : "failed",
        code: recoverable
          ? "XUANYUAN_CLOUD_TRANSIENT_FAILURE"
          : "XUANYUAN_CLOUD_EXECUTION_FAILED",
        reason,
        recoverable,
        ...(job.provider_execution_ref
          ? { providerExecutionRef: job.provider_execution_ref }
          : {}),
      });
    } catch (reportError) {
      // The cloud lease expiry reconciler preserves recoverability when reporting is unavailable.
      reportWorkerError("XUANYUAN_CLOUD_FAILURE_REPORT_DEFERRED", reportError);
    }
  }
}

async function workerLoop(state: WorkerState): Promise<void> {
  while (!state.abort.signal.aborted) {
    try {
      if (Date.now() - state.lastDeviceHeartbeatAt >= 30_000) {
        await heartbeatXuanyuanCloudDevice(state.credential);
        state.lastDeviceHeartbeatAt = Date.now();
      }
      const jobs = await claimXuanyuanCloudJobs(state.credential);
      for (const job of jobs) {
        if (state.active.has(job.job_id)) continue;
        const tracked = executeCloudJob(state, job).finally(() => {
          state.active.delete(job.job_id);
        });
        state.active.set(job.job_id, tracked);
      }
    } catch (error) {
      reportWorkerError("XUANYUAN_CLOUD_POLL_RETRY", error);
    }
    await wait(pollIntervalMs(), state.abort.signal);
  }
}

export async function startXuanyuanCloudWorker(input: {
  dataDir: string;
  execution: XuanyuanCloudExecutionPort;
}): Promise<XuanyuanCloudWorkerHandle> {
  const credential = await readXuanyuanCloudCredential(input.dataDir);
  const configuredBase = process.env.XUANYUAN_CLOUD_BASE_URL?.trim().replace(/\/+$/u, "");
  if (configuredBase && configuredBase !== credential.server_base_url.replace(/\/+$/u, "")) {
    throw new Error("XUANYUAN_CLOUD_SERVER_BINDING_MISMATCH");
  }
  const state: WorkerState = {
    abort: new AbortController(),
    active: new Map(),
    credential,
    dataDir: input.dataDir,
    execution: input.execution,
    lastDeviceHeartbeatAt: 0,
  };
  const loopPromise = workerLoop(state);
  return {
    async close() {
      state.abort.abort();
      await loopPromise;
      await Promise.allSettled([...state.active.values()]);
    },
  };
}
