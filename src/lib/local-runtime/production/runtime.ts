import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { productionCatalogHash } from "./catalog.js";
import {
  checkpointProductionTask,
  claimProductionTasks,
  downloadProductionMaterials,
  flushProductionOutbox,
  releaseProductionLease,
  renewProductionLease,
  terminalProductionTask,
  uploadProductionResult,
} from "./cloud-client.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import { readProductionCredential } from "./credential.js";
import { ProductionExecutor, type ProductionExecutionLease } from "./executor.js";
import { ProductionRuntimeStore } from "./store.js";
import {
  PRODUCTION_V6_MANIFEST_HASH,
  websiteAgentTaskFromClaim,
  type ClaimedProductionTask,
} from "./transport-protocol.js";
import { ProductionWorkerSession } from "./worker-session.js";

export interface ProductionRuntimeHealth {
  readonly shellState: "ready";
  readonly cloudState: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly browserState: "ready" | "blocked";
  readonly executionState: "ready" | "blocked" | "draining";
  readonly claimAdmissionState: "eligible" | "blocked" | "draining";
  readonly browserAuthorityState: "present" | "absent";
  readonly browserTargetState: "claimed" | "absent";
  readonly browserLaneState: "idle" | "busy" | "blocked";
  readonly contractManifestHash: ProductionHash;
  readonly catalogHash: ProductionHash;
  readonly activeCount: number;
  readonly pendingOutboxCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
}

export interface ProductionRuntimeHandle {
  readonly close: () => Promise<void>;
  readonly readHealth: () => ProductionRuntimeHealth;
  readonly readTask: (jobId: string) => ReturnType<ProductionRuntimeStore["readTask"]>;
}

type RuntimeState = {
  readonly abort: AbortController;
  readonly active: Map<string, Promise<void>>;
  readonly activeAbort: Map<string, AbortController>;
  readonly store: ProductionRuntimeStore;
  readonly executor: ProductionExecutor;
  readonly session: ProductionWorkerSession;
  readonly browserAuthority: WorkbenchBrowserAuthority;
  readonly gpt: GptAbilityGroup;
  readonly dataDir: string;
  draining: boolean;
  lastHeartbeat: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  stopped: boolean;
};

const wait = async (milliseconds: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
};

const safeReason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").slice(0, 1_000);

const classifyFailure = (error: unknown): "recovery_pending" | "review_required" | "failed" => {
  const reason = safeReason(error);
  if (/BROWSER_OUTCOME_UNKNOWN|review_required|PLUGIN_IDENTITY_CHANGED|CHECKPOINT_.*DRIFT|CONTINUATION_NOT_AUTHORIZED/iu.test(reason)) {
    return "review_required";
  }
  if (/fetch failed|ECONN|ETIMEDOUT|UND_ERR|PROVIDER.*(?:RECOVERY|TIMEOUT)|BROWSER_BACKPRESSURE/iu.test(reason)) {
    return "recovery_pending";
  }
  return "failed";
};

const leaseBudget = (job: ClaimedProductionTask, abort: AbortController): ProductionExecutionLease => {
  const serverNow = Date.parse(job.grant.server_now);
  const leaseExpires = Date.parse(job.grant.lease_expires_at);
  const remaining = leaseExpires - serverNow;
  if (!Number.isFinite(remaining) || remaining < 30_000) throw new Error("V6_DEADLINE_BUDGET_EXHAUSTED");
  return {
    attempt_id: job.grant.attempt_id,
    device_id: job.grant.device_id,
    lease_version: job.grant.lease_version,
    execution_fence_hash: job.grant.execution_fence.fence_hash,
    control_manifest_hash: job.grant.control_contract_manifest_hash,
    expires_at_monotonic: performance.now() + remaining - 10_000,
    command_ttl_ms: Math.min(20_000, remaining - 10_000),
    abort_signal: abort.signal,
  };
};

