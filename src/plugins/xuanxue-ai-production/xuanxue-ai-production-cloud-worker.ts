import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";
import {
  checkpointXuanxueAiProductionJob,
  claimXuanxueAiProductionJobs,
  failXuanxueAiProductionJob,
  flushXuanxueAiProductionCloudOutbox,
  heartbeatXuanxueAiProductionJob,
  releaseXuanxueAiProductionLease,
} from "./xuanxue-ai-production-cloud-client.js";
import {
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  type XuanxueAiProductionCloudClaimedJob,
  type XuanxueAiProductionCloudCredential,
  type XuanxueAiProductionCloudWorkerHandle,
} from "./xuanxue-ai-production-cloud-contract.js";
import { readXuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-credential.js";
import { XuanxueAiProductionCloudOutbox } from "./xuanxue-ai-production-cloud-outbox.js";
import { publishXuanxueAiProductionCloudOrder, toXuanxueAiProductionAttachmentCheckpoint } from "./xuanxue-ai-production-cloud-publication.js";
import {
  cleanXuanxueAiProductionCloudStaging,
  prepareXuanxueAiProductionCloudLocalOrder,
  stageXuanxueAiProductionCloudJob,
} from "./xuanxue-ai-production-cloud-staging.js";
import { openXuanxueAiProductionDatabase } from "./xuanxue-ai-production-store-database.js";
import { cleanXuanxueAiProductionGeneratedInputs, reconcileXuanxueAiProductionGeneratedInputOrphans } from "./xuanxue-ai-production-transient-lifecycle.js";
import type { XuanxueAiExecutionDeadlineBudget } from "./xuanxue-ai-production.runtime.js";
import { XuanxueAiProductionWorkerSessionV6, type XuanxueAiProductionRuntimeStateV6 } from "./xuanxue-ai-production-worker-session.js";
import type { CloudExecutionGrantV6 } from "./generated/xuanxue-ai-production-v6.validator.js";
import {
  cloudWorkerPollIntervalMs, isRecoverableCloudWorkerFailure, isWorkerContractFailure,
  reportCloudWorkerError, safeWorkerReason, waitForCloudWorker, workerErrorCode,
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
  applyControlIntent(
    orderId: string,
    intent: "pause_requested" | "cancel_requested" | "handover_requested",
    controlEpoch: number,
    reasonCode: string | null,
  ): void;
}

export interface XuanxueAiProductionWorkerHealth {
  readonly shellState: "ready" | "stopped";
  readonly cloudState: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly browserState: "ready" | "blocked";
  readonly executionState: "ready" | "blocked" | "draining";
  readonly claimAdmissionState: "eligible" | "blocked" | "draining";
  readonly browserAuthorityState: "present" | "absent";
  readonly browserTargetState: "claimed" | "absent";
  readonly browserLaneState: "idle" | "busy" | "blocked";
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
  readonly session: XuanxueAiProductionWorkerSessionV6;
  readonly outbox: XuanxueAiProductionCloudOutbox;
  readonly database: ReturnType<typeof openXuanxueAiProductionDatabase>;
  readonly onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
  lastSuccessfulHeartbeatAt: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  healthStatus: XuanxueAiProductionWorkerHealth["cloudState"];
  lastRuntimeState: XuanxueAiProductionRuntimeStateV6;
  ledgerReconciled: boolean;
  draining: boolean;
  nextPollDelayMs: number;
}

export const xuanxueAiProductionLocalRecoveryVersion = (record: XuanxueAiOrderRecord): string => [
  record.order.cloudExecutionIdentity?.attemptId ?? "no-attempt",
  record.order.cloudExecutionIdentity?.leaseVersion ?? "no-lease",
  record.status, record.updatedAt,
  ...record.stages.map((stage) => [stage.stageId, stage.executionId, stage.status, stage.attemptCount, stage.progressPhase, stage.updatedAt].join(":")).sort(),
].join(":");

export const reconcileXuanxueAiProductionLocalNonterminalLedger = async (input: {
  readonly records: readonly XuanxueAiOrderRecord[];
  readonly activeJobIds: ReadonlySet<string>;
  readonly reconciledVersions: Map<string, string>;
  readonly reconcileDerivedInputs: (records: readonly XuanxueAiOrderRecord[], activeJobIds: ReadonlySet<string>) => Promise<void>;
}): Promise<readonly string[]> => {
  const currentIds = new Set(input.records.map((record) => record.order.orderId));
  const changed = input.records.filter((record) => input.reconciledVersions.get(record.order.orderId) !== xuanxueAiProductionLocalRecoveryVersion(record));
  await input.reconcileDerivedInputs(input.records, input.activeJobIds);
  for (const record of input.records) input.reconciledVersions.set(record.order.orderId, xuanxueAiProductionLocalRecoveryVersion(record));
  for (const orderId of input.reconciledVersions.keys()) if (!currentIds.has(orderId)) input.reconciledVersions.delete(orderId);
  return Object.freeze(changed.map((record) => record.order.orderId));
};

type StagedCloudJob = Awaited<ReturnType<typeof stageXuanxueAiProductionCloudJob>>;

export const assertXuanxueAiProductionV6DeadlineBudget = (
  grant: CloudExecutionGrantV6,
  claimRoundTripMs: number,
): XuanxueAiExecutionDeadlineBudget => {
  const serverNow = Date.parse(grant.server_now);
  const acceptBy = Date.parse(grant.accept_by);
  const leaseExpires = Date.parse(grant.lease_expires_at);
  const elapsed = Math.ceil(claimRoundTripMs);
  const acceptRemaining = acceptBy - serverNow - elapsed;
  const leaseRemaining = leaseExpires - serverNow - elapsed;
  if (![serverNow, acceptBy, leaseExpires, elapsed].every(Number.isFinite)
    || elapsed < 0 || acceptRemaining < 5_000 || leaseRemaining < 30_000
    || grant.renew_after_ms !== 20_000) {
    throw new Error("XUANXUE_AI_PRODUCTION_V6_DEADLINE_BUDGET_EXHAUSTED");
  }
  return {
    expiresAtMonotonic: performance.now() + leaseRemaining - 10_000,
    commandTtlMs: Math.min(20_000, leaseRemaining - 10_000),
  };
};

const currentHealth = (state: WorkerState): XuanxueAiProductionWorkerHealth => ({
  shellState: state.healthStatus === "stopped" ? "stopped" : "ready",
  cloudState: state.healthStatus,
  browserState: state.lastRuntimeState.browserAuthorityState === "present"
    && state.lastRuntimeState.browserTargetState === "claimed"
    && state.lastRuntimeState.browserLaneState !== "blocked" ? "ready" : "blocked",
  executionState: state.draining ? "draining"
    : state.healthStatus === "ready" && state.ledgerReconciled
      && state.lastRuntimeState.browserAuthorityState === "present"
      && state.lastRuntimeState.browserTargetState === "claimed"
      && state.lastRuntimeState.browserLaneState !== "blocked" ? "ready" : "blocked",
  claimAdmissionState: state.draining ? "draining"
    : state.healthStatus === "ready" && state.ledgerReconciled
      && state.lastRuntimeState.browserAuthorityState === "present"
      && state.lastRuntimeState.browserTargetState === "claimed"
      && state.lastRuntimeState.browserLaneState !== "blocked" ? "eligible" : "blocked",
  browserAuthorityState: state.lastRuntimeState.browserAuthorityState,
  browserTargetState: state.lastRuntimeState.browserTargetState,
  browserLaneState: state.lastRuntimeState.browserLaneState,
  contractManifestHash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  activeCount: state.active.size, lastSuccessfulHeartbeatAt: state.lastSuccessfulHeartbeatAt,
  lastErrorCode: state.lastErrorCode, lastErrorReason: state.lastErrorReason,
  checkedAt: new Date().toISOString(),
});
const publishHealth = (state: WorkerState): void => state.onStatus?.(currentHealth(state));
const markWorkerReady = (state: WorkerState): void => {
  state.healthStatus = "ready"; state.lastErrorCode = null; state.lastErrorReason = null; publishHealth(state);
};
const markWorkerError = (state: WorkerState, error: unknown): void => {
  state.healthStatus = isWorkerContractFailure(error) ? "contract_blocked" : "transient_degraded";
  state.lastErrorCode = workerErrorCode(error); state.lastErrorReason = safeWorkerReason(error); publishHealth(state);
};

const executeReplayOrder = async (
  execution: Pick<XuanxueAiProductionExecutionPort, "createOrder" | "executeOrder">,
  order: StagedCloudJob["parentReplayDependencies"][number],
): Promise<void> => {
  execution.createOrder(order);
  const completed = await execution.executeOrder(order.orderId);
  if (completed.status !== "completed") throw new Error(`XUANXUE_AI_PRODUCTION_PARENT_REPLAY_DEPENDENCY_INCOMPLETE:${order.productId}:${order.orderId}:${completed.failureReason ?? completed.status}`);
};

export const executeXuanxueAiProductionCloudReplayGraph = async (
  execution: Pick<XuanxueAiProductionExecutionPort, "createOrder" | "executeOrder">,
  staged: Pick<StagedCloudJob, "parentReplay" | "parentReplayDependencies">,
): Promise<void> => {
  for (const dependency of staged.parentReplayDependencies) await executeReplayOrder(execution, dependency);
  if (staged.parentReplay) await executeReplayOrder(execution, staged.parentReplay);
};

const heartbeatUntilSettled = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  execution: Promise<XuanxueAiOrderRecord>,
  checkpointHash: `sha256:${string}`,
  deadlineBudget: XuanxueAiExecutionDeadlineBudget,
  localOrderId: string,
): Promise<XuanxueAiOrderRecord> => {
  let settled = false;
  const tracked = execution.finally(() => { settled = true; });
  while (!settled && !state.abort.signal.aborted) {
    await Promise.race([tracked, waitForCloudWorker(20_000, state.abort.signal)]);
    if (!settled && !state.abort.signal.aborted) {
      const renewal = await heartbeatXuanxueAiProductionJob(state.session, job, checkpointHash);
      const relativeLeaseMs = Date.parse(renewal.lease_expires_at) - Date.parse(renewal.server_now);
      if (!Number.isFinite(relativeLeaseMs) || relativeLeaseMs < 30_000) throw new Error("XUANXUE_AI_PRODUCTION_V6_RENEW_BUDGET_INVALID");
      deadlineBudget.expiresAtMonotonic = performance.now() + relativeLeaseMs - 10_000;
      deadlineBudget.commandTtlMs = Math.min(20_000, relativeLeaseMs - 10_000);
      if (renewal.control_intent.intent !== "none") {
        state.execution.applyControlIntent(
          localOrderId, renewal.control_intent.intent,
          renewal.control_intent.control_epoch, renewal.control_intent.reason_code,
        );
      }
    }
  }
  return tracked;
};

