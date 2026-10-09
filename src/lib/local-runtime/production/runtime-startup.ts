import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import {
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { executionFailure, executionFailureMetadata, failureCode } from "../../execution-failure.js";
import { productionCatalogHash } from "./catalog.js";
import { productionControlContractVersion } from "./control-contract-dependency.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import { readProductionCredential } from "./credential.js";
import { ProductionExecutor } from "./executor.js";
import { ProductionRuntimeStore } from "./store.js";
import { ProviderRateLimitControl } from "./provider-rate-limit-control.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import { ProductionWorkerSession } from "./worker-session.js";
import { readProductionOperationsSnapshot } from "./operations-snapshot.js";
import type { ProductionRuntimeHandle, ProductionRuntimeHealth } from "./runtime-contract.js";
import {
  readHealth,
  runtimeState,
  sessionHeartbeatLoop,
  workerLoop,
} from "./runtime-loops.js";
import { terminalSpanFailure } from "./runtime-logging.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { releaseReceiptMatches, remoteFailureMatches } from "./runtime-attempt-failure-readback.js";
import { reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { readProductionRuntimeStorageInventory } from "./runtime-storage-inventory.js";
import {
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
  stopSignal?: AbortSignal;
}>;

const blockedHealth = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  error: unknown,
  stopped: boolean,
  controlContractVersion: number | null,
): ProductionRuntimeHealth => {
  const browser = input.browserAuthority.readProductionRuntimeState();
  const reason = safeReason(error);
  return {
    shellState: "ready", cloudState: stopped ? "stopped" : "contract_blocked",
    browserState: browser.browserAuthorityState === "present" ? "ready" : "blocked",
    executionState: "blocked", claimAdmissionState: "blocked",
    logSinkState: input.runtimeLogger.getSinkState(), browserAuthorityState: browser.browserAuthorityState,
    browserTargetState: browser.browserTargetState,
    browserLaneState: browser.browserAuthorityState === "present" ? "idle" : "blocked",
    controlContractVersion, catalogHash: productionCatalogHash,
    activeCount: 0, pendingOutboxCount: store.pendingOutboxCount(),
    lastSuccessfulHeartbeatAt: null,
    lastErrorCode: failureCode(error, "PRODUCTION_RUNTIME_START_BLOCKED"),
    lastErrorReason: reason, checkedAt: new Date().toISOString(),
  };
};

const closeBlockedStore = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  traceId: string,
): void => {
  const errors: unknown[] = [];
  let span: RuntimeSpanHandle | null = null;
  try {
    span = requireRuntimeLogWrite(input.runtimeLogger.startSpan({
      traceId, owner: "production-runtime", component: "production-runtime", operation: "runtime.shutdown",
      typedIdentity: { kind: "producer", producerId: input.runtimeLogger.producerRunId },
    }));
  } catch (error) { errors.push(error); }
  if (!input.stopSignal || input.stopSignal.aborted) {
    try {
      if (store.taskAuthorities().some(task => task.status !== "completed")) {
        errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_RESULT_UNCONFIRMED"));
      }
      if (store.pendingOutboxCount() > 0) errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_OUTBOX_PENDING"));
      if (store.pendingBrowserCleanupJobIds().length) errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_BROWSER_CLEANUP_PENDING"));
      if (store.providerCooldownSessionRecoveryIdentity() !== null) errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_COOLDOWN_PENDING"));
      if (input.browserAuthority.hasUnresolvedBrowserMutation()) errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_BROWSER_UNRESOLVED"));
    } catch (error) { errors.push(error); }
  }
  try { store.close(); } catch (error) { errors.push(error); }
  finishShutdown(span, errors);
};

