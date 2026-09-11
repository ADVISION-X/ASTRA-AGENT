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
import { executionFailure, failureCode } from "../../execution-failure.js";
import { productionCatalogHash } from "./catalog.js";
import { productionControlContractVersion } from "./control-contract-dependency.js";
import type { ProductionHash } from "./contracts.js";
import { readProductionCredential } from "./credential.js";
import { ProductionExecutor } from "./executor.js";
import { ProductionRuntimeStore } from "./store.js";
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
  controlContractVersion: number | null = null,
): ProductionRuntimeHandle => {
  const traceId = `producer:${input.runtimeLogger.producerRunId}`;
  let stopped = false;
  return {
    readHealth: () => blockedHealth(input, store, error, stopped, controlContractVersion),
    readOperationsSnapshot: (jobId) => readProductionOperationsSnapshot({
      dataDir: input.dataDir, store, browser: input.browserAuthority,
      health: () => blockedHealth(input, store, error, stopped, controlContractVersion),
      session: null, jobId,
    }),
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

const reconcileLocalState = async (state: RuntimeState): Promise<void> => {
  let complete = true;
  try { state.store.reconcileDeliveredTerminals(); }
  catch (error) {
    complete = false;
    state.lastErrorCode = failureCode(error, "PRODUCTION_TERMINAL_RECONCILIATION_FAILED");
    state.lastErrorReason = safeReason(error);
  }
  state.reconciliationBaselineValid = complete;
  refreshLedgerReconciled(state);
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
    await state.session.open(boundaryId);
    state.store.reconcileDeliveredTerminals();
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

const finishShutdown = (
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
  await state.session.close().catch((error) => errors.push(error));
  state.stopped = true;
  try { state.store.close(); } catch (error) { errors.push(error); }
  finishShutdown(span, errors);
};

const createRuntimeHandle = (
  input: ProductionRuntimeStartInput,
  state: RuntimeState,
): ProductionRuntimeHandle => {
  const loop = workerLoop(state);
  const heartbeat = sessionHeartbeatLoop(state);
  return {
    readHealth: () => readHealth(state),
    readOperationsSnapshot: (jobId) => readProductionOperationsSnapshot({
      dataDir: input.dataDir, store: state.store, browser: input.browserAuthority,
      health: () => readHealth(state), session: state.session, jobId,
    }),
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
  try {
    store.assertStartupDataIntegrity();
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
  try { credential = await readProductionCredential(input.dataDir); }
  catch (error) {
    terminalSpanFailure(startSpan, error, runtimeLogCauseEventId(error), "RUNTIME_START_FAILED");
    return blockedRuntimeHandle(input, store, error);
  }
  const state = createRuntimeState(input, store, credential);
  await reconcileLocalState(state);
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