const heartbeatWhileRunning = async <T>(
  state: RuntimeState,
  job: ClaimedProductionTask,
  budget: ProductionExecutionLease,
  checkpointHash: ProductionHash,
  execution: Promise<T>,
  abort: AbortController,
): Promise<T> => {
  let settled = false;
  const tracked = execution.finally(() => { settled = true; });
  while (!settled && !abort.signal.aborted) {
    await Promise.race([tracked, wait(20_000, abort.signal)]);
    if (settled || abort.signal.aborted) break;
    const receipt = await renewProductionLease(state.session, job, checkpointHash);
    const relative = Date.parse(receipt.lease_expires_at) - Date.parse(receipt.server_now);
    if (!Number.isFinite(relative) || relative < 30_000) throw new Error("V6_RENEW_BUDGET_INVALID");
    budget.expires_at_monotonic = performance.now() + relative - 10_000;
    budget.command_ttl_ms = Math.min(20_000, relative - 10_000);
    if (receipt.control_intent.intent !== "none") {
      abort.abort(`CONTROL_INTENT:${receipt.control_intent.intent}:${receipt.control_intent.reason_code ?? "none"}`);
    }
  }
  return tracked;
};

const executeClaim = async (state: RuntimeState, job: ClaimedProductionTask): Promise<void> => {
  const abort = state.activeAbort.get(job.job_id)!;
  let accepted = false;
  const materialDir = path.join(state.dataDir, "plugin-tasks", "production-runtime", job.job_id, "materials");
  try {
    if (job.grant.capability_manifest_hash !== productionCatalogHash) {
      throw new Error("CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT");
    }
    const task = websiteAgentTaskFromClaim(job);
    const budget = leaseBudget(job, abort);
    const durableAccept = state.executor.accept(task);
    accepted = true;
    const acceptanceCheckpoint = await checkpointProductionTask(
      state.session, state.store, job, "inputs_downloading", "durable_plugin_accept",
    );
    const materials = await downloadProductionMaterials(state.session, job, materialDir);
    await checkpointProductionTask(state.session, state.store, job, "factory_running", "materials_verified");
    const uploadState: { value?: Awaited<ReturnType<typeof uploadProductionResult>> } = {};
    const execution = await heartbeatWhileRunning(
      state,
      job,
      budget,
      acceptanceCheckpoint,
      state.executor.execute(task, materials, budget, async (output, continuationRef) => {
        const uploaded = await uploadProductionResult(
          state.session,
          state.store,
          job,
          durableAccept.identity,
          output,
          continuationRef,
        );
        uploadState.value = uploaded;
        return uploaded.envelope;
      }),
      abort,
    );
    const uploaded = uploadState.value;
    if (!uploaded) throw new Error("PLUGIN_RESULT_UPLOAD_MISSING");
    await terminalProductionTask(state.session, state.store, job, {
      status: "completed",
      payload_hash: hashCanonical(execution.result),
      result_receipt_hashes: [uploaded.payload_receipt.receipt_hash, uploaded.envelope_receipt.receipt_hash],
    });
    state.store.setTerminal(job.job_id, "completed", null, execution.result);
    await rm(materialDir, { recursive: true, force: true });
  } catch (error) {
    const reason = safeReason(error);
    const status = classifyFailure(error);
    if (!accepted) {
      await releaseProductionLease(
        state.session,
        job,
        /DEADLINE/iu.test(reason) ? "DEADLINE_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
      ).catch(() => undefined);
      return;
    }
    if (status === "recovery_pending") {
      state.store.setRecoveryPending(job.job_id, reason);
      await checkpointProductionTask(state.session, state.store, job, "recovery_pending", reason)
        .catch(() => undefined);
      return;
    }
    const terminalHash = hashCanonical({ job_id: job.job_id, status, reason });
    await terminalProductionTask(state.session, state.store, job, {
      status,
      payload_hash: terminalHash,
      result_receipt_hashes: [],
    }).catch((terminalError) => {
      state.store.setRecoveryPending(job.job_id, `TERMINAL_DEFERRED:${safeReason(terminalError)}`);
      throw terminalError;
    });
    state.store.setTerminal(job.job_id, status, reason, null);
    await rm(materialDir, { recursive: true, force: true });
  }
};

