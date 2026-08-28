import { mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import {
  executionFailure,
  failureCode,
  failureStatus,
  serializeTerminalFailure,
  typedExecutionFailure,
} from "../../typed-failure.js";
import { resolveStoredBrowserMutationAuthority } from "../../browser/exact-target/browser-mutation-store.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  diagnoseRuntimeLog,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeDiagnosis,
  type RuntimeLogger,
  type RuntimeSpanHandle,
  type RuntimeSpanTerminalEvent,
} from "../../runtime-logs/index.js";
import type {
  RuntimeStateInput,
  RuntimeStateKey,
  RuntimeStateValue,
} from "../../runtime-logs/schema.js";
import { productionCatalogHash, resolveProductionPlugin } from "./catalog.js";
import {
  checkpointProductionTask,
  claimProductionTasks,
  cleanupGeneratedImageTemporaryFiles,
  downloadProductionMaterials,
  readProductionDeviceJobStatus,
  releaseProductionLease,
  renewProductionLease,
  sendProductionOutboxWrite,
  terminalProductionTask,
  uploadProductionResult,
} from "./cloud-client.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import { readProductionCredential } from "./credential.js";
import {
  ProductionExecutor,
  type ProductionExecutionLease,
} from "./executor.js";
import {
  ProductionRuntimeStore,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
  type ProductionOutboxAuthority,
} from "./store.js";
import {
  PRODUCTION_V6_MANIFEST_HASH,
  websiteAgentTaskFromClaim,
  type ClaimedProductionTask,
} from "./transport-protocol.js";
import { ProductionWorkerSession } from "./worker-session.js";

export interface ProductionRuntimeHealth {
  readonly shellState: "ready";
  readonly cloudState:
    "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly browserState: "ready" | "blocked";
  readonly executionState: "ready" | "blocked" | "draining";
  readonly claimAdmissionState: "eligible" | "blocked" | "draining";
  readonly logSinkState: "ready" | "failed" | "capacity_blocked";
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
  readonly readTask: (
    jobId: string,
  ) => ReturnType<ProductionRuntimeStore["readTask"]>;
  readonly diagnose: (jobId: string) => RuntimeDiagnosis;
}

const diagnoseProductionRuntime = (
  dataDir: string,
  store: ProductionRuntimeStore,
  jobId: string,
): RuntimeDiagnosis =>
  diagnoseRuntimeLog({
    sources: [path.join(dataDir, "runtime-logs")],
    traceId: jobId,
    authorityResolver: (authorityRef, authorityHash) => {
      const production = store.resolveAuthority(authorityRef, authorityHash);
      return production !== "missing"
        ? production
        : resolveStoredBrowserMutationAuthority(
            dataDir,
            authorityRef,
            authorityHash,
          );
    },
  });

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
  readonly runtimeLogger: RuntimeLogger;
  readonly loggedStates: Map<string, RuntimeStateValue>;
  draining: boolean;
  lastHeartbeat: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  stopped: boolean;
  ledgerReconciled: boolean;
  reconciliationBaselineValid: boolean;
};

const refreshLedgerReconciled = (state: RuntimeState): void => {
  state.ledgerReconciled =
    state.reconciliationBaselineValid &&
    state.browserAuthority.readBrowserLaneState() !== "unsettled" &&
    state.store.isLedgerConsistent(new Set(state.active.keys()));
};

