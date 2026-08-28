import path from "node:path";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import { resolveStoredBrowserMutationAuthority } from "../../browser/exact-target/browser-mutation-store.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { executionFailure, failureStatus } from "../../typed-failure.js";
import {
  diagnoseRuntimeLog,
  RuntimeRecovery,
  type RuntimeDiagnosis,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";
import type { RuntimeStateValue } from "../../runtime-logs/runtime-event-contract.js";
import type { ProductionHash } from "./contracts.js";
import type { ProductionExecutionLease, ProductionExecutor } from "./executor.js";
import type {
  ProductionCheckpointAuthority,
  ProductionLeaseAuthority,
  ProductionRuntimeStore,
} from "./store.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import type { ProductionWorkerSession } from "./worker-session.js";

export type RuntimeState = {
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

export const diagnoseProductionRuntime = (
  dataDir: string,
  store: ProductionRuntimeStore,
  jobId: string,
): RuntimeDiagnosis => diagnoseRuntimeLog({
  sources: [path.join(dataDir, "runtime-logs")],
  traceId: jobId,
  authorityResolver: (authorityRef, authorityHash) => {
    const production = store.resolveAuthority(authorityRef, authorityHash);
    return production !== "missing" ? production
      : resolveStoredBrowserMutationAuthority(dataDir, authorityRef, authorityHash);
  },
});

export const refreshLedgerReconciled = (state: RuntimeState): void => {
  state.ledgerReconciled = state.reconciliationBaselineValid
    && state.browserAuthority.readBrowserLaneState() !== "unsettled"
    && state.store.isLedgerConsistent(new Set(state.active.keys()));
};

export const wait = async (milliseconds: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
};

export const safeReason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").slice(0, 1_000);

export const classifyFailure = failureStatus;

export const recoveryFor = (status: ReturnType<typeof classifyFailure>): RuntimeRecovery => {
  if (status === "recovery_pending") return RuntimeRecovery.RETRY;
  if (status === "review_required") return RuntimeRecovery.REVIEW;
  return RuntimeRecovery.STOP;
};

export const jobIdentity = (job: ClaimedProductionTask) => ({
  kind: "lease" as const,
  jobId: job.job_id,
  attemptId: job.grant.attempt_id,
  leaseVersion: job.grant.lease_version,
  fenceHash: job.grant.execution_fence.fence_hash,
});

export const leaseAuthority = (
  job: ClaimedProductionTask,
  state: ProductionLeaseAuthority["state"],
  expiresAt: string | null,
): ProductionLeaseAuthority => ({
  jobId: job.job_id, attemptId: job.grant.attempt_id, leaseVersion: job.grant.lease_version,
  fenceHash: job.grant.execution_fence.fence_hash, state, expiresAt,
});

export const checkpointAuthority = (
  job: ClaimedProductionTask,
  state: ProductionCheckpointAuthority["state"],
  checkpointId: string | null,
  checkpointHash: ProductionHash | null,
): ProductionCheckpointAuthority => ({
  jobId: job.job_id, attemptId: job.grant.attempt_id, checkpointId, checkpointHash, state,
});

export const leaseBudget = (
  job: ClaimedProductionTask,
  abort: AbortController,
): ProductionExecutionLease => {
  const serverNow = Date.parse(job.grant.server_now);
  const remaining = Math.min(
    Date.parse(job.grant.lease_expires_at), Date.parse(job.grant.delivery_deadline_at),
  ) - serverNow;
  if (!Number.isFinite(remaining) || remaining < 30_000) {
    throw executionFailure("recovery_pending", "V6_DEADLINE_BUDGET_EXHAUSTED");
  }
  return {
    attempt_mode: job.grant.attempt_mode,
    attempt_id: job.grant.attempt_id, device_id: job.grant.device_id,
    lease_version: job.grant.lease_version, execution_fence_hash: job.grant.execution_fence.fence_hash,
    control_manifest_hash: job.grant.control_contract_manifest_hash,
    max_provider_turns: job.grant.max_provider_turns, provider_turns_used: 0,
    expires_at_monotonic: performance.now() + remaining - 10_000,
    command_ttl_ms: Math.min(20_000, remaining - 10_000), abort_signal: abort.signal,
  };
};
