import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";
import {
  checkpointXuanxueAiProductionJob,
  claimXuanxueAiProductionJobs,
  failXuanxueAiProductionJob,
  heartbeatXuanxueAiProductionDevice,
  heartbeatXuanxueAiProductionJob,
  recoverXuanxueAiProductionJob,
} from "./xuanxue-ai-production-cloud-client.js";
import type {
  XuanxueAiProductionCloudClaimedJob,
  XuanxueAiProductionCloudCredential,
  XuanxueAiProductionCloudWorkerHandle,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
} from "./xuanxue-ai-production-localization-contract.js";
import { readXuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-credential.js";
import {
  publishXuanxueAiProductionCloudOrder,
  toXuanxueAiProductionAttachmentCheckpoint,
} from "./xuanxue-ai-production-cloud-publication.js";
import {
  cleanXuanxueAiProductionCloudStaging,
  stageXuanxueAiProductionCloudJob,
} from "./xuanxue-ai-production-cloud-staging.js";

interface XuanxueAiProductionExecutionPort {
  createOrder(input: unknown): XuanxueAiOrderRecord;
  executeOrder(
    orderId: string,
    observer?: import("./xuanxue-ai-production.flow.js").XuanxueAiProductionExecutionObserver,
  ): Promise<XuanxueAiOrderRecord>;
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

export interface XuanxueAiProductionWorkerHealth {
  readonly status: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly contractManifestHash: `sha256:${string}`;
  readonly activeCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
}

interface WorkerState {
  readonly abort: AbortController;
  readonly active: Map<string, Promise<void>>;
  readonly credential: XuanxueAiProductionCloudCredential;
  readonly dataDir: string;
  readonly execution: XuanxueAiProductionExecutionPort;
  readonly reconciledLocalOrders: Set<string>;
  readonly onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
  lastDeviceHeartbeatAt: number;
  lastSuccessfulHeartbeatAt: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  healthStatus: XuanxueAiProductionWorkerHealth["status"];
}

type StagedCloudJob = Awaited<ReturnType<
  typeof stageXuanxueAiProductionCloudJob
>>;

const currentHealth = (state: WorkerState): XuanxueAiProductionWorkerHealth => ({
  status: state.healthStatus,
  contractManifestHash: XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  activeCount: state.active.size,
  lastSuccessfulHeartbeatAt: state.lastSuccessfulHeartbeatAt,
  lastErrorCode: state.lastErrorCode,
  lastErrorReason: state.lastErrorReason,
  checkedAt: new Date().toISOString(),
});

const publishHealth = (state: WorkerState): void => {
  state.onStatus?.(currentHealth(state));
};

const markWorkerReady = (state: WorkerState): void => {
  state.healthStatus = "ready";
  state.lastErrorCode = null;
  state.lastErrorReason = null;
  publishHealth(state);
};

const safeReason = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
).slice(0, 1_000);

const errorCode = (error: unknown): string =>
  safeReason(error).split(":").slice(0, 2).join(":");

const contractFailure = (error: unknown): boolean =>
  /(?:CONTRACT|MANIFEST|LOCALIZATION_.*PROFILE|PRODUCT_CONTRACT)/iu.test(
    safeReason(error),
  );

const markWorkerError = (state: WorkerState, error: unknown): void => {
  state.healthStatus = contractFailure(error)
    ? "contract_blocked"
    : "transient_degraded";
  state.lastErrorCode = errorCode(error);
  state.lastErrorReason = safeReason(error);
  publishHealth(state);
};

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

const reportWorkerError = (code: string, error: unknown): void => {
  process.stderr.write(`${JSON.stringify({
    level: "error",
    owner: "xuanxue-ai-production",
    code,
    reason_code: errorCode(error),
    contract_manifest_hash: XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
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

const checkpointAttachmentUpload = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  localOrderId: string | undefined,
  input: {
    readonly stageId: string;
    readonly proof: NonNullable<XuanxueAiOrderRecord["stages"][number]["attachmentUploadProof"]>;
  },
): Promise<void> => {
  try {
    await checkpointXuanxueAiProductionJob(state.credential, job, {
      status: "factory_running",
      ...(localOrderId ? { localOrderId } : {}),
      attachmentUploadProof: toXuanxueAiProductionAttachmentCheckpoint(input),
    });
  } catch (error) {
    reportWorkerError(
      "XUANXUE_AI_PRODUCTION_ATTACHMENT_CHECKPOINT_DEFERRED",
      error,
    );
  }
};

const executeCloudJobStages = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  onLocalOrderId: (orderId: string) => void,
): Promise<XuanxueAiOrderRecord> => {
  const staged = await stageXuanxueAiProductionCloudJob(
    state.dataDir,
    state.credential,
    job,
  );
  await executeXuanxueAiProductionCloudReplayGraph(state.execution, staged);
  const created = state.execution.createOrder(staged.order);
  onLocalOrderId(created.order.orderId);
  await checkpointXuanxueAiProductionJob(state.credential, job, {
    status: "factory_running",
    localOrderId: created.order.orderId,
  });
  return heartbeatUntilSettled(
    state,
    job,
    state.execution.executeOrder(created.order.orderId, {
      onAttachmentUploadCompleted: async ({ stageId, proof }) =>
        checkpointAttachmentUpload(state, job, created.order.orderId, { stageId, proof }),
    }),
  );
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
    const terminal = await executeCloudJobStages(state, job, (orderId) => {
      localOrderId = orderId;
    });
    await publishXuanxueAiProductionCloudOrder({
      credential: state.credential,
      dataDir: state.dataDir,
      job,
      record: terminal,
    });
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
        state.lastSuccessfulHeartbeatAt = new Date().toISOString();
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
          publishHealth(state);
        });
        state.active.set(job.job_id, tracked);
      }
      markWorkerReady(state);
    } catch (error) {
      markWorkerError(state, error);
      reportWorkerError("XUANXUE_AI_PRODUCTION_POLL_RETRY", error);
    }
    await wait(pollIntervalMs(), state.abort.signal);
  }
};

export async function startXuanxueAiProductionCloudWorker(input: {
  readonly dataDir: string;
  readonly execution: XuanxueAiProductionExecutionPort;
  readonly onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
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
  // The first heartbeat is a semantic contract handshake. Startup must fail
  // immediately on a manifest/product mismatch instead of entering a poll storm.
  await heartbeatXuanxueAiProductionDevice(credential);
  const heartbeatAt = new Date().toISOString();
  const state: WorkerState = {
    abort: new AbortController(),
    active: new Map(),
    credential,
    dataDir: input.dataDir,
    execution: input.execution,
    reconciledLocalOrders: new Set(),
    ...(input.onStatus ? { onStatus: input.onStatus } : {}),
    lastDeviceHeartbeatAt: Date.now(),
    lastSuccessfulHeartbeatAt: heartbeatAt,
    lastErrorCode: null,
    lastErrorReason: null,
    healthStatus: "ready",
  };
  publishHealth(state);
  const loop = workerLoop(state);
  return {
    async close() {
      state.abort.abort();
      await loop;
      await Promise.allSettled([...state.active.values()]);
      state.healthStatus = "stopped";
      publishHealth(state);
    },
  };
}
