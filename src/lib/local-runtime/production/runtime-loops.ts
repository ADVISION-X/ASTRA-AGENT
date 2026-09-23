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
import { hashCanonical, sha256 } from "./contracts.js";
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
  .filter((row) => row.current_attempt_id !== null);

const pendingProviderReadbackJobIds = (state: RuntimeState): ReadonlySet<string> => new Set(
  pendingAttemptFailureJobs(state)
    .filter((row) => row.attempt_failure !== null
      && !row.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")
      && (classifyAttemptFailure(row.attempt_failure.failure_core)
        === "same_attempt_provider_readback"
        || state.browserAuthority.readJobPhysicalInputState(row.task.job_id) !== "zero"))
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
  job: Readonly<{ job_id: string; grant: Readonly<{
    attempt_id: string; same_accepted_attempt: boolean;
    source_handoff_seal_hash: `sha256:${string}` | null;
  }> }>,
): boolean => {
  const durable = state.store.readTask(job.job_id);
  if (durable?.current_attempt_id !== job.grant.attempt_id
    && durable?.current_reason === `SOURCE_HANDOFF_SEALED|${job.grant.source_handoff_seal_hash}`
    && job.grant.source_handoff_seal_hash !== null) return true;
  if (durable?.current_attempt_id !== job.grant.attempt_id) return false;
  return durable.status === "failed" && job.grant.same_accepted_attempt;
};

