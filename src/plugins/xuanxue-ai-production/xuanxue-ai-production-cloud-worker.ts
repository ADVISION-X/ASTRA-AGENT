import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";
import {
  checkpointXuanxueAiProductionJob,
  claimXuanxueAiProductionJobs,
  completeXuanxueAiProductionJob,
  failXuanxueAiProductionJob,
  heartbeatXuanxueAiProductionDevice,
  heartbeatXuanxueAiProductionJob,
  recoverXuanxueAiProductionJob,
  uploadXuanxueAiProductionOutputArtifact,
} from "./xuanxue-ai-production-cloud-client.js";
import type {
  XuanxueAiProductionCloudClaimedJob,
  XuanxueAiProductionCloudCredential,
  XuanxueAiProductionCloudWorkerHandle,
} from "./xuanxue-ai-production-cloud-contract.js";
import { readXuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-credential.js";
import {
  cleanXuanxueAiProductionCloudStaging,
  stageXuanxueAiProductionCloudJob,
} from "./xuanxue-ai-production-cloud-staging.js";

interface XuanxueAiProductionExecutionPort {
  createOrder(input: unknown): XuanxueAiOrderRecord;
  executeOrder(orderId: string): Promise<XuanxueAiOrderRecord>;
  listCloudRecoveryOrders(): XuanxueAiOrderRecord[];
  repairCompletedCheckpointProviderProofs(): Promise<number>;
  quarantineForeignCloudRecoveryOrder(
    orderId: string,
    reason: string,
  ): XuanxueAiOrderRecord;
  cancelCloudRecoveryOrder(
    orderId: string,
    reason: string,
  ): XuanxueAiOrderRecord;
  availableCapacity(): number;
}

interface WorkerState {
  readonly abort: AbortController;
  readonly active: Map<string, Promise<void>>;
  readonly credential: XuanxueAiProductionCloudCredential;
  readonly dataDir: string;
  readonly execution: XuanxueAiProductionExecutionPort;
  readonly reconciledLocalOrders: Set<string>;
  lastDeviceHeartbeatAt: number;
}

type StagedCloudJob = Awaited<ReturnType<
  typeof stageXuanxueAiProductionCloudJob
>>;

type ResultStage = NonNullable<XuanxueAiOrderRecord["result"]>["stages"][number];

const pollIntervalMs = (): number => {
  const value = Number(
    process.env.XUANXUE_AI_PRODUCTION_POLL_INTERVAL_MS,
  );
  return Number.isFinite(value) && value >= 1_000 && value <= 60_000
    ? value
    : 5_000;
};

const wait = async (ms: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = (): void => {
      clearTimeout(timer);
      finish();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const safeReason = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
).slice(0, 1_000);

const reportWorkerError = (code: string, error: unknown): void => {
  process.stderr.write(`${JSON.stringify({
    level: "error",
    owner: "xuanxue-ai-production",
    code,
    reason_code: safeReason(error).split(":").slice(0, 2).join(":"),
    at: new Date().toISOString(),
  })}\n`);
};

const executeReplayOrder = async (
  execution: Pick<
    XuanxueAiProductionExecutionPort,
    "createOrder" | "executeOrder"
  >,
  order: StagedCloudJob["parentReplayDependencies"][number],
): Promise<void> => {
  execution.createOrder(order);
  const completed = await execution.executeOrder(order.orderId);
  if (completed.status !== "completed") {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_DEPENDENCY_INCOMPLETE:"
      + `${order.productId}:${order.orderId}:`
      + `${completed.failureReason ?? completed.status}`,
    );
  }
};

export const executeXuanxueAiProductionCloudReplayGraph = async (
  execution: Pick<
    XuanxueAiProductionExecutionPort,
    "createOrder" | "executeOrder"
  >,
  staged: Pick<
    StagedCloudJob,
    "parentReplay" | "parentReplayDependencies"
  >,
): Promise<void> => {
  for (const dependency of staged.parentReplayDependencies) {
    await executeReplayOrder(execution, dependency);
  }
  if (staged.parentReplay) {
    await executeReplayOrder(execution, staged.parentReplay);
  }
};

const heartbeatUntilSettled = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  execution: Promise<XuanxueAiOrderRecord>,
): Promise<XuanxueAiOrderRecord> => {
  let settled = false;
  const tracked = execution.finally(() => {
    settled = true;
  });
  while (!settled && !state.abort.signal.aborted) {
    await Promise.race([
      tracked,
      wait(20_000, state.abort.signal),
    ]);
    if (!settled && !state.abort.signal.aborted) {
      await heartbeatXuanxueAiProductionJob(state.credential, job);
    }
  }
  return tracked;
};