const blockedRuntimeHandle = (
  input: ProductionRuntimeStartInput,
  store: ProductionRuntimeStore,
  error: unknown,
  controlContractVersion: number | null = null,
): ProductionRuntimeHandle => {
  const traceId = `producer:${input.runtimeLogger.producerRunId}`;
  let stopped = false;
  let closing: Promise<void> | null = null;
  return {
    blocked: true,
    readHealth: () => blockedHealth(input, store, error, stopped, controlContractVersion),
    readOperationsSnapshot: (jobId) => readProductionOperationsSnapshot({
      dataDir: input.dataDir, store, browser: input.browserAuthority,
      health: () => blockedHealth(input, store, error, stopped, controlContractVersion),
      session: null, jobId,
    }),
    close: () => closing ??= Promise.resolve().then(() => {
      closeBlockedStore(input, store, traceId); stopped = true;
    }),
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
  const recoverySession = store.providerCooldownSessionRecoveryIdentity();
  const session = new ProductionWorkerSession(
    credential,
    () => runtimeState(stateRef!),
    input.sourceHash,
    recoverySession?.workerInstanceId,
    recoverySession?.sessionOpenRequestId,
  );
  const providerRateLimitControl = new ProviderRateLimitControl(store, session);
  const executor = new ProductionExecutor(store, input.runtimeLogger, {
    dataDir: input.dataDir, sourceHash: input.sourceHash, gpt: input.gpt,
    evidenceStore: input.evidenceStore, browserAuthority: input.browserAuthority,
    providerRateLimitControl,
  });
  const state: RuntimeState = {
    abort: new AbortController(), active: new Map(), activeAbort: new Map(), store, executor, session,
    providerRateLimitControl,
    browserAuthority: input.browserAuthority, gpt: input.gpt, evidenceStore: input.evidenceStore,
    dataDir: input.dataDir,
    runtimeLogger: input.runtimeLogger,
    draining: input.stopSignal?.aborted ?? false, iteration: null, drainJobIds: null, lastHeartbeat: null,
    lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: false,
  };
  stateRef = state;
  input.stopSignal?.addEventListener("abort", () => { state.draining = true; }, { once: true });
  store.setOutboxObserver(() => refreshLedgerReconciled(state));
  return state;
};

const establishCloudSession = async (
  input: ProductionRuntimeStartInput,
  state: RuntimeState,
  startSpan: RuntimeSpanHandle,
): Promise<unknown | null> => {
  const boundaryId = `aipsopen_${randomUUID()}`;
  const span = requireRuntimeLogWrite(input.runtimeLogger.startSpan({
    traceId: `producer:${input.runtimeLogger.producerRunId}`, parentSpanId: startSpan.spanId, boundaryId,
    owner: "production-runtime", component: "production-session", operation: "cloud.session-open",
    typedIdentity: { kind: "producer", producerId: input.runtimeLogger.producerRunId },
  }));
  try {
    await state.session.open();
    refreshLedgerReconciled(state);
    const receipt = await state.session.heartbeat();
    state.lastHeartbeat = receipt.issued_at;
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
    requireRuntimeLogWrite(startSpan.terminal({ outcome: "succeeded" }));
    return null;
  } catch (error) {
    const sessionFailure = terminalSpanFailure(
      span, error, runtimeLogCauseEventId(error), "CLOUD_SESSION_OPEN_FAILED",
    );
    terminalSpanFailure(startSpan, error, sessionFailure.eventId, "RUNTIME_START_FAILED");
    state.lastErrorCode = failureCode(error, "PRODUCTION_SESSION_START_FAILED");
    state.lastErrorReason = safeReason(error);
    return error;
  }
};
const inspectDrainedTasks = async (state: RuntimeState): Promise<readonly unknown[]> => {
  const errors: unknown[] = [];
  for (const jobId of state.drainJobIds ?? []) {
    if (state.store.readTask(jobId)) continue;
    try {
      await readProductionDeviceJobStatus(state.session, jobId);
      errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_CLAIM_UNRECORDED"));
    } catch (error) { if (!websiteJobAbsent(error)) errors.push(error); }
  }
  for (const task of state.store.taskAuthorities()) {
    if (task.status === "completed") continue;
    try {
      const current = state.store.readTask(task.task.job_id);
      if (!current || current.status === "completed") continue;
      if (!current.attempt_failure) {
        throw executionFailure("failed", "RUNTIME_SHUTDOWN_RESULT_UNCONFIRMED");
      }
      const remote = await readProductionDeviceJobStatus(state.session, current.task.job_id);
      if (remote.attempt_failure && !remoteFailureMatches(remote, current.attempt_failure)) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT");
      }
      if (!releaseReceiptMatches(remote, current.attempt_failure)
        && !remoteFailureMatches(remote, current.attempt_failure)) {
        throw executionFailure("failed", "RUNTIME_SHUTDOWN_FAILURE_UNCONFIRMED");
      }
      errors.push(executionFailure("failed", current.attempt_failure.failure_core.code, {
        cause: current.attempt_failure.failure_core.cause,
        metadata: { evidence: { evidenceRef: `production-task:${current.task.job_id}`,
          evidenceHash: hashCanonical(current) } },
      }));
    } catch (error) { errors.push(error); }
  }
  if (state.browserAuthority.hasUnresolvedBrowserMutation()) {
    errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_BROWSER_UNRESOLVED"));
  }
  if (state.store.pendingOutboxCount() > 0) {
    errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_OUTBOX_PENDING"));
  }
  if (state.store.pendingBrowserCleanupJobIds().length > 0) {
    errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_BROWSER_CLEANUP_PENDING"));
  }
  if (state.store.providerCooldownSessionRecoveryIdentity() !== null) {
    errors.push(executionFailure("failed", "RUNTIME_SHUTDOWN_COOLDOWN_PENDING"));
  }
  return errors;
};