const businessInFlightJobIds = (state: RuntimeState): ReadonlySet<string> => new Set([
  ...state.active.keys(),
  ...state.store.taskAuthorities()
    .filter((row) => row.status === "failed" && row.current_attempt_id !== null)
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
  sourceEvidence: Parameters<typeof claimProductionTasks>[4],
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
      sourceEvidence,
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

const prepareSourceHandoffs = async (
  state: RuntimeState,
): Promise<NonNullable<Parameters<typeof claimProductionTasks>[4]>> => {
  const evidence: NonNullable<Parameters<typeof claimProductionTasks>[4]>[number][] = [];
  for (const task of state.store.taskAuthorities()) {
    const jobId = task.task.job_id;
    if (task.status !== "failed" || !task.current_attempt_id || task.staged_result
      || state.active.has(jobId)) continue;
    const priorSeal = state.store.readSealedSourceHandoff(jobId, task.current_attempt_id);
    if (priorSeal) {
      evidence.push(priorSeal);
      continue;
    }
    const outbox = state.store.readResultOutboxHistoryEvidence(jobId, task.current_attempt_id);
    if (outbox.candidateCount !== 0) continue;
    const browserInput = state.browserAuthority.readJobPhysicalInputState(jobId);
    if (browserInput !== "zero") continue;
    const jobRefHash = sha256(Buffer.from(jobId, "utf8"));
    if (state.browserAuthority.readUnreleasedTargetClaims()
      .some((claim) => claim.jobRefHash === jobRefHash)) {
      try {
        await state.browserAuthority.releaseJobBoundTarget(
          jobId, "wait-new-attempt", state.abort.signal,
        );
      } catch (error) {
        state.lastErrorCode = failureCode(error, "SOURCE_TARGET_RELEASE_PENDING");
        state.lastErrorReason = safeReason(error);
        continue;
      }
    }
    if (state.browserAuthority.readUnreleasedTargetClaims()
      .some((claim) => claim.jobRefHash === jobRefHash)) continue;
    const browser = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
    if (!browser.walHistoryVerified || !browser.targetSettled) continue;
    const firstRaw = state.store.readAttemptFailureRaw(jobId);
    const body = Object.freeze({
      kind: "attempt_handoff" as const,
      job_id: jobId,
      source_attempt_id: task.current_attempt_id,
      source_task_hash: hashCanonical(task.task),
      first_fact_raw_hash: firstRaw === null ? null : sha256(Buffer.from(firstRaw, "utf8")),
      outbox_history_hash: outbox.historyHash,
      outbox_candidate_count: outbox.candidateCount,
      browser_history_hash: browser.historyHash,
      browser_row_count: browser.rowCount,
      browser_input_state: browserInput,
      replay_calls: [],
      browser_target_settled: true,
      target_settlement_hash: browser.targetSettlementHash,
      readback_exhaustion_hash: null,
    });
    const sealed = Object.freeze({ ...body, seal_hash: hashCanonical(body) });
    state.store.sealSourceHandoff(sealed);
    evidence.push(sealed);
  }
  return evidence;
};

const launchClaimJobs = (
  state: RuntimeState,
  jobs: Awaited<ReturnType<typeof claimProductionTasks>>["jobs"],
): void => {
  const uniqueJobIds = new Set(jobs.map((job) => job.job_id));
  const executingJobIds = new Set(state.active.keys());
  const resultingBusinessJobIds = new Set([...businessInFlightJobIds(state), ...uniqueJobIds]);
  if (jobs.length > PRODUCTION_BUSINESS_CAPACITY_MAX || uniqueJobIds.size !== jobs.length
    || jobs.some((job) => executingJobIds.has(job.job_id))
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

const reconcileCompletedBrowserTargets = async (state: RuntimeState): Promise<void> => {
  if (state.browserAuthority.readProductionRuntimeState().browserAuthorityState !== "present") return;
  const boundJobRefHash = state.browserAuthority.readBoundJobRefHash();
  const unclosed = state.browserAuthority.readUnreleasedTargetClaims();
  const completedWithOldClaim = state.store.taskAuthorities()
    .filter((task) => task.status === "completed"
      && unclosed.some((claim) => claim.jobRefHash === sha256(Buffer.from(task.task.job_id, "utf8"))))
    .map((task) => task.task.job_id);
  const pending = [...new Set([
    ...state.store.pendingBrowserCleanupJobIds(), ...completedWithOldClaim,
  ])];
  if (pending.length === 0) return;
  const jobId = boundJobRefHash
    ? pending.find((candidate) => sha256(Buffer.from(candidate, "utf8")) === boundJobRefHash)
    : pending[0];
  if (!jobId) return;
  try {
    await state.browserAuthority.releaseJobBoundTarget(
      jobId, "business-admitted", state.abort.signal,
    );
    const releasedJobRefHash = sha256(Buffer.from(jobId, "utf8"));
    if (state.browserAuthority.readUnreleasedTargetClaims()
      .some((claim) => claim.jobRefHash === releasedJobRefHash)
      || (boundJobRefHash === releasedJobRefHash
        && state.browserAuthority.readBoundJobRefHash() === boundJobRefHash)) {
      throw new Error("BROWSER_ADMITTED_TARGET_RELEASE_READBACK_MISSING");
    }
    state.store.settleBrowserCleanup(jobId);
  } catch (error) {
    state.lastErrorCode = failureCode(error, "BROWSER_ADMITTED_TARGET_CLEANUP_PENDING");
    state.lastErrorReason = safeReason(error);
  }
};

const reconcileUnfinishedExecutionsWithoutReceipt = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.unfinishedExecutionsWithoutReceipt()) {
    if (state.active.has(task.task.job_id)) continue;
    try {
      const remote = await readProductionDeviceJobStatus(state.session, task.task.job_id);
      if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
        && task.current_reason !== "SOURCE_HANDOFF_RECONCILIATION_PENDING"
        && !task.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")) {
        state.store.setCurrentReason(task.task.job_id,
          "SOURCE_HANDOFF_RECONCILIATION_PENDING");
      }
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
      try {
        await purgeDeletedJob(state, task.task.job_id);
      } catch (purgeError) {
        state.store.setCurrentReason(task.task.job_id,
          failureCode(purgeError, "PRODUCTION_JOB_PURGE_FAILED"));
      }
    }
  }
};

const workerIteration = async (state: RuntimeState): Promise<number> => {
  await reconcilePendingBusinessAdmissions(state);
  await reconcileCompletedBrowserTargets(state);
  const hasDeliveryCandidate = state.store.pendingBusinessAdmissions().length > 0
    || state.store.uploadedResultCandidateJobIds().length > 0;
  try {
    await state.executor.reconcilePendingProviderRateLimitIncidents(state.abort.signal);
    await state.providerRateLimitControl.reconcilePendingIntents();
    await reconcilePendingAttemptFailures(state);
  } catch (error) {
    if (!hasDeliveryCandidate) throw error;
    state.lastErrorCode = failureCode(error, "PROVIDER_RECOVERY_PENDING");
    state.lastErrorReason = safeReason(error);
  }
  try {
    await reconcileUnfinishedExecutionsWithoutReceipt(state);
  } catch (error) {
    if (!hasDeliveryCandidate) throw error;
    state.lastErrorCode = failureCode(error, "EXECUTION_RECONCILIATION_PENDING");
    state.lastErrorReason = safeReason(error);
  }
  refreshLedgerReconciled(state);
  const sourceEvidence = await prepareSourceHandoffs(state);
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
  const hasAcceptedAttemptRecovery = state.store.taskAuthorities().some((row) =>
    row.status === "failed" && row.current_attempt_id !== null
      && !state.active.has(row.task.job_id));
  const hasPendingCooldownResume = pendingCooldownResumeJobIds(state).size > 0;
  const hasPendingStagedResult = state.store.pendingBusinessAdmissions().length > 0;
  const hasUploadedResultCandidate = state.store.uploadedResultCandidateJobIds().length > 0;
  const hasExistingAttemptRecovery = hasAcceptedAttemptRecovery
    || hasPendingProviderReadback || hasPendingCooldownResume
    || hasPendingStagedResult || hasUploadedResultCandidate || sourceEvidence.length > 0;
  const browser = state.browserAuthority.readProductionRuntimeState();
  const eligible = (availableNewSlots > 0 || hasExistingAttemptRecovery)
    && (state.executor.availableCapacity() > 0 || hasPendingStagedResult || hasUploadedResultCandidate)
    && attestation.claim_eligible && state.ledgerReconciled
    && (browser.browserAuthorityState === "present" || hasPendingStagedResult || hasUploadedResultCandidate)
    && !state.draining && state.runtimeLogger.isWritable()
    && (state.providerRateLimitControl.canRequestClaimAuthority()
      || hasPendingStagedResult || hasUploadedResultCandidate);
  if (!eligible) return 1_000;
  const recoveryOnlyClaim = availableNewSlots <= 0 && hasExistingAttemptRecovery;
  const batch = await requestClaimBatch(
    state, Math.max(1, availableNewSlots), recoveryOnlyClaim, sourceEvidence,
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
