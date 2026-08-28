import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { failureCode } from "../../typed-failure.js";
import { cleanupGeneratedImageTemporaryFiles } from "./cloud-client.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import { readProductionCredential } from "./credential.js";
import { ProductionExecutor } from "./executor.js";
import { ProductionRuntimeStore, type StoredProductionTask } from "./store.js";
import { PRODUCTION_V6_MANIFEST_HASH } from "./transport-protocol.js";
import { ProductionWorkerSession } from "./worker-session.js";
import type { ProductionRuntimeHandle, ProductionRuntimeHealth } from "./runtime-contract.js";
import {
  flushOutboxWithLog,
  readHealth,
  runtimeState,
  sessionHeartbeatLoop,
  workerLoop,
} from "./runtime-loops.js";
import {
  emitCheckpointAuthority,
  emitLeaseAuthority,
  emitOutboxAuthority,
  emitRuntimeState,
  terminalSpanFailure,
} from "./runtime-logging.js";
import {
  classifyFailure,
  diagnoseProductionRuntime,
  refreshLedgerReconciled,
  safeReason,
  type RuntimeState,
} from "./runtime-state.js";

export type ProductionRuntimeStartInput = Readonly<{
  dataDir: string;
  sourceHash: ProductionHash;
  gpt: GptAbilityGroup;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  browserAuthority: WorkbenchBrowserAuthority;
  runtimeLogger: RuntimeLogger;
}>;

const emitBlockedStates = (input: ProductionRuntimeStartInput): void => {
  for (const stateKey of ["cloud.contract", "claim.admission"] as const) {
    requireRuntimeLogWrite(input.runtimeLogger.emitState({
      traceId: `producer:${input.runtimeLogger.producerRunId}`, owner: "production-runtime",
      component: "production-runtime", stateKey, previous: null, current: "blocked",
    }));
  }
};

const blockedHealth = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  reason: string,
  stopped: boolean,
): ProductionRuntimeHealth => {
  const browser = input.browserAuthority.readProductionRuntimeState();
  return {
    shellState: "ready", cloudState: stopped ? "stopped" : "contract_blocked",
    browserState: browser.browserAuthorityState === "present" ? "ready" : "blocked",
    executionState: "blocked", claimAdmissionState: "blocked",
    logSinkState: input.runtimeLogger.getSinkState(), browserAuthorityState: browser.browserAuthorityState,
    browserTargetState: browser.browserTargetState,
    browserLaneState: browser.browserAuthorityState === "present" ? "idle" : "blocked",
    contractManifestHash: PRODUCTION_V6_MANIFEST_HASH, catalogHash: productionCatalogHash,
    activeCount: 0, pendingOutboxCount: store.pendingOutboxCount(), lastSuccessfulHeartbeatAt: null,
    lastErrorCode: reason.split(":")[0] ?? "PRODUCTION_CREDENTIAL_INVALID",
    lastErrorReason: reason, checkedAt: new Date().toISOString(),
  };
};

const closeBlockedStore = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  traceId: string,
): void => {
  const span = requireRuntimeLogWrite(input.runtimeLogger.startSpan({
    traceId, owner: "production-runtime", component: "production-runtime", operation: "runtime.shutdown",
    typedIdentity: { kind: "producer", producerId: input.runtimeLogger.producerRunId },
  }));
  try {
    store.close();
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
  } catch (error) {
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed", failure: runtimeFailureFromError({
        error, code: "RUNTIME_SHUTDOWN_FAILED", responsibleOwner: "production-runtime",
        recovery: RuntimeRecovery.REVIEW, impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

const blockedRuntimeHandle = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  error: unknown,
): ProductionRuntimeHandle => {
  const reason = safeReason(error);
  const traceId = `producer:${input.runtimeLogger.producerRunId}`;
  let stopped = false;
  emitBlockedStates(input);
  return {
    readHealth: () => blockedHealth(input, store, reason, stopped),
    readTask: (jobId) => store.readTask(jobId),
    diagnose: (jobId) => diagnoseProductionRuntime(input.dataDir, store, jobId),
    close: async () => {
      if (stopped) return;
      closeBlockedStore(input, store, traceId);
      stopped = true;
    },
  };
};

const initializeStore = async (
  input: ProductionRuntimeStartInput,
  startSpan: RuntimeSpanHandle,
): Promise<ProductionRuntimeStore> => {
  try {
    await mkdir(input.dataDir, { recursive: true });
    await cleanupGeneratedImageTemporaryFiles(input.dataDir);
    return new ProductionRuntimeStore(input.dataDir);
  } catch (error) {
    terminalSpanFailure(
      startSpan, error, classifyFailure(error), runtimeLogCauseEventId(error), "RUNTIME_START_FAILED",
    );
    throw error;
  }
};

const createRuntimeState = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  credential: Awaited<ReturnType<typeof readProductionCredential>>,
): RuntimeState => {
  let stateRef: RuntimeState | null = null;
  const session = new ProductionWorkerSession(credential, () => runtimeState(stateRef!), input.sourceHash);
  const executor = new ProductionExecutor(store, input.runtimeLogger, {
    dataDir: input.dataDir, sourceHash: input.sourceHash, gpt: input.gpt,
    evidenceStore: input.evidenceStore, browserAuthority: input.browserAuthority,
  });
  const state: RuntimeState = {
    abort: new AbortController(), active: new Map(), activeAbort: new Map(), store, executor, session,
    browserAuthority: input.browserAuthority, gpt: input.gpt, dataDir: input.dataDir,
    runtimeLogger: input.runtimeLogger, loggedStates: new Map(), draining: false, lastHeartbeat: null,
    lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: false,
    reconciliationBaselineValid: false,
  };
  stateRef = state;
  store.setOutboxObserver((authority) => {
    emitOutboxAuthority(state, authority);
    refreshLedgerReconciled(state);
  });
  return state;
};