const checkpointAttachmentUpload = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  localOrderId: string | undefined,
  input: { readonly stageId: string; readonly proof: NonNullable<XuanxueAiOrderRecord["stages"][number]["attachmentUploadProof"]> },
): Promise<void> => {
  try {
    await checkpointXuanxueAiProductionJob(state.session, state.outbox, job, {
      status: "factory_running", ...(localOrderId ? { localOrderId } : {}),
      attachmentUploadProof: toXuanxueAiProductionAttachmentCheckpoint(input),
    });
  } catch (error) {
    reportCloudWorkerError("XUANXUE_AI_PRODUCTION_ATTACHMENT_CHECKPOINT_DEFERRED", error);
  }
};

const executeCloudJobStages = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  localOrderId: string,
  deadlineBudget: XuanxueAiExecutionDeadlineBudget,
  acceptanceCheckpointHash: `sha256:${string}`,
): Promise<XuanxueAiOrderRecord> => {
  const staged = await stageXuanxueAiProductionCloudJob(state.dataDir, state.session, job);
  await executeXuanxueAiProductionCloudReplayGraph(state.execution, staged);
  const identity = staged.order.cloudExecutionIdentity;
  if (!identity || identity.jobId !== job.grant.job_id || identity.attemptId !== job.grant.attempt_id
    || identity.requiredDeviceId !== job.grant.device_id || identity.leaseVersion !== job.grant.lease_version
    || identity.executionFenceHash !== job.grant.execution_fence.fence_hash
    || identity.contractManifestHash !== job.grant.control_contract_manifest_hash
    || staged.order.orderId !== localOrderId) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCAL_ORDER_IDENTITY_INVALID");
  }
  await checkpointXuanxueAiProductionJob(state.session, state.outbox, job, {
    status: "factory_running", localOrderId,
  });
  return heartbeatUntilSettled(
    state, job,
    state.execution.executeOrder(localOrderId, {
      onAttachmentUploadCompleted: async ({ stageId, proof }) =>
        checkpointAttachmentUpload(state, job, localOrderId, { stageId, proof }),
    }, deadlineBudget),
    acceptanceCheckpointHash, deadlineBudget, localOrderId,
  );
};