const finishShutdown = (span: RuntimeSpanHandle | null, errors: readonly unknown[]): void => {
  if (errors.length) {
    const failure = new AggregateError(errors, "RUNTIME_SHUTDOWN_INCOMPLETE");
    if (!span) throw failure;
    const evidence = executionFailureMetadata(errors[0])?.evidence;
    const terminal = terminalSpanFailure(span, errors[0], runtimeLogCauseEventId(errors[0]),
      failureCode(errors[0], "RUNTIME_SHUTDOWN_INCOMPLETE"), evidence
        ? { authorityRef: evidence.evidenceRef, authorityHash: evidence.evidenceHash } : undefined);
    throw withRuntimeLogCause(failure, terminal.eventId);
  }
  if (!span) throw new Error("RUNTIME_SHUTDOWN_LOG_MISSING");
  requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
};

export const shutdownRuntime = async (
  state: RuntimeState, loop: Promise<void>, heartbeat: Promise<void>, drainPass: () => Promise<void>,
): Promise<void> => {
  state.draining = true;
  state.drainJobIds = new Set([...state.active.keys(), ...state.store.taskAuthorities()
    .filter(task => task.status !== "completed").map(task => task.task.job_id)]);
  const errors: unknown[] = [];
  let span: RuntimeSpanHandle | null = null;
  try {
    span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
      traceId: `producer:${state.runtimeLogger.producerRunId}`, owner: "production-runtime",
      component: "production-runtime", operation: "runtime.shutdown",
      typedIdentity: { kind: "producer", producerId: state.runtimeLogger.producerRunId },
    }));
  } catch (error) { errors.push(error); }
  await state.iteration?.catch(error => {
    if (failureCode(error) !== "PRODUCTION_CLAIM_STOPPED") errors.push(error);
  });
  const tasks = await Promise.allSettled([...state.active.values()]);
  for (const task of tasks) if (task.status === "rejected") errors.push(task.reason);
  await state.iteration?.catch(error => {
    if (failureCode(error) !== "PRODUCTION_CLAIM_STOPPED") errors.push(error);
  });
  for (const task of state.store.pendingBusinessAdmissions()) {
    try { await reconcileBusinessAdmission(state, task); } catch (error) { errors.push(error); }
  }
  const finalPasses = Math.max(1, new Set([...state.store.pendingBrowserCleanupJobIds(),
    ...state.store.pendingBusinessAdmissions().map(task => task.task.job_id)]).size);
  for (let pass = 0; pass < finalPasses; pass++) await drainPass();
  // Only loop waits are interrupted. Product controllers remain untouched.
  state.abort.abort();
  const loops = await Promise.allSettled([loop, heartbeat]);
  for (const settled of loops) if (settled.status === "rejected") errors.push(settled.reason);
  try { errors.push(...await inspectDrainedTasks(state)); } catch (error) { errors.push(error); }
  let retainSession = true;
  try { retainSession = state.store.providerCooldownSessionRecoveryIdentity() !== null; }
  catch (error) { errors.push(error); }
  if (!retainSession) await state.session.close().catch(error => { errors.push(error); });
  try { state.store.close(); } catch (error) { errors.push(error); }
  state.stopped = true;
  finishShutdown(span, errors);
};