const runtimeState = async (state: RuntimeState) => {
  const browser = state.browserAuthority.readProductionRuntimeState();
  const lane: "blocked" | "busy" | "idle" = state.browserAuthority.readProductionRuntimeState().browserAuthorityState !== "present"
    ? "blocked"
    : state.active.size > 0 ? "busy" : "idle";
  return {
    business_in_flight: state.active.size,
    browser_action_in_flight: lane === "busy" ? 1 as const : 0 as const,
    browser_authority_state: browser.browserAuthorityState,
    browser_target_state: browser.browserTargetState,
    browser_lane_state: lane,
    drain_state: state.draining ? "draining" as const : "open" as const,
    ledger_reconciled: true,
  };
};

const readHealth = (state: RuntimeState): ProductionRuntimeHealth => {
  const browser = state.browserAuthority.readProductionRuntimeState();
  const cloudState = state.stopped
    ? "stopped"
    : state.lastErrorCode
      ? /(?:CONTRACT|CREDENTIAL|MANIFEST|ORIGIN|REENROLL)/iu.test(state.lastErrorCode)
        ? "contract_blocked"
        : "transient_degraded"
      : "ready";
  return {
    shellState: "ready",
    cloudState,
    browserState: browser.browserAuthorityState === "present" ? "ready" : "blocked",
    executionState: cloudState === "ready" ? state.draining ? "draining" : "ready" : "blocked",
    claimAdmissionState: cloudState === "ready" && browser.browserAuthorityState === "present"
      ? state.draining ? "draining" : "eligible"
      : "blocked",
    browserAuthorityState: browser.browserAuthorityState,
    browserTargetState: browser.browserTargetState,
    browserLaneState: browser.browserAuthorityState === "present" ? "idle" : "blocked",
    contractManifestHash: state.session.device.control_manifest_hash,
    catalogHash: productionCatalogHash,
    activeCount: state.active.size,
    pendingOutboxCount: state.store.pendingOutboxCount(),
    lastSuccessfulHeartbeatAt: state.lastHeartbeat,
    lastErrorCode: state.lastErrorCode,
    lastErrorReason: state.lastErrorReason,
    checkedAt: new Date().toISOString(),
  };
};

const workerLoop = async (state: RuntimeState): Promise<void> => {
  let delay = 1_000;
  while (!state.abort.signal.aborted) {
    try {
      if (state.active.size === 0) await flushProductionOutbox(state.session, state.store);
      const attestation = await state.session.ensureFreshAttestation();
      state.lastHeartbeat = attestation.issued_at;
      const available = Math.min(10 - state.active.size, state.executor.availableCapacity());
      if (available > 0 && attestation.claim_eligible && !state.draining) {
        const batch = await claimProductionTasks(state.session, available);
        delay = batch.outcome === "LEASE_GRANTED" ? 1_000 : batch.next_claim_after_ms;
        for (const job of [...batch.jobs].sort((left, right) => left.job_id.localeCompare(right.job_id))) {
          if (state.active.has(job.job_id)) continue;
          const abort = new AbortController();
          state.activeAbort.set(job.job_id, abort);
          const tracked = executeClaim(state, job).catch((error) => {
            state.lastErrorCode = safeReason(error).split(":")[0] ?? "PLUGIN_EXECUTION_FAILED";
            state.lastErrorReason = safeReason(error);
          }).finally(() => {
            state.active.delete(job.job_id);
            state.activeAbort.delete(job.job_id);
          });
          state.active.set(job.job_id, tracked);
        }
      }
      state.lastErrorCode = null;
      state.lastErrorReason = null;
    } catch (error) {
      state.lastErrorCode = safeReason(error).split(":")[0] ?? "PRODUCTION_RUNTIME_FAILED";
      state.lastErrorReason = safeReason(error);
      delay = Math.min(30_000, Math.max(1_000, delay * 2));
    }
    await wait(delay, state.abort.signal);
  }
};