const executeCloudJob = async (
  state: WorkerState,
  job: XuanxueAiProductionCloudClaimedJob,
  claimRoundTripMs: number,
): Promise<void> => {
  let localOrderId: string | undefined;
  let accepted = false;
  try {
    if (job.grant.device_id !== state.credential.device_id
      || job.grant.device_epoch !== state.credential.device_epoch
      || job.grant.worker_session_id !== state.session.workerSessionId
      || job.grant.worker_session_epoch !== state.session.workerSessionEpoch
      || job.grant.execution_fence.lease_version !== job.lease_version
      || job.grant.control_contract_manifest_hash !== XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH) {
      throw new Error("XUANXUE_AI_PRODUCTION_V6_GRANT_REJECTED");
    }
    const deadlineBudget = assertXuanxueAiProductionV6DeadlineBudget(job.grant, claimRoundTripMs);
    state.outbox.persistClaimIdentity({
      jobId: job.job_id, attemptId: job.grant.attempt_id,
      leaseVersion: job.grant.lease_version, createdAt: job.created_at,
      grant: job.grant,
    });
    const preparedOrder = prepareXuanxueAiProductionCloudLocalOrder(state.dataDir, job);
    const created = state.execution.createOrder(preparedOrder);
    const identity = created.order.cloudExecutionIdentity;
    if (!identity || identity.jobId !== job.grant.job_id || identity.attemptId !== job.grant.attempt_id
      || identity.requiredDeviceId !== job.grant.device_id || identity.leaseVersion !== job.grant.lease_version
      || identity.executionFenceHash !== job.grant.execution_fence.fence_hash
      || identity.contractManifestHash !== job.grant.control_contract_manifest_hash) {
      throw new Error("XUANXUE_AI_PRODUCTION_LOCAL_ORDER_IDENTITY_INVALID");
    }
    localOrderId = created.order.orderId;
    const acceptanceCheckpointHash = await checkpointXuanxueAiProductionJob(
      state.session, state.outbox, job, {
        status: "inputs_downloading", localOrderId,
      },
    );
    accepted = true;
    const terminal = await executeCloudJobStages(
      state, job, localOrderId, deadlineBudget, acceptanceCheckpointHash,
    );
    await publishXuanxueAiProductionCloudOrder({
      session: state.session, outbox: state.outbox, dataDir: state.dataDir, job, record: terminal,
    });
    if (["completed", "failed", "review_required"].includes(terminal.status)) {
      await cleanXuanxueAiProductionGeneratedInputs({ dataDir: state.dataDir }, terminal.order.orderId);
    }
  } catch (error) {
    const recoverable = isRecoverableCloudWorkerFailure(error);
    try {
      if (!accepted) {
        await releaseXuanxueAiProductionLease(
          state.session, job,
          /DEADLINE_BUDGET/iu.test(safeWorkerReason(error))
            ? "DEADLINE_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
        );
      } else {
        await failXuanxueAiProductionJob(state.session, state.outbox, job, {
          status: recoverable ? "recovery_pending" : "failed",
          code: recoverable ? "XUANXUE_AI_PRODUCTION_CLOUD_TRANSIENT" : "XUANXUE_AI_PRODUCTION_CLOUD_FAILED",
          reason: safeWorkerReason(error), recoverable,
          ...(localOrderId ? { localOrderId } : {}),
        });
      }
      if (!recoverable) {
        await cleanXuanxueAiProductionCloudStaging(state.dataDir, job.job_id);
        if (localOrderId) await cleanXuanxueAiProductionGeneratedInputs({ dataDir: state.dataDir }, localOrderId);
      }
    } catch (reportError) {
      reportCloudWorkerError("XUANXUE_AI_PRODUCTION_FAILURE_REPORT_DEFERRED", reportError);
    }
  }
};