const uploadGeneratedImageStage = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  stage: ResultStage,
): Promise<ResultStage> => {
  if (stage.outputKind !== "generated_image") return stage;
  if (!stage.artifact?.localFilePath) {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_LOCAL_FILE_MISSING");
  }
  if (!stage.artifact.checkpointProofRef) {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_CHECKPOINT_PROOF_MISSING");
  }
  const artifactId = `aiart_${job.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-80)}_${stage.artifact.sha256.slice(-16)}`;
  const uploaded = await uploadXuanxueAiProductionOutputArtifact(
    state.credential,
    job,
    {
      stageId: "article_image_generation", artifactId,
      filePath: stage.artifact.localFilePath, sha256: stage.artifact.sha256,
      originalSha256: stage.artifact.originalSha256,
      executionId: stage.executionId,
      providerOutputRef: stage.artifact.providerOutputRef,
      checkpointProofRef: stage.artifact.checkpointProofRef,
      byteCount: stage.artifact.byteCount,
    },
  );
  return {
    ...stage,
    artifact: {
      artifactId: uploaded.artifact_id, role: "generated_image",
      objectRef: uploaded.object_ref, sha256: uploaded.sha256,
      originalSha256: stage.artifact.originalSha256,
      providerOutputRef: stage.artifact.providerOutputRef,
      checkpointProofRef: stage.artifact.checkpointProofRef,
      mimeType: uploaded.mime_type, byteCount: uploaded.byte_count,
      width: uploaded.width, height: uploaded.height,
    },
  };
};

const publishOrder = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  record: XuanxueAiOrderRecord,
): Promise<void> => {
  if (record.status === "completed" && record.result) {
    const stages = await Promise.all(record.result.stages.map(
      (stage) => uploadGeneratedImageStage(state, job, stage),
    ));
    const publishableResult = { ...record.result, stages };
    await completeXuanxueAiProductionJob(
      state.credential,
      job,
      publishableResult,
    );
    await cleanXuanxueAiProductionCloudStaging(
      state.dataDir,
      job.job_id,
    );
    return;
  }
  const recoverable = record.status === "recovery_pending";
  await failXuanxueAiProductionJob(state.credential, job, {
    status: recoverable
      ? "recovery_pending"
      : record.status === "review_required"
        ? "review_required"
        : "failed",
    code: recoverable
      ? "XUANXUE_AI_PRODUCTION_LOCAL_RECOVERY_PENDING"
      : record.status === "review_required"
        ? "XUANXUE_AI_PRODUCTION_LOCAL_REVIEW_REQUIRED"
        : "XUANXUE_AI_PRODUCTION_LOCAL_FAILED",
    reason:
      record.failureReason
      ?? "local factory ended without a complete result",
    recoverable,
    localOrderId: record.order.orderId,
  });
};

const executeCloudJob = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
): Promise<void> => {
  let localOrderId: string | undefined;
  try {
    await checkpointXuanxueAiProductionJob(state.credential, job, {
      status: "inputs_downloading",
    });
    const staged = await stageXuanxueAiProductionCloudJob(
      state.dataDir,
      state.credential,
      job,
    );
    await executeXuanxueAiProductionCloudReplayGraph(
      state.execution,
      staged,
    );
    const created = state.execution.createOrder(staged.order);
    localOrderId = created.order.orderId;
    await checkpointXuanxueAiProductionJob(state.credential, job, {
      status: "factory_running",
      localOrderId,
    });
    const terminal = await heartbeatUntilSettled(
      state,
      job,
      state.execution.executeOrder(localOrderId),
    );
    await publishOrder(state, job, terminal);
  } catch (error) {
    const reason = safeReason(error);
    const recoverable =
      /CLOUD_API_FAILED|INPUT_DOWNLOAD_FAILED|RECOVERY|WORKER_STOPPED|network|fetch failed/iu
        .test(reason);
    try {
      await failXuanxueAiProductionJob(state.credential, job, {
        status: recoverable ? "recovery_pending" : "failed",
        code: recoverable
          ? "XUANXUE_AI_PRODUCTION_CLOUD_TRANSIENT"
          : "XUANXUE_AI_PRODUCTION_CLOUD_FAILED",
        reason,
        recoverable,
        ...(localOrderId ? { localOrderId } : {}),
      });
    } catch (reportError) {
      reportWorkerError(
        "XUANXUE_AI_PRODUCTION_FAILURE_REPORT_DEFERRED",
        reportError,
      );
    }
  }
};