const wait = async (
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> => {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
};

const safeReason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .replace(/\s+/gu, " ")
    .slice(0, 1_000);

const classifyFailure = failureStatus;

const recoveryFor = (
  status: ReturnType<typeof classifyFailure>,
): RuntimeRecovery => {
  if (status === "recovery_pending") return RuntimeRecovery.RETRY;
  if (status === "review_required") return RuntimeRecovery.REVIEW;
  return RuntimeRecovery.STOP;
};

const jobIdentity = (job: ClaimedProductionTask) => ({
  kind: "lease" as const,
  jobId: job.job_id,
  attemptId: job.grant.attempt_id,
  leaseVersion: job.grant.lease_version,
  fenceHash: job.grant.execution_fence.fence_hash,
});

const leaseAuthority = (
  job: ClaimedProductionTask,
  state: ProductionLeaseAuthority["state"],
  expiresAt: string | null,
): ProductionLeaseAuthority => ({
  jobId: job.job_id,
  attemptId: job.grant.attempt_id,
  leaseVersion: job.grant.lease_version,
  fenceHash: job.grant.execution_fence.fence_hash,
  state,
  expiresAt,
});

const checkpointAuthority = (
  job: ClaimedProductionTask,
  state: ProductionCheckpointAuthority["state"],
  checkpointId: string | null,
  checkpointHash: ProductionHash | null,
): ProductionCheckpointAuthority => ({
  jobId: job.job_id,
  attemptId: job.grant.attempt_id,
  checkpointId,
  checkpointHash,
  state,
});

const emitRuntimeState = (
  input: Readonly<{
    state: RuntimeState;
    stateKey: RuntimeStateKey;
    current: RuntimeStateValue;
    traceId?: string;
    authorityRef?: string;
    authorityHash?: `sha256:${string}`;
    freshForMs?: number;
    force?: boolean;
    reconciledFromAuthority?: boolean;
    owner?: "app-shell" | "production-runtime" | "outbox";
  }>,
): void => {
  const traceId =
    input.traceId ?? `producer:${input.state.runtimeLogger.producerRunId}`;
  const stateSubject =
    input.stateKey === "browser.mutation" ||
    input.stateKey === "outbox.delivery"
      ? (input.authorityRef ?? traceId)
      : traceId;
  const stateIdentity = `${stateSubject}\u0000${input.stateKey}`;
  const previous = input.state.loggedStates.get(stateIdentity) ?? null;
  if (!input.force && previous === input.current) return;
  requireRuntimeLogWrite(
    input.state.runtimeLogger.emitState({
      traceId,
      owner: input.owner ?? "production-runtime",
      component: "production-runtime",
      stateKey: input.stateKey,
      previous,
      current: input.current,
      ...(input.freshForMs === undefined
        ? {}
        : { freshForMs: input.freshForMs }),
      ...(input.authorityRef && input.authorityHash
        ? {
            authorityRef: input.authorityRef,
            authorityHash: input.authorityHash,
            ...(input.reconciledFromAuthority === true
              ? { reconciledFromAuthority: true }
              : {}),
          }
        : {}),
    } as RuntimeStateInput),
  );
  input.state.loggedStates.set(stateIdentity, input.current);
};

const emitOutboxAuthority = (
  state: RuntimeState,
  authority: ProductionOutboxAuthority,
  reconciledFromAuthority = false,
): void => {
  emitRuntimeState({
    state,
    traceId: authority.jobId,
    stateKey: "outbox.delivery",
    current: authority.state,
    authorityRef: `production-outbox:${authority.idempotencyKey}`,
    authorityHash: hashCanonical(authority),
    owner: "outbox",
    ...(reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
  });
};

const emitLeaseAuthority = (
  state: RuntimeState,
  authority: ProductionLeaseAuthority,
  reconciledFromAuthority = false,
): void => {
  emitRuntimeState({
    state,
    traceId: authority.jobId,
    stateKey: "job.lease",
    current: authority.state,
    authorityRef: `production-lease:${authority.jobId}`,
    authorityHash: hashCanonical(authority),
    ...(reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
  });
};

const emitCheckpointAuthority = (
  state: RuntimeState,
  authority: ProductionCheckpointAuthority,
  reconciledFromAuthority = false,
): void => {
  emitRuntimeState({
    state,
    traceId: authority.jobId,
    stateKey: "job.checkpoint",
    current: authority.state,
    authorityRef: `production-checkpoint:${authority.jobId}`,
    authorityHash: hashCanonical(authority),
    ...(reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
  });
};

const terminalSpanFailure = (
  span: RuntimeSpanHandle,
  error: unknown,
  status: ReturnType<typeof classifyFailure>,
  causedByEventId: string | null = runtimeLogCauseEventId(error),
  fallbackCode = "PRODUCTION_ACTION_FAILED",
  authority?: Readonly<{
    authorityRef: string;
    authorityHash: `sha256:${string}`;
  }>,
): RuntimeSpanTerminalEvent =>
  requireRuntimeLogWrite(
    span.terminal({
      outcome: status === "review_required" ? "review_required" : "failed",
      ...(authority ?? {}),
      failure: runtimeFailureFromError({
        error,
        code: causedByEventId ? fallbackCode : typedExecutionFailure(error)?.code ?? fallbackCode,
        responsibleOwner: "production-runtime",
        recovery: recoveryFor(status),
        impact: causedByEventId
          ? RuntimeFailureImpact.CONSEQUENTIAL
          : RuntimeFailureImpact.BLOCKING,
        ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }),
  );

const runRuntimeSpan = async <T>(
  input: Readonly<{
    span: RuntimeSpanHandle;
    action: () => Promise<T>;
    success?: (
      value: T,
    ) => Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }>;
    failureCode?: string;
  }>,
): Promise<T> => {
  try {
    const value = await input.action();
    requireRuntimeLogWrite(
      input.span.terminal({
        outcome: "success",
        ...(input.success?.(value) ?? {}),
      }),
    );
    return value;
  } catch (error) {
    const event = terminalSpanFailure(
      input.span,
      error,
      classifyFailure(error),
      runtimeLogCauseEventId(error),
      input.failureCode,
    );
    throw withRuntimeLogCause(error, event.eventId);
  }
};

const runRuntimeSpanSync = <T>(
  input: Readonly<{
    span: RuntimeSpanHandle;
    action: () => T;
    success: (
      value: T,
    ) => Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }>;
    failureCode?: string;
  }>,
): T => {
  try {
    const value = input.action();
    requireRuntimeLogWrite(
      input.span.terminal({ outcome: "success", ...input.success(value) }),
    );
    return value;
  } catch (error) {
    const event = terminalSpanFailure(
      input.span,
      error,
      classifyFailure(error),
      runtimeLogCauseEventId(error),
      input.failureCode,
    );
    throw withRuntimeLogCause(error, event.eventId);
  }
};

const checkpointWithLog = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  parentSpanId: string,
  stage: Parameters<typeof checkpointProductionTask>[3],
  reason: string,
  attemptFailure: Parameters<typeof checkpointProductionTask>[5] = null,
): Promise<ProductionHash> => {
  const span = requireRuntimeLogWrite(
    state.runtimeLogger.startSpan({
      traceId: job.job_id,
      parentSpanId,
      owner: "production-runtime",
      component: "production-checkpoint",
      operation: "job.checkpoint",
      typedIdentity: {
        kind: "checkpoint",
        jobId: job.job_id,
        attemptId: job.grant.attempt_id,
        checkpointId: stage,
      },
    }),
  );
  try {
    const receipt = await checkpointProductionTask(
      state.session,
      state.store,
      job,
      stage,
      reason,
      attemptFailure,
    );
    const authority = state.store.recordCheckpoint(
      checkpointAuthority(job, "persisted", stage, receipt),
    );
    requireRuntimeLogWrite(
      span.terminal({
        outcome: "success",
        authorityRef: `production-checkpoint:${job.job_id}`,
        authorityHash: hashCanonical(authority),
      }),
    );
    emitCheckpointAuthority(state, authority);
    return receipt;
  } catch (error) {
    const authority = state.store.recordCheckpoint(
      checkpointAuthority(job, "failed", stage, null),
    );
    const terminal = terminalSpanFailure(
      span,
      error,
      classifyFailure(error),
      runtimeLogCauseEventId(error),
      "CHECKPOINT_STORAGE_FAILED",
      {
        authorityRef: `production-checkpoint:${job.job_id}`,
        authorityHash: hashCanonical(authority),
      },
    );
    emitCheckpointAuthority(state, authority);
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

const releaseLeaseWithLog = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  parentSpanId: string,
  reason: Parameters<typeof releaseProductionLease>[2],
  causedByEventId: string,
): Promise<void> => {
  const span = requireRuntimeLogWrite(
    state.runtimeLogger.startSpan({
      traceId: job.job_id,
      parentSpanId,
      owner: "production-runtime",
      component: "production-lease",
      operation: "job.lease-release",
      typedIdentity: jobIdentity(job),
    }),
  );
  try {
    await releaseProductionLease(state.session, job, reason);
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
  } catch (error) {
    const terminal = requireRuntimeLogWrite(
      span.terminal({
        outcome: "failed",
        failure: runtimeFailureFromError({
          error,
          code: "LEASE_RELEASE_FAILED",
          responsibleOwner: "production-runtime",
          recovery: RuntimeRecovery.REVIEW,
          impact: RuntimeFailureImpact.CLEANUP,
          causedByEventId,
        }),
      }),
    );
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

const leaseBudget = (
  job: ClaimedProductionTask,
  abort: AbortController,
): ProductionExecutionLease => {
  const serverNow = Date.parse(job.grant.server_now);
  const leaseExpires = Date.parse(job.grant.lease_expires_at);
  const deliveryDeadline = Date.parse(job.grant.delivery_deadline_at);
  const remaining = Math.min(leaseExpires, deliveryDeadline) - serverNow;
  if (!Number.isFinite(remaining) || remaining < 30_000)
    throw executionFailure("recovery_pending", "V6_DEADLINE_BUDGET_EXHAUSTED");
  return {
    attempt_id: job.grant.attempt_id,
    device_id: job.grant.device_id,
    lease_version: job.grant.lease_version,
    execution_fence_hash: job.grant.execution_fence.fence_hash,
    control_manifest_hash: job.grant.control_contract_manifest_hash,
    max_provider_turns: job.grant.max_provider_turns,
    provider_turns_used: 0,
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
  parentSpanId: string,
): Promise<T> => {
  let settled = false;
  const tracked = execution.finally(() => {
    settled = true;
  });
  while (!settled && !abort.signal.aborted) {
    await Promise.race([tracked, wait(20_000, abort.signal)]);
    if (settled || abort.signal.aborted) break;
    const renewSpan = requireRuntimeLogWrite(
      state.runtimeLogger.startSpan({
        traceId: job.job_id,
        parentSpanId,
        owner: "production-runtime",
        component: "production-lease",
        operation: "job.lease-renew",
        typedIdentity: jobIdentity(job),
      }),
    );
    let receipt;
    try {
      receipt = await renewProductionLease(state.session, job, checkpointHash);
      const authority = state.store.recordLease(
        leaseAuthority(job, "active", receipt.lease_expires_at),
      );
      requireRuntimeLogWrite(
        renewSpan.terminal({
          outcome: "success",
          authorityRef: `production-lease:${job.job_id}`,
          authorityHash: hashCanonical(authority),
        }),
      );
      emitLeaseAuthority(state, authority);
    } catch (error) {
      const authority = state.store.recordLease(
        leaseAuthority(job, "stale", null),
      );
      const terminal = terminalSpanFailure(
        renewSpan,
        error,
        classifyFailure(error),
        runtimeLogCauseEventId(error),
        "LEASE_RENEW_FAILED",
        {
          authorityRef: `production-lease:${job.job_id}`,
          authorityHash: hashCanonical(authority),
        },
      );
      emitLeaseAuthority(state, authority);
      throw withRuntimeLogCause(error, terminal.eventId);
    }
    const relative =
      Date.parse(receipt.lease_expires_at) - Date.parse(receipt.server_now);
    if (!Number.isFinite(relative) || relative < 30_000)
      throw executionFailure("recovery_pending", "V6_RENEW_BUDGET_INVALID");
    budget.expires_at_monotonic = performance.now() + relative - 10_000;
    budget.command_ttl_ms = Math.min(20_000, relative - 10_000);
    if (receipt.control_intent.intent !== "none") {
      abort.abort(
        `CONTROL_INTENT:${receipt.control_intent.intent}:${receipt.control_intent.reason_code ?? "none"}`,
      );
    }
  }
  return tracked;
};

const handleClaimFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  materialDir: string,
  accepted: boolean,
  error: unknown,
  parentSpanId: string,
  causeEventId: string,
): Promise<void> => {
  const reason = safeReason(error);
  const status = classifyFailure(error);
  const terminalFailure = serializeTerminalFailure(error);
  const withinRetryBudget =
    job.grant.attempt_number < job.grant.max_attempts &&
    Date.now() < Date.parse(job.grant.delivery_deadline_at);
  const decision =
    job.grant.attempt_mode === "reconciliation" ||
    Date.now() >= Date.parse(job.grant.delivery_deadline_at)
      ? ("FINAL_FAILED" as const)
      : terminalFailure.mutation_outcome === "dispatched"
        ? ("RECONCILE_ONLY" as const)
        : status === "recovery_pending" && withinRetryBudget
          ? ("RETRY_FROM_CHECKPOINT" as const)
          : ("FINAL_FAILED" as const);
  const durablyAccepted = accepted || state.store.readTask(job.job_id) !== null;
  if (!durablyAccepted) {
    await releaseLeaseWithLog(
      state,
      job,
      parentSpanId,
      failureCode(error).startsWith("V6_DEADLINE_")
        ? "DEADLINE_BUDGET_EXHAUSTED"
        : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
      causeEventId,
    );
    emitRuntimeState({
      state,
      traceId: job.job_id,
      stateKey: "job.lease",
      current: "absent",
    });
    return;
  }
  if (decision !== "FINAL_FAILED") {
    state.store.setRecoveryPending(job.job_id, reason);
    emitLeaseAuthority(
      state,
      state.store.recordLease(leaseAuthority(job, "stale", null)),
    );
    try {
      await checkpointWithLog(
        state,
        job,
        parentSpanId,
        "recovery_pending",
        reason,
        {
          ...terminalFailure,
          decision,
        },
      );
    } catch (checkpointError) {
      emitRuntimeState({
        state,
        traceId: job.job_id,
        stateKey: "job.checkpoint",
        current: "failed",
      });
      state.lastErrorCode = failureCode(
        checkpointError,
        "CHECKPOINT_STORAGE_FAILED",
      );
      state.lastErrorReason = safeReason(checkpointError);
    }
    const record = state.store.readTask(job.job_id)!;
    emitRuntimeState({
      state,
      traceId: job.job_id,
      stateKey: "job.lifecycle",
      current: "recovery_pending",
      authorityRef: `production-task:${job.job_id}`,
      authorityHash: hashCanonical(record),
    });
    return;
  }
  const terminalSpan = requireRuntimeLogWrite(
    state.runtimeLogger.startSpan({
      traceId: job.job_id,
      parentSpanId,
      boundaryId: job.grant.claim_batch_id,
      owner: "production-runtime",
      component: "production-runtime",
      operation: "job.terminal",
      typedIdentity: jobIdentity(job),
    }),
  );
  let terminalRecord: NonNullable<
    ReturnType<ProductionRuntimeStore["readTask"]>
  >;
  try {
    await terminalProductionTask(state.session, state.store, job, {
      status: "failed",
      failure: terminalFailure,
      payload_hash: hashCanonical({
        job_id: job.job_id,
        failure: terminalFailure,
      }),
      result_receipt_hashes: [],
    });
    state.store.setTerminal(job.job_id, "failed", terminalFailure, null);
    terminalRecord = state.store.readTask(job.job_id)!;
  } catch (terminalError) {
    state.store.setRecoveryPending(job.job_id, `TERMINAL_DEFERRED:${safeReason(terminalError)}`);
    const recoveryRecord = state.store.readTask(job.job_id)!;
    const terminal = requireRuntimeLogWrite(
      terminalSpan.terminal({
        outcome: "failed",
        authorityRef: `production-task:${job.job_id}`,
        authorityHash: hashCanonical(recoveryRecord),
        failure: runtimeFailureFromError({
          error: terminalError,
          code: "JOB_TERMINAL_DEFERRED",
          responsibleOwner: "production-runtime",
          recovery: RuntimeRecovery.RETRY,
          impact: RuntimeFailureImpact.CONSEQUENTIAL,
          causedByEventId: causeEventId,
        }),
      }),
    );
    emitRuntimeState({
      state,
      traceId: job.job_id,
      stateKey: "job.lifecycle",
      current: "recovery_pending",
      authorityRef: `production-task:${job.job_id}`,
      authorityHash: hashCanonical(recoveryRecord),
    });
    throw withRuntimeLogCause(terminalError, terminal.eventId);
  }
  requireRuntimeLogWrite(
    terminalSpan.terminal({
      outcome: "success",
      authorityRef: `production-task:${job.job_id}`,
      authorityHash: hashCanonical(terminalRecord),
    }),
  );
  emitRuntimeState({
    state,
    traceId: job.job_id,
    stateKey: "job.lifecycle",
    current: "failed",
    authorityRef: `production-task:${job.job_id}`,
    authorityHash: hashCanonical(terminalRecord),
  });
  emitLeaseAuthority(
    state,
    state.store.recordLease(leaseAuthority(job, "absent", null)),
  );
  await rm(materialDir, { recursive: true, force: true });
};

const executeClaim = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
): Promise<void> => {
  const abort = state.activeAbort.get(job.job_id)!;
  let accepted = false;
  const materialDir = path.join(
    state.dataDir,
    "plugin-tasks",
    "production-runtime",
    job.job_id,
    "materials",
  );
  const jobSpan = requireRuntimeLogWrite(
    state.runtimeLogger.startSpan({
      traceId: job.job_id,
      boundaryId: job.grant.claim_batch_id,
      owner: "production-runtime",
      component: "production-runtime",
      operation: "job.execute",
      typedIdentity: jobIdentity(job),
    }),
  );
  try {
    if (job.grant.capability_manifest_hash !== productionCatalogHash) {
      throw executionFailure(
        "review_required",
        "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT",
      );
    }
    const task = websiteAgentTaskFromClaim(job);
    const expectedPlugin = resolveProductionPlugin(
      task.product_id,
      task.action_id,
    ).plugin;
    if (
      job.grant.expected_catalog_hash !== productionCatalogHash ||
      job.grant.expected_plugin_id !== expectedPlugin.pluginId ||
      job.grant.expected_plugin_version !== expectedPlugin.pluginVersion
    ) {
      throw executionFailure(
        "review_required",
        "CLAIMED_PLUGIN_IDENTITY_MISMATCH",
      );
    }
    const budget = leaseBudget(job, abort);
    const acceptSpan = requireRuntimeLogWrite(
      state.runtimeLogger.startSpan({
        traceId: job.job_id,
        parentSpanId: jobSpan.spanId,
        owner: "production-runtime",
        component: "production-store",
        operation: "job.durable-accept",
        typedIdentity: jobIdentity(job),
      }),
    );
    const durableAccept = runRuntimeSpanSync({
      span: acceptSpan,
      action: () => state.executor.accept(task),
      failureCode: "DURABLE_ACCEPT_FAILED",
      success: (record) => ({
        authorityRef: `production-task:${job.job_id}`,
        authorityHash: hashCanonical(record),
      }),
    });
    accepted = true;
    if (
      durableAccept.status !== "accepted" &&
      durableAccept.status !== "running" &&
      durableAccept.status !== "recovery_pending"
    ) {
      throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
    }
    emitLeaseAuthority(
      state,
      state.store.recordLease(
        leaseAuthority(job, "active", job.grant.lease_expires_at),
      ),
    );
    emitCheckpointAuthority(
      state,
      state.store.recordCheckpoint(
        checkpointAuthority(job, "none", null, null),
      ),
    );
    emitRuntimeState({
      state,
      traceId: job.job_id,
      stateKey: "job.lifecycle",
      current: durableAccept.status,
      authorityRef: `production-task:${job.job_id}`,
      authorityHash: hashCanonical(durableAccept),
    });
    state.store.markRunning(job.job_id);
    const runningRecord = state.store.readTask(job.job_id)!;
    emitRuntimeState({
      state,
      traceId: job.job_id,
      stateKey: "job.lifecycle",
      current: "running",
      authorityRef: `production-task:${job.job_id}`,
      authorityHash: hashCanonical(runningRecord),
    });
    if (job.grant.attempt_mode === "reconciliation") {
      throw executionFailure("failed", "RECONCILIATION_EVIDENCE_UNAVAILABLE", {
        mutationOutcome: "dispatched",
        evidenceRef: `browser-mutation-job:${job.job_id}`,
      });
    }
    const materialSpan = requireRuntimeLogWrite(
      state.runtimeLogger.startSpan({
        traceId: job.job_id,
        parentSpanId: jobSpan.spanId,
        owner: "production-runtime",
        component: "production-materials",
        operation: "material.download-verify",
        typedIdentity: jobIdentity(job),
      }),
    );
    const materialResult = await runRuntimeSpan({
      span: materialSpan,
      failureCode: "MATERIAL_DOWNLOAD_VERIFY_FAILED",
      action: async () => {
        const acceptanceCheckpoint = await checkpointWithLog(
          state,
          job,
          materialSpan.spanId,
          "inputs_downloading",
          "durable_plugin_accept",
        );
        const materials = await downloadProductionMaterials(
          state.session,
          job,
          materialDir,
        );
        await checkpointWithLog(
          state,
          job,
          materialSpan.spanId,
          "factory_running",
          "materials_verified",
        );
        return { acceptanceCheckpoint, materials };
      },
    });
    const { acceptanceCheckpoint, materials } = materialResult;
    const uploadState: {
      value?: Awaited<ReturnType<typeof uploadProductionResult>>;
    } = {};
    const execution = await heartbeatWhileRunning(
      state,
      job,
      budget,
      acceptanceCheckpoint,
      state.executor.execute(task, materials,
        budget,
        jobSpan.spanId,
        async (output, continuationRef) => {
          const uploadSpan = requireRuntimeLogWrite(
            state.runtimeLogger.startSpan({
              traceId: job.job_id,
              parentSpanId: jobSpan.spanId,
              owner: "production-runtime",
              component: "production-result",
              operation: "result.upload",
              typedIdentity: jobIdentity(job),
            }),
          );
          const uploaded = await runRuntimeSpan({
            span: uploadSpan,
            failureCode: "RESULT_UPLOAD_FAILED",
            action: () =>
              uploadProductionResult(
                state.session,
                state.store,
                job,
                durableAccept.identity,
                output,
                continuationRef,
                state.dataDir,
              ),
          });
          uploadState.value = uploaded;
          return uploaded.envelope;
        },
      ),
      abort,
      jobSpan.spanId,
    );
    const uploaded = uploadState.value;
    if (!uploaded) throw new Error("PLUGIN_RESULT_UPLOAD_MISSING");
    const terminalSpan = requireRuntimeLogWrite(
      state.runtimeLogger.startSpan({
        traceId: job.job_id,
        parentSpanId: jobSpan.spanId,
        boundaryId: job.grant.claim_batch_id,
        owner: "production-runtime",
        component: "production-runtime",
        operation: "job.terminal",
        typedIdentity: jobIdentity(job),
      }),
    );
    const payloadHash = hashCanonical(execution.result);
    state.store.stageResult(job.job_id, execution.result);
    const completedRecord = await runRuntimeSpan({
      span: terminalSpan,
      failureCode: "JOB_TERMINAL_FAILED",
      action: async () => {
        await terminalProductionTask(state.session, state.store, job, {
          status: "completed",
          failure: null,
          payload_hash: payloadHash,
          result_receipt_hashes: uploaded.artifact_receipts.map(
            (receipt) => receipt.receipt_hash,
          ),
        });
        state.store.setTerminal(
          job.job_id,
          "completed",
          null,
          execution.result,
        );
        return state.store.readTask(job.job_id)!;
      },
      success: (record) => ({
        authorityRef: `production-task:${job.job_id}`,
        authorityHash: hashCanonical(record),
      }),
    });
    emitRuntimeState({
      state,
      traceId: job.job_id,
      stateKey: "job.lifecycle",
      current: "completed",
      authorityRef: `production-task:${job.job_id}`,
      authorityHash: hashCanonical(completedRecord),
    });
    emitLeaseAuthority(
      state,
      state.store.recordLease(leaseAuthority(job, "absent", null)),
    );
    await rm(materialDir, { recursive: true, force: true });
    requireRuntimeLogWrite(
      jobSpan.terminal({
        outcome: "success",
        authorityRef: `production-task:${job.job_id}`,
        authorityHash: hashCanonical(completedRecord),
      }),
    );
  } catch (error) {
    const normalizedError =
      abort.signal.aborted &&
      String(abort.signal.reason ?? "").includes("cancel_requested")
        ? executionFailure("failed", "USER_CANCELLED", {
            mutationOutcome: "no",
            cause: error,
          })
        : error;
    const status = classifyFailure(normalizedError);
    const failureEvent = terminalSpanFailure(
      jobSpan,
      normalizedError,
      status,
      runtimeLogCauseEventId(normalizedError),
      "JOB_EXECUTION_FAILED",
    );
    await handleClaimFailure(
      state,
      job,
      materialDir,
      accepted,
      normalizedError,
      jobSpan.spanId,
      failureEvent.eventId,
    );
  }
};

const runtimeState = async (state: RuntimeState) => {
  refreshLedgerReconciled(state);
  const browser = state.browserAuthority.readProductionRuntimeState();
  const observedLane = state.browserAuthority.readBrowserLaneState();
  const lane: "blocked" | "busy" | "idle" =
    browser.browserAuthorityState !== "present" || observedLane === "unsettled"
      ? "blocked"
      : observedLane;
  return {
    business_in_flight: state.active.size,
    browser_action_in_flight:
      observedLane === "busy" ? (1 as const) : (0 as const),
    browser_authority_state: browser.browserAuthorityState,
    browser_target_state: browser.browserTargetState,
    browser_lane_state: lane,
    drain_state: state.draining ? ("draining" as const) : ("open" as const),
    ledger_reconciled: state.ledgerReconciled,
  };
};

const readHealth = (state: RuntimeState): ProductionRuntimeHealth => {
  refreshLedgerReconciled(state);
  const browser = state.browserAuthority.readProductionRuntimeState();
  const browserLane = state.browserAuthority.readBrowserLaneState();
  const cloudState = state.stopped
    ? "stopped"
    : state.lastErrorCode
      ? /(?:CONTRACT|CREDENTIAL|MANIFEST|ORIGIN|REENROLL)/iu.test(
          state.lastErrorCode,
        )
        ? "contract_blocked"
        : "transient_degraded"
      : "ready";
  return {
    shellState: "ready",
    cloudState,
    browserState:
      browser.browserAuthorityState === "present" ? "ready" : "blocked",
    executionState:
      cloudState === "ready" && state.ledgerReconciled
        ? state.draining
          ? "draining"
          : "ready"
        : "blocked",
    claimAdmissionState:
      cloudState === "ready" &&
      state.ledgerReconciled &&
      browser.browserAuthorityState === "present" &&
      state.runtimeLogger.isWritable()
        ? state.draining
          ? "draining"
          : "eligible"
        : "blocked",
    logSinkState: state.runtimeLogger.getSinkState(),
    browserAuthorityState: browser.browserAuthorityState,
    browserTargetState: browser.browserTargetState,
    browserLaneState:
      browser.browserAuthorityState !== "present"
        ? "blocked"
        : browserLane === "unsettled"
          ? "blocked"
          : browserLane,
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

const flushOutboxWithLog = async (state: RuntimeState): Promise<void> => {
  for (const write of state.store.pendingOutbox()) {
    const current = state.store.readOutboxAuthority(write.idempotency_key)!;
    if (current.state === "failed")
      state.store.markOutboxPending(write.idempotency_key);
    const authority = state.store.readOutboxAuthority(write.idempotency_key)!;
    const span = requireRuntimeLogWrite(
      state.runtimeLogger.startSpan({
        traceId: authority.jobId,
        owner: "outbox",
        component: "production-outbox",
        operation: "outbox.flush",
        typedIdentity: {
          kind: "outbox",
          jobId: authority.jobId,
          outboxId: authority.idempotencyKey,
        },
      }),
    );
    try {
      await state.store.deliverOutbox(write.idempotency_key, () =>
        sendProductionOutboxWrite(state.session, write),
      );
      const delivered = state.store.readOutboxAuthority(write.idempotency_key)!;
      requireRuntimeLogWrite(
        span.terminal({
          outcome: "success",
          authorityRef: `production-outbox:${delivered.idempotencyKey}`,
          authorityHash: hashCanonical(delivered),
        }),
      );
    } catch (error) {
      state.store.markOutboxFailed(
        write.idempotency_key,
        "OUTBOX_DELIVERY_FAILED",
      );
      const failed = state.store.readOutboxAuthority(write.idempotency_key)!;
      const terminal = requireRuntimeLogWrite(
        span.terminal({
          outcome: "failed",
          authorityRef: `production-outbox:${failed.idempotencyKey}`,
          authorityHash: hashCanonical(failed),
          failure: runtimeFailureFromError({
            error,
            code: "OUTBOX_DELIVERY_FAILED",
            responsibleOwner: "outbox",
            recovery: RuntimeRecovery.RETRY,
            impact: RuntimeFailureImpact.BLOCKING,
          }),
        }),
      );
      throw withRuntimeLogCause(error, terminal.eventId);
    }
  }
};

const workerLoop = async (state: RuntimeState): Promise<void> => {
  let delay = 1_000;
  while (!state.abort.signal.aborted) {
    try {
      await flushOutboxWithLog(state);
      const attestation = await state.session.ensureFreshAttestation();
      state.lastHeartbeat = attestation.issued_at;
      emitRuntimeState({
        state,
        stateKey: "cloud.session",
        current: "connected",
      });
      const available = Math.min(
        10 - state.active.size,
        state.executor.availableCapacity(),
      );
      const claimEligible =
        available > 0 &&
        attestation.claim_eligible &&
        state.ledgerReconciled &&
        !state.draining &&
        state.runtimeLogger.isWritable();
      emitRuntimeState({
        state,
        stateKey: "claim.admission",
        current: state.draining
          ? "draining"
          : claimEligible
            ? "eligible"
            : "blocked",
      });
      if (claimEligible) {
        const claimBoundaryId = `aipclaim_${randomUUID()}`;
        const claimSpan = requireRuntimeLogWrite(
          state.runtimeLogger.startSpan({
            traceId: `producer:${state.runtimeLogger.producerRunId}`,
            boundaryId: claimBoundaryId,
            owner: "production-runtime",
            component: "production-claim",
            operation: "cloud.claim",
            typedIdentity: { kind: "request", requestId: claimBoundaryId },
          }),
        );
        let batch;
        try {
          batch = await claimProductionTasks(
            state.session,
            available,
            claimBoundaryId,
          );
          if (batch.outcome === "CLAIM_BLOCKED") {
            requireRuntimeLogWrite(
              claimSpan.terminal({
                outcome: "failed",
                failure: runtimeFailureFromError({
                  error: new Error(
                    `CLAIM_BLOCKED:${batch.reason_codes.join(",") || "unspecified"}`,
                  ),
                  code: "CLAIM_BLOCKED",
                  responsibleOwner: "production-runtime",
                  recovery: RuntimeRecovery.BACKOFF,
                  impact: RuntimeFailureImpact.BLOCKING,
                }),
              }),
            );
            emitRuntimeState({
              state,
              stateKey: "claim.admission",
              current: "blocked",
            });
          } else {
            requireRuntimeLogWrite(
              claimSpan.terminal({
                outcome: "success",
              }),
            );
          }
        } catch (error) {
          const terminal = terminalSpanFailure(
            claimSpan,
            error,
            classifyFailure(error),
            runtimeLogCauseEventId(error),
            "CLAIM_REQUEST_FAILED",
          );
          throw withRuntimeLogCause(error, terminal.eventId);
        }
        delay =
          batch.outcome === "LEASE_GRANTED" ? 1_000 : batch.next_claim_after_ms;
        for (const job of [...batch.jobs].sort((left, right) =>
          left.job_id.localeCompare(right.job_id),
        )) {
          if (state.active.has(job.job_id)) continue;
          const abort = new AbortController();
          state.activeAbort.set(job.job_id, abort);
          const tracked = executeClaim(state, job)
            .catch((error) => {
              state.lastErrorCode = failureCode(
                error,
                "PLUGIN_EXECUTION_FAILED",
              );
              state.lastErrorReason = safeReason(error);
            })
            .finally(() => {
              state.active.delete(job.job_id);
              state.activeAbort.delete(job.job_id);
              refreshLedgerReconciled(state);
            });
          state.active.set(job.job_id, tracked);
          refreshLedgerReconciled(state);
        }
      }
      state.lastErrorCode = null;
      state.lastErrorReason = null;
    } catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_RUNTIME_FAILED");
      state.lastErrorReason = safeReason(error);
      emitRuntimeState({
        state,
        stateKey: "cloud.session",
        current: "stale",
      });
      emitRuntimeState({
        state,
        stateKey: "claim.admission",
        current: "blocked",
      });
      delay = Math.min(30_000, Math.max(1_000, delay * 2));
    }
    await wait(delay, state.abort.signal);
  }
};

const sessionHeartbeatLoop = async (state: RuntimeState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await wait(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    emitRuntimeState({
      state,
      stateKey: "producer.alive",
      current: "alive",
      freshForMs: 65_000,
      force: true,
      owner: "app-shell",
    });
    try {
      const receipt = await state.session.heartbeat();
      state.lastHeartbeat = receipt.issued_at;
      emitRuntimeState({
        state,
        stateKey: "cloud.session",
        current: "connected",
      });
    } catch (error) {
      state.lastErrorCode = failureCode(error, "SESSION_HEARTBEAT_FAILED");
      state.lastErrorReason = safeReason(error);
      emitRuntimeState({
        state,
        stateKey: "cloud.session",
        current: "stale",
      });
      if (!state.draining)
        emitRuntimeState({
          state,
          stateKey: "claim.admission",
          current: "blocked",
        });
    }
  }
};

const blockedRuntimeHandle = (
  input: Readonly<{
    dataDir: string;
    browserAuthority: WorkbenchBrowserAuthority;
    runtimeLogger: RuntimeLogger;
  }>,
  store: ProductionRuntimeStore,
  error: unknown,
): ProductionRuntimeHandle => {
  const reason = safeReason(error);
  let stopped = false;
  const runtimeTraceId = `producer:${input.runtimeLogger.producerRunId}`;
  requireRuntimeLogWrite(
    input.runtimeLogger.emitState({
      traceId: `producer:${input.runtimeLogger.producerRunId}`,
      owner: "production-runtime",
      component: "production-runtime",
      stateKey: "cloud.contract",
      previous: null,
      current: "blocked",
    }),
  );
  requireRuntimeLogWrite(
    input.runtimeLogger.emitState({
      traceId: `producer:${input.runtimeLogger.producerRunId}`,
      owner: "production-runtime",
      component: "production-runtime",
      stateKey: "claim.admission",
      previous: null,
      current: "blocked",
    }),
  );
  return {
    readHealth: () => {
      const browser = input.browserAuthority.readProductionRuntimeState();
      return {
        shellState: "ready",
        cloudState: stopped ? "stopped" : "contract_blocked",
        browserState:
          browser.browserAuthorityState === "present" ? "ready" : "blocked",
        executionState: "blocked",
        claimAdmissionState: "blocked",
        logSinkState: input.runtimeLogger.getSinkState(),
        browserAuthorityState: browser.browserAuthorityState,
        browserTargetState: browser.browserTargetState,
        browserLaneState:
          browser.browserAuthorityState === "present" ? "idle" : "blocked",
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
    diagnose: (jobId) => diagnoseProductionRuntime(input.dataDir, store, jobId),
    async close() {
      if (stopped) return;
      const shutdownSpan = requireRuntimeLogWrite(
        input.runtimeLogger.startSpan({
          traceId: runtimeTraceId,
          owner: "production-runtime",
          component: "production-runtime",
          operation: "runtime.shutdown",
          typedIdentity: {
            kind: "producer",
            producerId: input.runtimeLogger.producerRunId,
          },
        }),
      );
      try {
        store.close();
        stopped = true;
        requireRuntimeLogWrite(shutdownSpan.terminal({ outcome: "success" }));
      } catch (closeError) {
        const terminal = requireRuntimeLogWrite(
          shutdownSpan.terminal({
            outcome: "failed",
            failure: runtimeFailureFromError({
              error: closeError,
              code: "RUNTIME_SHUTDOWN_FAILED",
              responsibleOwner: "production-runtime",
              recovery: RuntimeRecovery.REVIEW,
              impact: RuntimeFailureImpact.BLOCKING,
            }),
          }),
        );
        throw withRuntimeLogCause(closeError, terminal.eventId);
      }
    },
  };
};

export async function startProductionRuntime(
  input: Readonly<{
    dataDir: string;
    sourceHash: ProductionHash;
    gpt: GptAbilityGroup;
    evidenceStore: import("../../../capabilities/forensics-persistence/index.js").ForensicsPersistenceAbilityGroup;
    browserAuthority: WorkbenchBrowserAuthority;
    runtimeLogger: RuntimeLogger;
  }>,
): Promise<ProductionRuntimeHandle> {
  const runtimeTraceId = `producer:${input.runtimeLogger.producerRunId}`;
  const runtimeStartSpan = requireRuntimeLogWrite(
    input.runtimeLogger.startSpan({
      traceId: runtimeTraceId,
      owner: "production-runtime",
      component: "production-runtime",
      operation: "runtime.start",
      typedIdentity: {
        kind: "producer",
        producerId: input.runtimeLogger.producerRunId,
      },
    }),
  );
  let store: ProductionRuntimeStore;
  try {
    await mkdir(input.dataDir, { recursive: true });
    await cleanupGeneratedImageTemporaryFiles(input.dataDir);
    store = new ProductionRuntimeStore(input.dataDir);
  } catch (error) {
    terminalSpanFailure(
      runtimeStartSpan,
      error,
      classifyFailure(error),
      runtimeLogCauseEventId(error),
      "RUNTIME_START_FAILED",
    );
    throw error;
  }
  let credential;
  try {
    credential = await readProductionCredential(input.dataDir);
  } catch (error) {
    terminalSpanFailure(
      runtimeStartSpan,
      error,
      classifyFailure(error),
      runtimeLogCauseEventId(error),
      "RUNTIME_START_FAILED",
    );
    return blockedRuntimeHandle(input, store, error);
  }
  let stateRef: RuntimeState | null = null;
  const session = new ProductionWorkerSession(
    credential,
    () => runtimeState(stateRef!),
    input.sourceHash,
  );
  const executor = new ProductionExecutor(
    input.dataDir,
    input.sourceHash,
    input.gpt,
    input.evidenceStore,
    input.browserAuthority,
    store,
    input.runtimeLogger,
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
    runtimeLogger: input.runtimeLogger,
    loggedStates: new Map(),
    draining: false,
    lastHeartbeat: null,
    lastErrorCode: null,
    lastErrorReason: null,
    stopped: false,
    ledgerReconciled: false,
    reconciliationBaselineValid: false,
  };
  stateRef = state;
  store.setOutboxObserver((authority) => {
    emitOutboxAuthority(state, authority);
    refreshLedgerReconciled(state);
  });
  let reconciliationComplete = true;
  try {
    store.reconcileDeliveredTerminals();
  } catch (error) {
    reconciliationComplete = false;
    state.lastErrorCode = failureCode(
      error,
      "PRODUCTION_TERMINAL_RECONCILIATION_FAILED",
    );
    state.lastErrorReason = safeReason(error);
  }
  for (const persistedRecord of store.taskAuthorities()) {
    let record = persistedRecord;
    const nonterminal =
      record.status === "accepted" ||
      record.status === "running" ||
      record.status === "recovery_pending";
    const storedLease = store.readLease(record.task.job_id);
    const reconciledLease =
      storedLease?.state === "active"
        ? store.recordLease({ ...storedLease, state: "stale", expiresAt: null })
        : storedLease;
    const storedCheckpoint = store.readCheckpoint(record.task.job_id);
    if (
      nonterminal &&
      record.status !== "recovery_pending" &&
      reconciledLease?.state === "stale" &&
      storedCheckpoint
    ) {
      store.setRecoveryPending(record.task.job_id, "AGENT_PROCESS_RESTARTED");
      record = store.readTask(record.task.job_id)!;
    }
    emitRuntimeState({
      state,
      traceId: record.task.job_id,
      stateKey: "job.lifecycle",
      current: record.status,
      authorityRef: `production-task:${record.task.job_id}`,
      authorityHash: hashCanonical(record),
      reconciledFromAuthority: true,
    });
    if (reconciledLease) {
      if (
        nonterminal &&
        (record.status !== "recovery_pending" ||
          reconciledLease.state !== "stale")
      ) {
        reconciliationComplete = false;
      }
      emitLeaseAuthority(state, reconciledLease, true);
    } else if (nonterminal) {
      reconciliationComplete = false;
      emitRuntimeState({
        state,
        traceId: record.task.job_id,
        stateKey: "job.lease",
        current: "lost",
      });
    }
    if (storedCheckpoint)
      emitCheckpointAuthority(state, storedCheckpoint, true);
    else if (nonterminal) {
      reconciliationComplete = false;
      emitRuntimeState({
        state,
        traceId: record.task.job_id,
        stateKey: "job.checkpoint",
        current: "failed",
      });
    }
  }
  for (const authority of store.outboxAuthorities())
    emitOutboxAuthority(state, authority, true);
  for (const record of store.taskAuthorities()) {
    if (record.status !== "completed" || !record.result) continue;
    for (const recordRef of record.result.evidence_refs) {
      const readback = await input.evidenceStore.readRecordRef({
        childCapabilityId: "read-record-ref",
        recordRef,
      });
      if (readback.status !== "success" || !readback.record)
        reconciliationComplete = false;
    }
  }
  state.reconciliationBaselineValid = reconciliationComplete;
  refreshLedgerReconciled(state);
  const sessionBoundaryId = `aipsopen_${randomUUID()}`;
  const sessionSpan = requireRuntimeLogWrite(
    input.runtimeLogger.startSpan({
      traceId: runtimeTraceId,
      parentSpanId: runtimeStartSpan.spanId,
      boundaryId: sessionBoundaryId,
      owner: "production-runtime",
      component: "production-session",
      operation: "cloud.session-open",
      typedIdentity: {
        kind: "producer",
        producerId: input.runtimeLogger.producerRunId,
      },
    }),
  );
  try {
    await session.open(sessionBoundaryId);
    emitRuntimeState({
      state,
      stateKey: "cloud.contract",
      current: "ready",
    });
    emitRuntimeState({
      state,
      stateKey: "cloud.session",
      current: "connected",
    });
    for (const jobId of store.unreconciledOutboxJobIds()) {
      try {
        const remote = await readProductionDeviceJobStatus(session, jobId);
        store.hydrateRemoteOutboxReceipts(jobId, remote.write_receipts);
      } catch (error) {
        if (
          failureCode(error) === "AI_V6_DEVICE_JOB_NOT_FOUND" &&
          store.markRemoteAbsentHistorical(jobId)
        )
          continue;
        throw error;
      }
    }
    store.reconcileDeliveredTerminals();
    refreshLedgerReconciled(state);
    await flushOutboxWithLog(state);
    const receipt = await session.heartbeat();
    state.lastHeartbeat = receipt.issued_at;
    emitRuntimeState({
      state,
      stateKey: "producer.alive",
      current: "alive",
      freshForMs: 65_000,
      force: true,
      owner: "app-shell",
    });
    requireRuntimeLogWrite(sessionSpan.terminal({ outcome: "success" }));
    requireRuntimeLogWrite(runtimeStartSpan.terminal({ outcome: "success" }));
  } catch (error) {
    const sessionFailure = terminalSpanFailure(
      sessionSpan,
      error,
      classifyFailure(error),
      runtimeLogCauseEventId(error),
      "CLOUD_SESSION_OPEN_FAILED",
    );
    terminalSpanFailure(
      runtimeStartSpan,
      error,
      classifyFailure(error),
      sessionFailure.eventId,
      "RUNTIME_START_FAILED",
    );
    state.lastErrorCode = failureCode(error, "PRODUCTION_SESSION_START_FAILED");
    state.lastErrorReason = safeReason(error);
    emitRuntimeState({
      state,
      stateKey: "cloud.session",
      current: "stale",
    });
    emitRuntimeState({
      state,
      stateKey: "claim.admission",
      current: "blocked",
    });
  }
  const loop = workerLoop(state);
  const heartbeat = sessionHeartbeatLoop(state);
  return {
    readHealth: () => readHealth(state),
    readTask: (jobId) => store.readTask(jobId),
    diagnose: (jobId) => diagnoseProductionRuntime(input.dataDir, store, jobId),
    async close() {
      const shutdownSpan = requireRuntimeLogWrite(
        state.runtimeLogger.startSpan({
          traceId: runtimeTraceId,
          owner: "production-runtime",
          component: "production-runtime",
          operation: "runtime.shutdown",
          typedIdentity: {
            kind: "producer",
            producerId: input.runtimeLogger.producerRunId,
          },
        }),
      );
      state.draining = true;
      emitRuntimeState({
        state,
        stateKey: "claim.admission",
        current: "draining",
      });
      const cleanupErrors: unknown[] = [];
      await session.heartbeat().catch((error) => {
        cleanupErrors.push(error);
      });
      state.abort.abort();
      for (const controller of state.activeAbort.values())
        controller.abort("PRODUCTION_RUNTIME_STOPPED");
      await Promise.all([loop, heartbeat]).catch((error) => {
        cleanupErrors.push(error);
      });
      await Promise.allSettled([...state.active.values()]);
      await flushOutboxWithLog(state).catch((error) => {
        cleanupErrors.push(error);
      });
      await session.close().catch((error) => {
        cleanupErrors.push(error);
      });
      state.stopped = true;
      emitRuntimeState({
        state,
        stateKey: "cloud.session",
        current: "disconnected",
      });
      try {
        store.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
      const cleanupError = cleanupErrors[0];
      if (cleanupError !== undefined) {
        const terminal = requireRuntimeLogWrite(
          shutdownSpan.terminal({
            outcome: "failed",
            failure: runtimeFailureFromError({
              error: cleanupError,
              code: "RUNTIME_SHUTDOWN_FAILED",
              responsibleOwner: "production-runtime",
              recovery: RuntimeRecovery.REVIEW,
              impact: RuntimeFailureImpact.BLOCKING,
            }),
          }),
        );
        throw withRuntimeLogCause(cleanupError, terminal.eventId);
      }
      requireRuntimeLogWrite(shutdownSpan.terminal({ outcome: "success" }));
    },
  };
}
