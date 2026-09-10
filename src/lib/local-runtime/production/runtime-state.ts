import path from "node:path";

import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { executionFailure } from "../../execution-failure.js";
import {
  diagnoseRuntimeLog,
  type RuntimeDiagnosis,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";
import type { ProductionExecutionLease } from "./contracts.js";
import type { ProductionExecutor } from "./executor.js";
import type { ProductionLeaseAuthority, ProductionRuntimeStore } from "./store.js";
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
  authorityResolver: (authorityRef, authorityHash) => store.resolveAuthority(authorityRef, authorityHash),
});

export const refreshLedgerReconciled = (state: RuntimeState): void => {
  state.ledgerReconciled = state.reconciliationBaselineValid
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

export const leaseBudget = (
  job: ClaimedProductionTask,
  abort: AbortController,
): ProductionExecutionLease => {
  const serverNow = Date.parse(job.grant.server_now);
  const remaining = Date.parse(job.grant.lease_expires_at) - serverNow;
  if (!Number.isFinite(remaining) || remaining < 30_000) {
    throw executionFailure("failed", "V6_LEASE_BUDGET_EXHAUSTED");
  }
  return {
    attempt_id: job.grant.attempt_id, device_id: job.grant.device_id,
    lease_version: job.grant.lease_version, execution_fence_hash: job.grant.execution_fence.fence_hash,
    capability_manifest_hash: job.grant.capability_manifest_hash,
    max_provider_turns: job.grant.max_provider_turns, provider_turns_used: 0,
    expires_at_monotonic: performance.now() + remaining - 10_000,
    command_ttl_ms: Math.min(20_000, remaining - 10_000), abort_signal: abort.signal,
  };
};
