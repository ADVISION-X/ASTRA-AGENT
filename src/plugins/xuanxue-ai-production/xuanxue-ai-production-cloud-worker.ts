import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";
import {
  checkpointXuanxueAiProductionJob,
  claimXuanxueAiProductionJobs,
  failXuanxueAiProductionJob,
  heartbeatXuanxueAiProductionDevice,
  heartbeatXuanxueAiProductionJob,
} from "./xuanxue-ai-production-cloud-client.js";
import {
  XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
  type
  XuanxueAiProductionCloudClaimedJob,
  XuanxueAiProductionCloudCredential,
  XuanxueAiProductionCloudWorkerHandle,
} from "./xuanxue-ai-production-cloud-contract.js";
import { readXuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-credential.js";
import {
  publishXuanxueAiProductionCloudOrder,
  toXuanxueAiProductionAttachmentCheckpoint,
} from "./xuanxue-ai-production-cloud-publication.js";
import {
  cleanXuanxueAiProductionCloudStaging,
  stageXuanxueAiProductionCloudJob,
} from "./xuanxue-ai-production-cloud-staging.js";
import {
  cleanXuanxueAiProductionGeneratedInputs,
  reconcileXuanxueAiProductionGeneratedInputOrphans,
} from "./xuanxue-ai-production-transient-lifecycle.js";
import type { XuanxueAiExecutionDeadlineBudget } from "./xuanxue-ai-production.runtime.js";
import type { CloudExecutionGrantV5 } from "./generated/xuanxue-ai-production-v5.validator.js";
import {
  cloudWorkerPollIntervalMs,
  isRecoverableCloudWorkerFailure,
  isWorkerContractFailure,
  reportCloudWorkerError,
  safeWorkerReason,
  waitForCloudWorker,
  workerErrorCode,
} from "./xuanxue-ai-production-cloud-worker-support.js";

interface XuanxueAiProductionExecutionPort {
  createOrder(input: unknown): XuanxueAiOrderRecord;
  executeOrder(
    orderId: string,
    observer?: import("./xuanxue-ai-production.flow.js").XuanxueAiProductionExecutionObserver,
    deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
  ): Promise<XuanxueAiOrderRecord>;
  listCloudRecoveryOrders(): XuanxueAiOrderRecord[];
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
  readonly reconciledLocalVersions: Map<string, string>;
  readonly onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
  lastDeviceHeartbeatAt: number;
  lastSuccessfulHeartbeatAt: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  healthStatus: XuanxueAiProductionWorkerHealth["status"];
}

export const xuanxueAiProductionLocalRecoveryVersion = (
  record: XuanxueAiOrderRecord,
): string => [
  record.order.cloudExecutionIdentity?.attemptId ?? "no-attempt",
  record.order.cloudExecutionIdentity?.leaseVersion ?? "no-lease",
  record.status,
  record.updatedAt,
  ...record.stages
    .map((stage) => [
      stage.stageId,
      stage.executionId,
      stage.status,
      stage.attemptCount,
      stage.progressPhase,
      stage.updatedAt,
    ].join(":"))
    .sort(),
].join(":");

export const reconcileXuanxueAiProductionLocalNonterminalLedger = async (input: {
  readonly records: readonly XuanxueAiOrderRecord[];
  readonly activeJobIds: ReadonlySet<string>;
  readonly reconciledVersions: Map<string, string>;
  readonly reconcileDerivedInputs: (
    records: readonly XuanxueAiOrderRecord[],
    activeJobIds: ReadonlySet<string>,
  ) => Promise<void>;
}): Promise<readonly string[]> => {
  const currentIds = new Set(input.records.map((record) => record.order.orderId));
  const changed = input.records.filter((record) =>
    input.reconciledVersions.get(record.order.orderId)
      !== xuanxueAiProductionLocalRecoveryVersion(record));
  await input.reconcileDerivedInputs(input.records, input.activeJobIds);
  for (const record of input.records) {
    input.reconciledVersions.set(
      record.order.orderId,
      xuanxueAiProductionLocalRecoveryVersion(record),
    );
  }
  for (const orderId of input.reconciledVersions.keys()) {
    if (!currentIds.has(orderId)) input.reconciledVersions.delete(orderId);
  }
  return Object.freeze(changed.map((record) => record.order.orderId));
};

type StagedCloudJob = Awaited<ReturnType<
  typeof stageXuanxueAiProductionCloudJob
>>;

/**
 * The Worker measures the complete claim round trip with a local monotonic
 * clock.  It never turns a server timestamp into a local absolute deadline:
 * only the remaining relative budget can admit work to the Plugin.
 */
export const assertXuanxueAiProductionV5DeadlineBudget = (
  grant: CloudExecutionGrantV5,
  claimRoundTripMs: number,
): XuanxueAiExecutionDeadlineBudget => {
  const serverNowMs = Date.parse(grant.deadline_budget.server_now);
  const leaseExpiresMs = Date.parse(grant.deadline_budget.lease_expires_at);
  const roundTripMs = Math.ceil(claimRoundTripMs);
  if (
    !Number.isFinite(serverNowMs)
    || !Number.isFinite(leaseExpiresMs)
    || !Number.isFinite(roundTripMs)
    || roundTripMs < 0
    || grant.deadline_budget.server_now !== grant.server_now
    || grant.deadline_budget.lease_expires_at !== grant.lease_expires_at
    || grant.deadline_budget.safety_margin_ms !== 10_000
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_V5_DEADLINE_BUDGET_INVALID");
  }
  const remainingCommandBudgetMs = leaseExpiresMs
    - serverNowMs
    - roundTripMs
    - grant.deadline_budget.safety_margin_ms;
  if (remainingCommandBudgetMs < grant.deadline_budget.command_ttl_ms) {
    throw new Error("XUANXUE_AI_PRODUCTION_V5_DEADLINE_BUDGET_EXHAUSTED");
  }
  return {
    expiresAtMonotonic: performance.now() + remainingCommandBudgetMs,
    commandTtlMs: grant.deadline_budget.command_ttl_ms,
  };
};

const currentHealth = (state: WorkerState): XuanxueAiProductionWorkerHealth => ({
  status: state.healthStatus,
  contractManifestHash: XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
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

const markWorkerError = (state: WorkerState, error: unknown): void => {
  state.healthStatus = isWorkerContractFailure(error)
    ? "contract_blocked"
    : "transient_degraded";
  state.lastErrorCode = workerErrorCode(error);
  state.lastErrorReason = safeWorkerReason(error);
  publishHealth(state);
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
      waitForCloudWorker(20_000, state.abort.signal),
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
    reportCloudWorkerError(
      "XUANXUE_AI_PRODUCTION_ATTACHMENT_CHECKPOINT_DEFERRED",
      error,
    );
  }
};

const executeCloudJobStages = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  onLocalOrderId: (orderId: string) => void,
  deadlineBudget: XuanxueAiExecutionDeadlineBudget,
): Promise<XuanxueAiOrderRecord> => {
  const staged = await stageXuanxueAiProductionCloudJob(
    state.dataDir,
    state.credential,
    job,
  );
  await executeXuanxueAiProductionCloudReplayGraph(state.execution, staged);
  const created = state.execution.createOrder(staged.order);
  const identity = created.order.cloudExecutionIdentity;
  if (!identity
    || identity.jobId !== job.grant.job_id
    || identity.attemptId !== job.grant.attempt_id
    || identity.requiredDeviceId !== job.grant.required_device_id
    || identity.leaseVersion !== job.grant.lease_version
    || identity.executionFenceHash !== job.grant.execution_fence.fence_hash
    || identity.contractManifestHash !== job.grant.contract_manifest_hash) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCAL_ORDER_IDENTITY_INVALID");
  }
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
    }, deadlineBudget),
  );
};