const reconcileLocalNonterminalLedger = async (state: WorkerState): Promise<readonly string[]> => {
  const records = state.execution.listCloudRecoveryOrders();
  return reconcileXuanxueAiProductionLocalNonterminalLedger({
    records, activeJobIds: new Set(state.active.keys()),
    reconciledVersions: state.reconciledLocalVersions,
    reconcileDerivedInputs: async (currentRecords, activeJobIds) => {
      await reconcileXuanxueAiProductionGeneratedInputOrphans({ dataDir: state.dataDir }, currentRecords, activeJobIds);
    },
  });
};

const workerLoop = async (state: WorkerState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    try {
      await reconcileLocalNonterminalLedger(state);
      await flushXuanxueAiProductionCloudOutbox(state.session, state.outbox);
      state.ledgerReconciled = true;
      state.session.markLedgerReconciled();
      const receipt = await state.session.ensureFreshAttestation();
      state.lastSuccessfulHeartbeatAt = receipt.issued_at;
      const available = Math.min(10 - state.active.size, state.execution.availableCapacity());
      if (available > 0 && receipt.claim_eligible && !state.draining) {
        const claimStartedAt = performance.now();
        const batch = await claimXuanxueAiProductionJobs(state.session, state.outbox, available);
        const jitter = Math.floor(Math.random() * Math.min(1_000, Math.max(100, batch.nextClaimAfterMs * 0.1)));
        state.nextPollDelayMs = batch.outcome === "LEASE_GRANTED" ? 1_000 : Math.min(30_000, batch.nextClaimAfterMs + jitter);
        const roundTrip = performance.now() - claimStartedAt;
        const ordered = [...batch.jobs].sort((left, right) => left.created_at.localeCompare(right.created_at) || left.job_id.localeCompare(right.job_id));
        for (const job of ordered) {
          if (state.active.has(job.job_id)) continue;
          const tracked = executeCloudJob(state, job, roundTrip).finally(() => {
            state.active.delete(job.job_id); publishHealth(state);
          });
          state.active.set(job.job_id, tracked);
        }
      }
      markWorkerReady(state);
    } catch (error) {
      markWorkerError(state, error);
      reportCloudWorkerError("XUANXUE_AI_PRODUCTION_POLL_RETRY", error);
      state.nextPollDelayMs = Math.min(30_000, Math.max(1_000, state.nextPollDelayMs * 2));
    }
    await waitForCloudWorker(Math.max(cloudWorkerPollIntervalMs(), state.nextPollDelayMs), state.abort.signal);
  }
};

