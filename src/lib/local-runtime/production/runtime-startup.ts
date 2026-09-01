import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { failureCode } from "../../typed-failure.js";
import { productionCatalogHash } from "./catalog.js";
import type { ProductionHash } from "./contracts.js";
import { readProductionCredential } from "./credential.js";
import { ProductionExecutor } from "./executor.js";
import { ProductionRuntimeStore, type StoredProductionTask } from "./store.js";
import { PRODUCTION_V6_MANIFEST_HASH } from "./transport-protocol.js";
import { ProductionWorkerSession } from "./worker-session.js";
import type { ProductionRuntimeHandle, ProductionRuntimeHealth } from "./runtime-contract.js";
import { reconstructPublicKnowledgeLegacyCurrentCheckpoint } from "../../../plugins/public-knowledge-article-pipeline/frontier-cutover.js";
import {
  flushOutboxWithLog,
  readHealth,
  runtimeState,
  sessionHeartbeatLoop,
  workerLoop,
} from "./runtime-loops.js";
import { terminalSpanFailure } from "./runtime-logging.js";
import {
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
    activeCount: 0, pendingOutboxCount: store.pendingOutboxCount(),
    lastSuccessfulHeartbeatAt: null,
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
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
  } catch (error) {
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed", failure: runtimeFailureFromError({
        error, code: "RUNTIME_SHUTDOWN_FAILED", responsibleOwner: "production-runtime",
        impact: RuntimeFailureImpact.BLOCKING,
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
    return new ProductionRuntimeStore(input.dataDir);
  } catch (error) {
    terminalSpanFailure(
      startSpan, error, runtimeLogCauseEventId(error), "RUNTIME_START_FAILED",
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
    runtimeLogger: input.runtimeLogger, draining: false, lastHeartbeat: null,
    lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: false,
    reconciliationBaselineValid: false,
  };
  stateRef = state;
  store.setOutboxObserver(() => refreshLedgerReconciled(state));
  return state;
};

export const reconcileTaskRecord = (
  state: RuntimeState,
  persisted: StoredProductionTask,
): boolean => {
  const nonterminal = persisted.status === "failed";
  const storedLease = state.store.readLease(persisted.task.job_id);
  const lease = storedLease?.state === "active"
    ? state.store.recordLease({ ...storedLease, state: "stale", expiresAt: null }) : storedLease;
  const checkpoint = state.store.readCheckpoint(persisted.task.job_id);
  const remoteRedeliveryPending = state.store.hasUnsentOutbox(persisted.task.job_id);
  if (nonterminal && lease?.state === "stale" && checkpoint && !persisted.staged_result
    && !persisted.current_reason?.startsWith("GPT_CONTINUATION_CUTOVER_")) {
    state.store.setCurrentReason(persisted.task.job_id, "AGENT_PROCESS_RESTARTED");
  }
  if (nonterminal && persisted.current_reason?.startsWith("GPT_CONTINUATION_CUTOVER_")) {
    return true;
  }
  let complete = true;
  if (lease) {
    if (nonterminal && !remoteRedeliveryPending
      && lease.state !== "stale") complete = false;
  } else if (nonterminal && !remoteRedeliveryPending) {
    complete = false;
  }
  if (!checkpoint && nonterminal && !remoteRedeliveryPending) complete = false;
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

const reconcileContinuationCutover = async (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
): Promise<void> => {
  for (const continuation of store.frontierContinuationsMissingCurrentCheckpoint()) {
    const task = store.readTask(continuation.origin_job_id);
    if (!task) continue;
    try {
      const checkpoint = await reconstructPublicKnowledgeLegacyCurrentCheckpoint({
        continuation,
        task: task.task,
        pluginVersion: task.identity.plugin_version,
        candidateAttemptIds: store.attemptIdsForTask(continuation.origin_job_id),
        evidenceStore: input.evidenceStore,
      });
      store.migrateFrontierCurrentCheckpoint(
        continuation.continuation_ref, continuation.provider, checkpoint,
      );
    } catch (error) {
      store.setCurrentReason(
        continuation.origin_job_id,
        failureCode(error, "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED"),
      );
    }
  }
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
  if (!await reconcileEvidence(input, records)) complete = false;
  state.reconciliationBaselineValid = complete;
  refreshLedgerReconciled(state);
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
    state.store.reconcileDeliveredTerminals();
    refreshLedgerReconciled(state);
    await flushOutboxWithLog(state);
    const receipt = await state.session.heartbeat();
    state.lastHeartbeat = receipt.issued_at;
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
    requireRuntimeLogWrite(startSpan.terminal({ outcome: "succeeded" }));
  } catch (error) {
    const sessionFailure = terminalSpanFailure(
      span, error, runtimeLogCauseEventId(error), "CLOUD_SESSION_OPEN_FAILED",
    );
    terminalSpanFailure(startSpan, error, sessionFailure.eventId, "RUNTIME_START_FAILED");
    state.lastErrorCode = failureCode(error, "PRODUCTION_SESSION_START_FAILED");
    state.lastErrorReason = safeReason(error);
  }
};

const finishShutdown = (
  state: RuntimeState,
  span: RuntimeSpanHandle,
  errors: readonly unknown[],
): void => {
  const error = errors[0];
  if (error === undefined) {
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
    return;
  }
  const terminal = requireRuntimeLogWrite(span.terminal({
    outcome: "failed", failure: runtimeFailureFromError({
      error, code: "RUNTIME_SHUTDOWN_FAILED", responsibleOwner: "production-runtime",
      impact: RuntimeFailureImpact.BLOCKING,
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
  const errors: unknown[] = [];
  await state.session.heartbeat().catch((error) => errors.push(error));
  state.abort.abort();
  for (const controller of state.activeAbort.values()) controller.abort("PRODUCTION_RUNTIME_STOPPED");
  await Promise.all([loop, heartbeat]).catch((error) => errors.push(error));
  await Promise.allSettled([...state.active.values()]);
  await flushOutboxWithLog(state).catch((error) => errors.push(error));
  await state.session.close().catch((error) => errors.push(error));
  state.stopped = true;
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
  await reconcileContinuationCutover(input, store);
  let credential: Awaited<ReturnType<typeof readProductionCredential>>;
  try { credential = await readProductionCredential(input.dataDir); }
  catch (error) {
    terminalSpanFailure(startSpan, error, runtimeLogCauseEventId(error), "RUNTIME_START_FAILED");
    return blockedRuntimeHandle(input, store, error);
  }
  const state = createRuntimeState(input, store, credential);
  await reconcileLocalState(input, state);
  await establishCloudSession(input, state, startSpan);
  return createRuntimeHandle(input, state);
};