const executeCloudJob = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  claimRoundTripMs: number,
): Promise<void> => {
  let localOrderId: string | undefined;
  try {
    if (job.grant.required_device_id !== state.credential.device_id
      || job.grant.execution_fence.lease_version !== job.lease_version
      || job.grant.execution_fence.fence_hash.length !== 71
      || Date.parse(job.grant.lease_expires_at) <= Date.parse(job.grant.server_now)) {
      throw new Error("XUANXUE_AI_PRODUCTION_V5_GRANT_REJECTED");
    }
    const deadlineBudget = assertXuanxueAiProductionV5DeadlineBudget(
      job.grant,
      claimRoundTripMs,
    );
    await checkpointXuanxueAiProductionJob(state.credential, job, {
      status: "inputs_downloading",
    });
    const terminal = await executeCloudJobStages(
      state,
      job,
      (orderId) => {
        localOrderId = orderId;
      },
      deadlineBudget,
    );
    await publishXuanxueAiProductionCloudOrder({
      credential: state.credential,
      dataDir: state.dataDir,
      job,
      record: terminal,
    });
    if (terminal.status === "completed" || terminal.status === "failed" || terminal.status === "review_required") {
      await cleanXuanxueAiProductionGeneratedInputs({ dataDir: state.dataDir }, terminal.order.orderId);
    }
  } catch (error) {
    const reason = safeWorkerReason(error);
    const recoverable = isRecoverableCloudWorkerFailure(error);
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
      if (!recoverable) {
        await cleanXuanxueAiProductionCloudStaging(state.dataDir, job.job_id);
        if (localOrderId) {
          await cleanXuanxueAiProductionGeneratedInputs({ dataDir: state.dataDir }, localOrderId);
        }
      }
    } catch (reportError) {
      reportCloudWorkerError(
        "XUANXUE_AI_PRODUCTION_FAILURE_REPORT_DEFERRED",
        reportError,
      );
    }
  }
};