const reconcileTaskRecord = (
  state: RuntimeState,
  persisted: StoredProductionTask,
): boolean => {
  let record = persisted;
  const nonterminal = record.status === "accepted" || record.status === "running"
    || record.status === "recovery_pending";
  const storedLease = state.store.readLease(record.task.job_id);
  const lease = storedLease?.state === "active"
    ? state.store.recordLease({ ...storedLease, state: "stale", expiresAt: null }) : storedLease;
  const checkpoint = state.store.readCheckpoint(record.task.job_id);
  if (nonterminal && record.status !== "recovery_pending" && lease?.state === "stale" && checkpoint) {
    state.store.setRecoveryPending(record.task.job_id, "AGENT_PROCESS_RESTARTED");
    record = state.store.readTask(record.task.job_id)!;
  }
  emitRuntimeState({
    state, traceId: record.task.job_id, stateKey: "job.lifecycle", current: record.status,
    authorityRef: `production-task:${record.task.job_id}`, authorityHash: hashCanonical(record),
    reconciledFromAuthority: true,
  });
  let complete = true;
  if (lease) {
    if (nonterminal && (record.status !== "recovery_pending" || lease.state !== "stale")) complete = false;
    emitLeaseAuthority(state, lease, true);
  } else if (nonterminal) {
    complete = false;
    emitRuntimeState({ state, traceId: record.task.job_id, stateKey: "job.lease", current: "lost" });
  }
  if (checkpoint) emitCheckpointAuthority(state, checkpoint, true);
  else if (nonterminal) {
    complete = false;
    emitRuntimeState({ state, traceId: record.task.job_id, stateKey: "job.checkpoint", current: "failed" });
  }
  return complete;
};

const reconcileEvidence = async (
  input: ProductionRuntimeStartInput,
  records: readonly StoredProductionTask[],
): Promise<boolean> => {
  let complete = true;
  for (const record of records) {
    if (record.status !== "completed" || !record.result) continue;
    for (const recordRef of record.result.evidence_refs) {
      const readback = await input.evidenceStore.readRecordRef({ childCapabilityId: "read-record-ref", recordRef });
      if (readback.status !== "success" || !readback.record) complete = false;
    }
  }
  return complete;
};

const reconcileLocalState = async (
  input: ProductionRuntimeStartInput,
  state: RuntimeState,
): Promise<void> => {
  let complete = true;
  try { state.store.reconcileDeliveredTerminals(); }
  catch (error) {
    complete = false;
    state.lastErrorCode = failureCode(error, "PRODUCTION_TERMINAL_RECONCILIATION_FAILED");
    state.lastErrorReason = safeReason(error);
  }
  const records = state.store.taskAuthorities();
  for (const record of records) if (!reconcileTaskRecord(state, record)) complete = false;
  for (const authority of state.store.outboxAuthorities()) emitOutboxAuthority(state, authority, true);
  if (!await reconcileEvidence(input, records)) complete = false;
  state.reconciliationBaselineValid = complete;
  refreshLedgerReconciled(state);
};

const hydrateRemoteReceipts = async (state: RuntimeState): Promise<void> => {
  for (const jobId of state.store.unreconciledOutboxJobIds()) {
    try {
      const remote = await readProductionDeviceJobStatus(state.session, jobId);
      state.store.hydrateRemoteOutboxReceipts(jobId, remote.write_receipts);
    } catch (error) {
      if (failureCode(error) === "AI_V6_DEVICE_JOB_NOT_FOUND" && state.store.markRemoteAbsentHistorical(jobId)) {
        continue;
      }
      throw error;
    }
  }
};