const createRuntimeHandle = (
  input: ProductionRuntimeStartInput, state: RuntimeState,
): ProductionRuntimeHandle => {
  let drainPassFinished: (() => void) | null = null;
  const loop = workerLoop(state, () => { drainPassFinished?.(); drainPassFinished = null; });
  const heartbeat = sessionHeartbeatLoop(state);
  const drainPass = (): Promise<void> => new Promise(resolve => { drainPassFinished = resolve; });
  let closing: Promise<void> | null = null;
  return {
    blocked: false,
    readHealth: () => readHealth(state),
    readOperationsSnapshot: jobId => readProductionOperationsSnapshot({
      dataDir: input.dataDir, store: state.store, browser: input.browserAuthority,
      health: () => readHealth(state), session: state.session, jobId,
    }),
    close: () => { state.draining = true; closing ??= shutdownRuntime(state, loop, heartbeat, drainPass); return closing; },
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
  try {
    store.assertStartupDataIntegrity();
    input.browserAuthority.verifyRuntimeTaskProvenance(store.earliestTaskCreatedAt());
    const inventory = await readProductionRuntimeStorageInventory(
      input.dataDir, store.storageResponsibilities(),
    );
    if (inventory.orphan_directory_count > 0) {
      throw executionFailure("failed", "PRODUCTION_ORPHAN_STORAGE_RECONCILIATION_REQUIRED");
    }
  } catch (error) {
    terminalSpanFailure(startSpan, error, runtimeLogCauseEventId(error), "RUNTIME_START_FAILED");
    return blockedRuntimeHandle(input, store, error);
  }
  let credential: Awaited<ReturnType<typeof readProductionCredential>>;
  if (input.stopSignal?.aborted) {
    const stopped = executionFailure("failed", "PRODUCTION_RUNTIME_STOPPED_BEFORE_SESSION");
    requireRuntimeLogWrite(startSpan.terminal({ outcome: "succeeded" }));
    return blockedRuntimeHandle(input, store, stopped);
  }
  try { credential = await readProductionCredential(input.dataDir); }
  catch (error) {
    terminalSpanFailure(startSpan, error, runtimeLogCauseEventId(error), "RUNTIME_START_FAILED");
    return blockedRuntimeHandle(input, store, error);
  }
  const state = createRuntimeState(input, store, credential);
  const sessionFailure = await establishCloudSession(input, state, startSpan);
  const transportFailure = sessionFailure === null
    ? null : typedRuntimeTransportFailure(sessionFailure);
  if (transportFailure?.httpStatus === 409
    && failureCode(sessionFailure) === "AI_SESSION_BINDING_MISMATCH") {
    return blockedRuntimeHandle(
      input, store, sessionFailure, productionControlContractVersion,
    );
  }
  return createRuntimeHandle(input, state);
};