const reconcileLocalNonterminalLedger = async (
  state: WorkerState,
): Promise<readonly string[]> => {
  const records = state.execution.listCloudRecoveryOrders();
  return reconcileXuanxueAiProductionLocalNonterminalLedger({
    records,
    activeJobIds: new Set(state.active.keys()),
    reconciledVersions: state.reconciledLocalVersions,
    reconcileDerivedInputs: async (currentRecords, activeJobIds) => {
      await reconcileXuanxueAiProductionGeneratedInputOrphans(
        { dataDir: state.dataDir },
        currentRecords,
        activeJobIds,
      );
    },
  });
};

const workerLoop = async (state: WorkerState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    try {
      if (Date.now() - state.lastDeviceHeartbeatAt >= 30_000) {
        await heartbeatXuanxueAiProductionDevice(state.credential);
        state.lastDeviceHeartbeatAt = Date.now();
        state.lastSuccessfulHeartbeatAt = new Date().toISOString();
      }
      await reconcileLocalNonterminalLedger(state);
      const available = Math.min(
        state.execution.availableCapacity(),
        state.credential.max_in_flight - state.active.size,
      );
      const claimStartedAt = performance.now();
      const jobs = available > 0
        ? await claimXuanxueAiProductionJobs(state.credential, available)
        : [];
      const claimRoundTripMs = performance.now() - claimStartedAt;
      for (const job of jobs) {
        if (state.active.has(job.job_id)) continue;
        const tracked = executeCloudJob(state, job, claimRoundTripMs).finally(() => {
          state.active.delete(job.job_id);
          publishHealth(state);
        });
        state.active.set(job.job_id, tracked);
      }
      markWorkerReady(state);
    } catch (error) {
      markWorkerError(state, error);
      reportCloudWorkerError("XUANXUE_AI_PRODUCTION_POLL_RETRY", error);
    }
    await waitForCloudWorker(cloudWorkerPollIntervalMs(), state.abort.signal);
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
  if (credential.max_in_flight !== 10) {
    throw new Error("XUANXUE_AI_PRODUCTION_V5_TEN_IN_FLIGHT_REQUIRED");
  }
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
    reconciledLocalVersions: new Map(),
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