const sessionHeartbeatLoop = async (state: RuntimeState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await wait(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    try {
      const receipt = await state.session.heartbeat();
      state.lastHeartbeat = receipt.issued_at;
    } catch (error) {
      state.lastErrorCode = safeReason(error).split(":")[0] ?? "SESSION_HEARTBEAT_FAILED";
      state.lastErrorReason = safeReason(error);
    }
  }
};

export async function startProductionRuntime(input: Readonly<{
  dataDir: string;
  sourceHash: ProductionHash;
  gpt: GptAbilityGroup;
  browserAuthority: WorkbenchBrowserAuthority;
}>): Promise<ProductionRuntimeHandle> {
  await mkdir(input.dataDir, { recursive: true });
  const store = new ProductionRuntimeStore(input.dataDir);
  let credential;
  try {
    credential = await readProductionCredential(input.dataDir);
  } catch (error) {
    const reason = safeReason(error);
    let stopped = false;
    return {
      readHealth: () => {
        const browser = input.browserAuthority.readProductionRuntimeState();
        return {
          shellState: "ready",
          cloudState: stopped ? "stopped" : "contract_blocked",
          browserState: browser.browserAuthorityState === "present" ? "ready" : "blocked",
          executionState: "blocked",
          claimAdmissionState: "blocked",
          browserAuthorityState: browser.browserAuthorityState,
          browserTargetState: browser.browserTargetState,
          browserLaneState: browser.browserAuthorityState === "present" ? "idle" : "blocked",
          contractManifestHash: PRODUCTION_V6_MANIFEST_HASH,
          catalogHash: productionCatalogHash,
          activeCount: 0,
          pendingOutboxCount: store.pendingOutboxCount(),
          lastSuccessfulHeartbeatAt: null,
          lastErrorCode: reason.split(":")[0] ?? "PRODUCTION_CREDENTIAL_INVALID",
          lastErrorReason: reason,
          checkedAt: new Date().toISOString(),
        };
      },
      readTask: (jobId) => store.readTask(jobId),
      async close() {
        stopped = true;
        store.close();
      },
    };
  }
  let stateRef: RuntimeState | null = null;
  const session = new ProductionWorkerSession(
    credential,
    () => runtimeState(stateRef!),
    input.sourceHash,
  );
  const executor = new ProductionExecutor(
    input.dataDir, input.sourceHash, input.gpt, input.browserAuthority, store,
  );
  const state: RuntimeState = {
    abort: new AbortController(),
    active: new Map(),
    activeAbort: new Map(),
    store,
    executor,
    session,
    browserAuthority: input.browserAuthority,
    gpt: input.gpt,
    dataDir: input.dataDir,
    draining: false,
    lastHeartbeat: null,
    lastErrorCode: null,
    lastErrorReason: null,
    stopped: false,
  };
  stateRef = state;
  try {
    await session.open();
    await flushProductionOutbox(session, store);
    const receipt = await session.heartbeat();
    state.lastHeartbeat = receipt.issued_at;
  } catch (error) {
    state.lastErrorCode = safeReason(error).split(":")[0] ?? "PRODUCTION_SESSION_START_FAILED";
    state.lastErrorReason = safeReason(error);
  }
  const loop = workerLoop(state);
  const heartbeat = sessionHeartbeatLoop(state);
  return {
    readHealth: () => readHealth(state),
    readTask: (jobId) => store.readTask(jobId),
    async close() {
      state.draining = true;
      await session.heartbeat().catch(() => undefined);
      state.abort.abort();
      for (const controller of state.activeAbort.values()) controller.abort("PRODUCTION_RUNTIME_STOPPED");
      await Promise.all([loop, heartbeat]);
      await Promise.allSettled([...state.active.values()]);
      await flushProductionOutbox(session, store).catch(() => undefined);
      await session.close().catch(() => undefined);
      state.stopped = true;
      store.close();
    },
  };
}