const sessionHeartbeatLoop = async (state: WorkerState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await waitForCloudWorker(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    try {
      const receipt = await state.session.heartbeat();
      state.lastSuccessfulHeartbeatAt = receipt.issued_at;
      publishHealth(state);
    } catch (error) {
      reportCloudWorkerError("XUANXUE_AI_PRODUCTION_SESSION_HEARTBEAT_RETRY", error);
    }
  }
};

export async function startXuanxueAiProductionCloudWorker(input: {
  readonly dataDir: string;
  readonly execution: XuanxueAiProductionExecutionPort;
  readonly readBrowserRuntimeState: () => Promise<Pick<
    XuanxueAiProductionRuntimeStateV6,
    "browserActionInFlight" | "browserAuthorityState" | "browserTargetState" | "browserLaneState"
  >>;
  readonly onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
}): Promise<XuanxueAiProductionCloudWorkerHandle> {
  const credential = await readXuanxueAiProductionCloudCredential(input.dataDir);
  if (credential.protocol_version !== "xuanxue-ai-production-v6"
    || credential.control_manifest_hash !== XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH) {
    throw new Error("XUANXUE_AI_PRODUCTION_V6_DEVICE_CREDENTIAL_INVALID");
  }
  const configuredBase = process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL?.trim().replace(/\/+$/u, "");
  if (configuredBase && configuredBase !== credential.server_base_url.replace(/\/+$/u, "")) {
    throw new Error("XUANXUE_AI_PRODUCTION_SERVER_BINDING_MISMATCH");
  }
  const configuredEnvironment = process.env.XUANXUE_AI_PRODUCTION_ENVIRONMENT_ID?.trim();
  if (configuredEnvironment && configuredEnvironment !== credential.environment_id) {
    throw new Error("XUANXUE_AI_PRODUCTION_ENVIRONMENT_BINDING_MISMATCH");
  }
  const configuredOrigin = process.env.XUANXUE_AI_PRODUCTION_AGENT_ORIGIN?.trim();
  if (configuredOrigin && new URL(configuredOrigin).origin !== new URL(credential.origin).origin) {
    throw new Error("XUANXUE_AI_PRODUCTION_ORIGIN_BINDING_MISMATCH");
  }
  const sourceFingerprint = process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim();
  if (!sourceFingerprint || sourceFingerprint !== credential.agent_build_hash) {
    throw new Error("XUANXUE_AI_PRODUCTION_AGENT_BUILD_BINDING_MISMATCH");
  }
  const database = openXuanxueAiProductionDatabase(input.dataDir);
  const outbox = new XuanxueAiProductionCloudOutbox(database);
  let stateRef: WorkerState | null = null;
  const session = new XuanxueAiProductionWorkerSessionV6(credential, async () => {
    const browser = await input.readBrowserRuntimeState();
    const runtimeState: XuanxueAiProductionRuntimeStateV6 = {
      ...browser,
      businessInFlight: stateRef?.active.size ?? 0,
      drainState: stateRef?.draining ? "draining" : "open",
      ledgerReconciled: stateRef?.ledgerReconciled ?? false,
    };
    if (stateRef) stateRef.lastRuntimeState = runtimeState;
    return runtimeState;
  });
  const state: WorkerState = {
    abort: new AbortController(), active: new Map(), credential,
    dataDir: input.dataDir, execution: input.execution,
    reconciledLocalVersions: new Map(), session, outbox, database,
    ...(input.onStatus ? { onStatus: input.onStatus } : {}),
    lastSuccessfulHeartbeatAt: null, lastErrorCode: null, lastErrorReason: null,
    healthStatus: "ready", ledgerReconciled: false, draining: false, nextPollDelayMs: 1_000,
    lastRuntimeState: {
      businessInFlight: 0, browserActionInFlight: 0,
      browserAuthorityState: "absent", browserTargetState: "absent",
      browserLaneState: "blocked", drainState: "open", ledgerReconciled: false,
    },
  };
  stateRef = state;
  try {
    await session.open();
    await flushXuanxueAiProductionCloudOutbox(session, outbox);
    await reconcileLocalNonterminalLedger(state);
    state.ledgerReconciled = true;
    session.markLedgerReconciled();
    const initialReceipt = await session.heartbeat();
    state.lastSuccessfulHeartbeatAt = initialReceipt.issued_at;
  } catch (error) {
    database.close();
    throw error;
  }
  publishHealth(state);
  const loop = workerLoop(state);
  const heartbeatLoop = sessionHeartbeatLoop(state);
  return {
    async close() {
      state.draining = true;
      await state.session.heartbeat().catch((error) => reportCloudWorkerError("XUANXUE_AI_PRODUCTION_DRAIN_ATTESTATION_DEFERRED", error));
      state.abort.abort();
      await Promise.all([loop, heartbeatLoop]);
      await Promise.allSettled([...state.active.values()]);
      await flushXuanxueAiProductionCloudOutbox(state.session, state.outbox);
      await state.session.close();
      state.healthStatus = "stopped";
      publishHealth(state);
      state.database.close();
    },
  };
}