const reconcileDurableLocalOrders = async (
  state: WorkerState,
): Promise<void> => {
  await state.execution.repairCompletedCheckpointProviderProofs();
  for (const record of state.execution.listCloudRecoveryOrders()) {
    const orderId = record.order.orderId;
    if (
      state.reconciledLocalOrders.has(orderId)
      || state.active.has(orderId)
    ) continue;
    try {
      const recovered = await recoverXuanxueAiProductionJob(
        state.credential,
        {
          orderId,
          sourceTaskId: record.order.sourceTaskId,
          requestHash: record.order.requestHash,
          completedResult:
            record.status === "completed" && record.result
              ? record.result
              : null,
        },
      );
      state.reconciledLocalOrders.add(orderId);
      if (recovered.status === "cancelled") {
        state.execution.cancelCloudRecoveryOrder(
          orderId,
          "cloud recovery endpoint returned terminal cancelled",
        );
        continue;
      }
      if (recovered.status === "completed") {
        await cleanXuanxueAiProductionCloudStaging(
          state.dataDir,
          orderId,
        );
      }
    } catch (error) {
      const reason = safeReason(error);
      const foreignLedger = reason.includes(
        "AI_PRODUCTION_LOCAL_RECOVERY_DEVICE_MISMATCH",
      );
      if (foreignLedger) {
        state.execution.quarantineForeignCloudRecoveryOrder(orderId, reason);
        state.reconciledLocalOrders.add(orderId);
      }
      reportWorkerError(
        foreignLedger
          ? "XUANXUE_AI_PRODUCTION_FOREIGN_LEDGER_SKIPPED"
          : "XUANXUE_AI_PRODUCTION_LEDGER_RECOVERY_RETRY",
        error,
      );
    }
  }
};

const workerLoop = async (state: WorkerState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    try {
      if (Date.now() - state.lastDeviceHeartbeatAt >= 30_000) {
        await heartbeatXuanxueAiProductionDevice(state.credential);
        state.lastDeviceHeartbeatAt = Date.now();
      }
      await reconcileDurableLocalOrders(state);
      const available = Math.min(
        state.execution.availableCapacity(),
        state.credential.max_in_flight - state.active.size,
      );
      const jobs = available > 0
        ? await claimXuanxueAiProductionJobs(state.credential, available)
        : [];
      for (const job of jobs) {
        if (state.active.has(job.job_id)) continue;
        const tracked = executeCloudJob(state, job).finally(() => {
          state.active.delete(job.job_id);
        });
        state.active.set(job.job_id, tracked);
      }
    } catch (error) {
      reportWorkerError("XUANXUE_AI_PRODUCTION_POLL_RETRY", error);
    }
    await wait(pollIntervalMs(), state.abort.signal);
  }
};

export async function startXuanxueAiProductionCloudWorker(input: {
  readonly dataDir: string;
  readonly execution: XuanxueAiProductionExecutionPort;
}): Promise<XuanxueAiProductionCloudWorkerHandle> {
  const credential = await readXuanxueAiProductionCloudCredential(
    input.dataDir,
  );
  const configuredBase =
    process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL
      ?.trim()
      .replace(/\/+$/u, "");
  if (
    configuredBase
    && configuredBase !== credential.server_base_url.replace(/\/+$/u, "")
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_SERVER_BINDING_MISMATCH");
  }
  const state: WorkerState = {
    abort: new AbortController(),
    active: new Map(),
    credential,
    dataDir: input.dataDir,
    execution: input.execution,
    reconciledLocalOrders: new Set(),
    lastDeviceHeartbeatAt: 0,
  };
  const loop = workerLoop(state);
  return {
    async close() {
      state.abort.abort();
      await loop;
      await Promise.allSettled([...state.active.values()]);
    },
  };
}
