import { randomUUID } from "node:crypto";

import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
} from "../../runtime-logs/index.js";
import { failureCode } from "../../execution-failure.js";
import { claimProductionTasks } from "./cloud-client.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { PRODUCTION_BUSINESS_CAPACITY_MAX } from "./control-contract-dependency.js";
import { hashCanonical } from "./contracts.js";
import type { ProductionRuntimeHealth } from "./runtime-contract.js";
import { executeClaim, reconcilePendingAttemptFailures } from "./runtime-claim.js";
import { classifyAttemptFailure } from "./terminal-failure.js";
import { purgeDeletedJob, reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { terminalSpanFailure } from "./runtime-logging.js";
import {
  refreshLedgerReconciled,
  safeReason,
  wait,
  type RuntimeState,
} from "./runtime-state.js";

const pendingAttemptFailureJobs = (state: RuntimeState) => state.store.pendingAttemptFailures()
  .filter((row) => row.current_reason !== "WAIT_NEW_ATTEMPT" && row.current_attempt_id !== null);

const pendingProviderReadbackJobIds = (state: RuntimeState): ReadonlySet<string> => new Set(
  pendingAttemptFailureJobs(state)
    .filter((row) => classifyAttemptFailure(row.attempt_failure!.failure_core)
      === "same_attempt_provider_readback")
    .map((row) => row.task.job_id),
);

const providerCooldownPaused = (reason: string | null): boolean =>
  reason === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE"
  || reason?.startsWith("PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE|") === true;

const pendingCooldownResumeJobIds = (state: RuntimeState): ReadonlySet<string> => new Set(
  state.store.taskAuthorities()
    .filter((row) => row.status === "failed" && row.current_attempt_id !== null
      && row.attempt_failure === null && providerCooldownPaused(row.current_reason))
    .map((row) => row.task.job_id),
);

export const claimReusesExistingBusinessSlot = (
  state: RuntimeState,
  job: Readonly<{ job_id: string; grant: Readonly<{ attempt_id: string }> }>,
): boolean => {
  const durable = state.store.readTask(job.job_id);
  if (durable?.current_attempt_id !== job.grant.attempt_id) return false;
  if (durable.attempt_failure
    && classifyAttemptFailure(durable.attempt_failure.failure_core)
      === "same_attempt_provider_readback") return true;
  return durable?.status === "failed"
    && providerCooldownPaused(durable.current_reason)
    && durable.attempt_failure === null;
};

const businessInFlightJobIds = (state: RuntimeState): ReadonlySet<string> => new Set([
  ...state.active.keys(),
  ...state.store.taskAuthorities()
    .filter((row) => row.status === "failed" && row.current_attempt_id !== null
      && row.current_reason !== "WAIT_NEW_ATTEMPT")
    .map((row) => row.task.job_id),
]);

export const businessInFlightCount = (state: RuntimeState): number =>
  businessInFlightJobIds(state).size;

export const runtimeState = async (state: RuntimeState) => {
  refreshLedgerReconciled(state);
  const browser = state.browserAuthority.readProductionRuntimeState();
  const observedLane = state.browserAuthority.readBrowserLaneState();
  const lane: "blocked" | "busy" | "idle" = browser.browserAuthorityState !== "present"
    ? "blocked" : observedLane;
  return {
    agent_attested_in_flight: businessInFlightCount(state),
    browser_action_in_flight: observedLane === "busy" ? 1 as const : 0 as const,
    browser_authority_state: browser.browserAuthorityState,
    browser_target_state: browser.browserTargetState,
    browser_lane_state: lane,
    drain_state: state.draining ? "draining" as const : "open" as const,
    ledger_reconciled: state.ledgerReconciled,
  };
};

export const readHealth = (state: RuntimeState): ProductionRuntimeHealth => {
  refreshLedgerReconciled(state);
  const browser = state.browserAuthority.readProductionRuntimeState();
  const browserLane = state.browserAuthority.readBrowserLaneState();
  const cloudState = state.stopped ? "stopped" : state.lastErrorCode
    ? /(?:CONTRACT|CREDENTIAL|MANIFEST|ORIGIN|REENROLL)/iu.test(state.lastErrorCode)
      ? "contract_blocked" : "transient_degraded"
    : "ready";
  const ready = cloudState === "ready" && state.ledgerReconciled;
  const claimEligible = ready && browser.browserAuthorityState === "present" && state.runtimeLogger.isWritable();
  return {
    shellState: "ready", cloudState,
    browserState: browser.browserAuthorityState === "present" ? "ready" : "blocked",
    executionState: ready ? state.draining ? "draining" : "ready" : "blocked",
    claimAdmissionState: claimEligible ? state.draining ? "draining" : "eligible" : "blocked",
    logSinkState: state.runtimeLogger.getSinkState(), browserAuthorityState: browser.browserAuthorityState,
    browserTargetState: browser.browserTargetState,
    browserLaneState: browser.browserAuthorityState !== "present"
      ? "blocked" : browserLane,
    controlContractVersion: state.session.controlContractVersion,
    catalogHash: productionCatalogHash, activeCount: state.active.size,
    pendingOutboxCount: state.store.pendingOutboxCount(),
    lastSuccessfulHeartbeatAt: state.lastHeartbeat,
    lastErrorCode: state.lastErrorCode, lastErrorReason: state.lastErrorReason, checkedAt: new Date().toISOString(),
  };
};

const requestClaimBatch = async (
  state: RuntimeState,
  available: number,
  forceCurrentAttestation: boolean,
) => {
  const boundaryId = `aipclaim_${randomUUID()}`;
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: `producer:${state.runtimeLogger.producerRunId}`, boundaryId, owner: "production-runtime",
    component: "production-claim", operation: "cloud.claim",
    typedIdentity: { kind: "request", requestId: boundaryId },
  }));
  try {
    const batch = await claimProductionTasks(
      state.session, available, boundaryId, forceCurrentAttestation,
    );
    state.providerRateLimitControl.observeWebsiteAuthority({
      serverNow: batch.server_now,
      reasonCodes: batch.reason_codes,
    });
    const claimDiagnostics = {
      outcome: batch.outcome,
      claimed_count: batch.jobs.length,
      reason_codes: batch.reason_codes,
    } as const;
    if (batch.outcome === "CLAIM_BLOCKED") {
      requireRuntimeLogWrite(span.terminal({
        claimDiagnostics,
        outcome: "failed", failure: runtimeFailureFromError({
          error: new Error(`CLAIM_BLOCKED:${batch.reason_codes.join(",") || "unspecified"}`),
          code: "CLAIM_BLOCKED", responsibleOwner: "website",
          impact: RuntimeFailureImpact.BLOCKING,
        }),
      }));
    } else requireRuntimeLogWrite(span.terminal({ outcome: "succeeded", claimDiagnostics }));
    return batch;
  } catch (error) {
    const terminal = terminalSpanFailure(
      span, error, runtimeLogCauseEventId(error), "CLAIM_REQUEST_FAILED", undefined, "website",
    );
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

const launchClaimJobs = (
  state: RuntimeState,
  jobs: Awaited<ReturnType<typeof claimProductionTasks>>["jobs"],
): void => {
  const uniqueJobIds = new Set(jobs.map((job) => job.job_id));
  const executionOrAdmissionJobIds = new Set([
    ...state.active.keys(),
    ...state.store.pendingBusinessAdmissions().map((row) => row.task.job_id),
  ]);
  const resultingBusinessJobIds = new Set([...businessInFlightJobIds(state), ...uniqueJobIds]);
  if (jobs.length > PRODUCTION_BUSINESS_CAPACITY_MAX || uniqueJobIds.size !== jobs.length
    || jobs.some((job) => executionOrAdmissionJobIds.has(job.job_id))
    || jobs.some((job) => businessInFlightJobIds(state).has(job.job_id)
      && !claimReusesExistingBusinessSlot(state, job))
    || resultingBusinessJobIds.size > PRODUCTION_BUSINESS_CAPACITY_MAX) {
    throw new Error("V6_CLAIM_BATCH_INVALID");
  }
  for (const job of jobs) {
    const abort = new AbortController();
    state.activeAbort.set(job.job_id, abort);
    const tracked = executeClaim(state, job).catch((error) => {
      state.lastErrorCode = failureCode(error, "PLUGIN_EXECUTION_FAILED");
      state.lastErrorReason = safeReason(error);
    }).finally(() => {
      state.active.delete(job.job_id);
      state.activeAbort.delete(job.job_id);
      refreshLedgerReconciled(state);
    });
    state.active.set(job.job_id, tracked);
    refreshLedgerReconciled(state);
  }
};

const reconcilePendingBusinessAdmissions = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.pendingBusinessAdmissions()) {
    const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
      traceId: task.task.job_id, owner: "production-runtime", component: "production-admission-readback",
      operation: "website.v6-request",
      typedIdentity: { kind: "job", jobId: task.task.job_id },
    }));
    try {
      const outcome = await reconcileBusinessAdmission(state, task);
      if (outcome === "deleted") {
        requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
        continue;
      }
      const current = state.store.readTask(task.task.job_id)!;
      requireRuntimeLogWrite(span.terminal(outcome === "completed" ? {
        outcome: "succeeded", authorityRef: `production-task:${task.task.job_id}`,
        authorityHash: hashCanonical(current),
      } : { outcome: "succeeded" }));
    } catch (error) {
      terminalSpanFailure(span, error, runtimeLogCauseEventId(error),
        "BUSINESS_ADMISSION_RECONCILIATION_FAILED");
    }
  }
};