const establishCloudSession = async (
  input: ProductionRuntimeStartInput,
  state: RuntimeState,
  startSpan: RuntimeSpanHandle,
): Promise<void> => {
  const boundaryId = `aipsopen_${randomUUID()}`;
  const span = requireRuntimeLogWrite(input.runtimeLogger.startSpan({
    traceId: `producer:${input.runtimeLogger.producerRunId}`, parentSpanId: startSpan.spanId, boundaryId,
    owner: "production-runtime", component: "production-session", operation: "cloud.session-open",
    typedIdentity: { kind: "producer", producerId: input.runtimeLogger.producerRunId },
  }));
  try {
    await state.session.open(boundaryId);
    emitRuntimeState({ state, stateKey: "cloud.contract", current: "ready" });
    emitRuntimeState({ state, stateKey: "cloud.session", current: "connected" });
    await hydrateRemoteReceipts(state);
    state.store.reconcileDeliveredTerminals();
    refreshLedgerReconciled(state);
    await flushOutboxWithLog(state);
    const receipt = await state.session.heartbeat();
    state.lastHeartbeat = receipt.issued_at;
    emitRuntimeState({
      state, stateKey: "producer.alive", current: "alive", freshForMs: 65_000, force: true, owner: "app-shell",
    });
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
    requireRuntimeLogWrite(startSpan.terminal({ outcome: "success" }));
  } catch (error) {
    const sessionFailure = terminalSpanFailure(
      span, error, classifyFailure(error), runtimeLogCauseEventId(error), "CLOUD_SESSION_OPEN_FAILED",
    );
    terminalSpanFailure(startSpan, error, classifyFailure(error), sessionFailure.eventId, "RUNTIME_START_FAILED");
    state.lastErrorCode = failureCode(error, "PRODUCTION_SESSION_START_FAILED");
    state.lastErrorReason = safeReason(error);
    emitRuntimeState({ state, stateKey: "cloud.session", current: "stale" });
    emitRuntimeState({ state, stateKey: "claim.admission", current: "blocked" });
  }
};

const finishShutdown = (
  state: RuntimeState,
  span: RuntimeSpanHandle,
  errors: readonly unknown[],
): void => {
  const error = errors[0];
  if (error === undefined) {
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
    return;
  }
  const terminal = requireRuntimeLogWrite(span.terminal({
    outcome: "failed", failure: runtimeFailureFromError({
      error, code: "RUNTIME_SHUTDOWN_FAILED", responsibleOwner: "production-runtime",
      recovery: RuntimeRecovery.REVIEW, impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
  throw withRuntimeLogCause(error, terminal.eventId);
};

const shutdownRuntime = async (
  state: RuntimeState,
  loop: Promise<void>,
  heartbeat: Promise<void>,
): Promise<void> => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: `producer:${state.runtimeLogger.producerRunId}`, owner: "production-runtime",
    component: "production-runtime", operation: "runtime.shutdown",
    typedIdentity: { kind: "producer", producerId: state.runtimeLogger.producerRunId },
  }));
  state.draining = true;
  emitRuntimeState({ state, stateKey: "claim.admission", current: "draining" });
  const errors: unknown[] = [];
  await state.session.heartbeat().catch((error) => errors.push(error));
  state.abort.abort();
  for (const controller of state.activeAbort.values()) controller.abort("PRODUCTION_RUNTIME_STOPPED");
  await Promise.all([loop, heartbeat]).catch((error) => errors.push(error));
  await Promise.allSettled([...state.active.values()]);
  await flushOutboxWithLog(state).catch((error) => errors.push(error));
  await state.session.close().catch((error) => errors.push(error));
  state.stopped = true;
  emitRuntimeState({ state, stateKey: "cloud.session", current: "disconnected" });
  try { state.store.close(); } catch (error) { errors.push(error); }
  finishShutdown(state, span, errors);
};

const createRuntimeHandle = (
  input: ProductionRuntimeStartInput,
  state: RuntimeState,
): ProductionRuntimeHandle => {
  const loop = workerLoop(state);
  const heartbeat = sessionHeartbeatLoop(state);
  return {
    readHealth: () => readHealth(state),
    readTask: (jobId) => state.store.readTask(jobId),
    diagnose: (jobId) => diagnoseProductionRuntime(input.dataDir, state.store, jobId),
    close: () => shutdownRuntime(state, loop, heartbeat),
  };
};

export const startProductionRuntime = async (
  input: ProductionRuntimeStartInput,
): Promise<ProductionRuntimeHandle> => {
  const startSpan = requireRuntimeLogWrite(input.runtimeLogger.startSpan({
    traceId: `producer:${input.runtimeLogger.producerRunId}`, owner: "production-runtime",
    component: "production-runtime", operation: "runtime.start",
    typedIdentity: { kind: "producer", producerId: input.runtimeLogger.producerRunId },
  }));
  const store = await initializeStore(input, startSpan);
  let credential: Awaited<ReturnType<typeof readProductionCredential>>;
  try { credential = await readProductionCredential(input.dataDir); }
  catch (error) {
    terminalSpanFailure(startSpan, error, classifyFailure(error), runtimeLogCauseEventId(error), "RUNTIME_START_FAILED");
    return blockedRuntimeHandle(input, store, error);
  }
  const state = createRuntimeState(input, store, credential);
  await reconcileLocalState(input, state);
  await establishCloudSession(input, state, startSpan);
  return createRuntimeHandle(input, state);
};