const reconcileUnfinishedExecutionsWithoutReceipt = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.unfinishedExecutionsWithoutReceipt()) {
    if (state.active.has(task.task.job_id)) continue;
    try {
      const remote = await readProductionDeviceJobStatus(state.session, task.task.job_id);
      if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
        && task.current_reason !== "WAIT_NEW_ATTEMPT") {
        const permanentRevocation = remote.current_reason?.code === "PRIVACY_SUBJECT_CLOSED";
        await state.browserAuthority.releaseJobBoundTarget(
          task.task.job_id,
          permanentRevocation ? "website-permanent-revocation" : "wait-new-attempt",
          state.abort.signal,
        );
        state.store.releaseAttemptForWebsiteDecision(
          task.task.job_id, task.current_attempt_id,
        );
      }
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
      await purgeDeletedJob(state, task.task.job_id);
    }
  }
};

const workerIteration = async (state: RuntimeState): Promise<number> => {
  await state.executor.reconcilePendingProviderRateLimitIncidents(state.abort.signal);
  await state.providerRateLimitControl.reconcilePendingIntents();
  await reconcilePendingAttemptFailures(state);
  await reconcilePendingBusinessAdmissions(state);
  await reconcileUnfinishedExecutionsWithoutReceipt(state);
  refreshLedgerReconciled(state);
  const attestation = await state.session.ensureFreshAttestation();
  state.providerRateLimitControl.observeWebsiteAuthority({
    serverNow: attestation.issued_at,
    reasonCodes: attestation.reason_codes,
  });
  state.lastHeartbeat = attestation.issued_at;
  const availableNewSlots = Math.min(
    PRODUCTION_BUSINESS_CAPACITY_MAX - businessInFlightCount(state),
    state.executor.availableCapacity(),
  );
  const hasPendingProviderReadback = pendingProviderReadbackJobIds(state).size > 0;
  const hasPendingCooldownResume = pendingCooldownResumeJobIds(state).size > 0;
  const hasExistingAttemptRecovery = hasPendingProviderReadback || hasPendingCooldownResume;
  const browser = state.browserAuthority.readProductionRuntimeState();
  const eligible = (availableNewSlots > 0 || hasExistingAttemptRecovery)
    && state.executor.availableCapacity() > 0
    && attestation.claim_eligible && state.ledgerReconciled
    && browser.browserAuthorityState === "present" && !state.draining && state.runtimeLogger.isWritable()
    && state.providerRateLimitControl.canRequestClaimAuthority();
  if (!eligible) return 1_000;
  const recoveryOnlyClaim = availableNewSlots <= 0 && hasExistingAttemptRecovery;
  const batch = await requestClaimBatch(
    state, Math.max(1, availableNewSlots), recoveryOnlyClaim,
  );
  launchClaimJobs(state, batch.jobs);
  return batch.outcome === "LEASE_GRANTED" ? 1_000 : batch.next_claim_after_ms;
};

export const workerLoop = async (state: RuntimeState): Promise<void> => {
  let delay = 1_000;
  while (!state.abort.signal.aborted) {
    try {
      delay = await workerIteration(state);
      if (state.lastErrorCode !== "BROWSER_HOST_UNAVAILABLE") {
        state.lastErrorCode = null;
        state.lastErrorReason = null;
      }
    } catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_RUNTIME_FAILED");
      state.lastErrorReason = safeReason(error);
      delay = Math.min(30_000, Math.max(1_000, delay * 2));
    }
    await wait(delay, state.abort.signal);
  }
};

export const sessionHeartbeatLoop = async (state: RuntimeState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await wait(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    try {
      const receipt = await state.session.heartbeat();
      state.providerRateLimitControl.observeWebsiteAuthority({
        serverNow: receipt.issued_at,
        reasonCodes: receipt.reason_codes,
      });
      state.lastHeartbeat = receipt.issued_at;
    } catch (error) {
      state.lastErrorCode = failureCode(error, "SESSION_HEARTBEAT_FAILED");
      state.lastErrorReason = safeReason(error);
    }
  }
};
