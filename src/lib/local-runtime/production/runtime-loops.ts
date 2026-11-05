import { randomUUID } from "node:crypto";

import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { failureCode, typedExecutionFailure } from "../../execution-failure.js";
import { typedBrowserExecutionFailure } from "../../browser/browser-authority-api.js";
import { claimProductionTasks } from "./cloud-client.js";
import { readProductionDeviceJobStatus, type RemoteProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { PRODUCTION_BUSINESS_CAPACITY_MAX } from "./control-contract-dependency.js";
import { hashCanonical } from "./contracts.js";
import { prepareSourceHandoffs } from "./runtime-source-handoff.js";
import type { ProductionRuntimeHealth } from "./runtime-contract.js";
import { executeClaim, reconcileAttemptFailure } from "./runtime-claim.js";
import type { StoredProductionTask } from "./store.js";
import { purgeDeletedJob, reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { terminalSpanFailure } from "./runtime-logging.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import {
  refreshLedgerReconciled,
  safeReason,
  wait,
  type RuntimeState,
} from "./runtime-state.js";

export const claimReusesExistingBusinessSlot = (
  state: RuntimeState,
  job: Readonly<{ job_id: string; grant: Readonly<{
    attempt_id: string; same_accepted_attempt: boolean;
    source_handoff_seal_hash: `sha256:${string}` | null;
  }> }>,
): boolean => {
  const durable = state.store.readTask(job.job_id);
  if (durable?.current_attempt_id !== job.grant.attempt_id) return false;
  return durable.status === "failed" && job.grant.same_accepted_attempt;
};

/** A typed-sealed source attempt or an attempt whose result the Website refused releases its slot for the next attempt. */
const businessInFlightJobIds = (state: RuntimeState): ReadonlySet<string> => {
  const occupied = new Set(state.active.keys());
  for (const row of state.store.taskAuthorities()) {
    if (row.status !== "failed" || row.current_attempt_id === null) continue;
    let retained = true;
    try {
      retained = state.store.readSealedSourceHandoff(row.task.job_id, row.current_attempt_id) === null
        && !state.store.attemptClosedByWebsite(row.task.job_id, row.current_attempt_id);
    } catch (error) {
      if (typedExecutionFailure(error)?.code !== "PRODUCTION_SOURCE_HANDOFF_CONFLICT") throw error;
      state.store.setCurrentReason(row.task.job_id, "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    if (retained) occupied.add(row.task.job_id);
  }
  return occupied;
};

export const businessInFlightCount = (state: RuntimeState): number =>
  businessInFlightJobIds(state).size;

export const runtimeState = (state: RuntimeState) => {
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
    executionState: !ready ? "blocked" : state.draining ? "draining"
      : claimEligible && browserLane !== "blocked" ? "ready" : "blocked",
    claimAdmissionState: claimEligible ? state.draining ? "draining" : "eligible" : "blocked",
    logSinkState: state.runtimeLogger.getSinkState(), browserAuthorityState: browser.browserAuthorityState,
    browserTargetState: browser.browserTargetState,
    browserLaneState: browser.browserAuthorityState !== "present" ? "blocked" : browserLane,
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
  deliveryCandidates: Parameters<typeof claimProductionTasks>[5],
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
      sourceEvidence, deliveryCandidates,
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
    if (state.draining && typedExecutionFailure(error)?.code === "PRODUCTION_CLAIM_STOPPED") {
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      throw error;
    }
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
    if (state.draining) state.drainJobIds?.add(job.job_id);
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
export const reconcileCompletedBrowserTargets = async (state: RuntimeState): Promise<void> => {
  for (const jobId of state.store.pendingBrowserCleanupJobIds()) {
    if (state.abort.signal.aborted) break;
    if (state.store.hasUnsentOutbox(jobId)) continue;
    try {
      await state.browserAuthority.releaseJobBoundTarget(jobId, "business-admitted", state.abort.signal);
    } catch (error) {
      const failure = typedBrowserExecutionFailure(error);
      if (state.abort.signal.aborted && failure?.code === "BROWSER_WAIT_ABORTED") break;
      if (!failure || ![
        "V6_DEADLINE_BUDGET_EXHAUSTED", "BROWSER_TARGET_ACQUISITION_TIMEOUT",
        "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", "BROWSER_BACKPRESSURE",
        "BROWSER_TARGET_INVALID", "BROWSER_TARGET_CLEANUP_FAILED",
      ].includes(failure.code)) throw error;
      if (state.abort.signal.aborted) break;
      state.lastErrorCode = failure.code;
      state.lastErrorReason = safeReason(error);
      continue;
    }
    state.store.settleBrowserCleanup(jobId);
  }
};
type AuthorityReadback = Readonly<{ task: StoredProductionTask; remote: RemoteProductionDeviceJobStatus }>;
const compareJobIds = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

const isSharedTransportAuthorizationFailure = (error: unknown): boolean => {
  const transport = typedRuntimeTransportFailure(error);
  return Boolean(transport && [401, 403].includes(transport.httpStatus));
};

const recordJobReadbackFailure = (state: RuntimeState, jobId: string, error: unknown): void => {
  if (!typedExecutionFailure(error) || isSharedTransportAuthorizationFailure(error)) throw error;
  state.lastErrorCode = failureCode(error, "EXECUTION_RECONCILIATION_PENDING");
  state.lastErrorReason = safeReason(error);
  state.store.setCurrentReason(jobId, state.lastErrorCode);
};

const readDeliveryCandidates = (state: RuntimeState): NonNullable<Parameters<typeof claimProductionTasks>[5]> => {
  const candidates: NonNullable<Parameters<typeof claimProductionTasks>[5]>[number][] = [];
  let cursor: string | null = null;
  for (;;) {
    const ids = state.store.jobIdsAfter(cursor, 32);
    for (const jobId of ids) {
      try {
        const row = state.store.readTask(jobId);
        if (!row || row.status !== "failed") continue;
        if (state.store.readSealedSourceHandoff(jobId, row.current_attempt_id)) continue;
        const complete = state.store.readCompleteOutput(jobId, row.current_attempt_id);
        const candidateHash = row.staged_result?.execution_receipt_hash ?? complete?.execution_receipt_hash;
        if (candidateHash) candidates.push({ job_id: jobId,
          attempt_id: row.current_attempt_id, candidate_hash: candidateHash });
      } catch (error) { recordJobReadbackFailure(state, jobId, error); }
    }
    if (ids.length < 32) break;
    cursor = ids[ids.length - 1]!;
  }
  return candidates.sort((a, b) => compareJobIds(a.job_id, b.job_id));
};

const circularJobPage = (ids: readonly string[], cursor: string | null, limit: number): string[] => [
  ...ids.filter(id => cursor === null || compareJobIds(id, cursor) > 0),
  ...ids.filter(id => cursor !== null && compareJobIds(id, cursor) <= 0),
].slice(0, limit);

const nextStatusJobIds = (state: RuntimeState): readonly string[] => {
  if (state.draining && state.drainJobIds) {
    const ids = [...state.drainJobIds].sort(compareJobIds), cursor = state.lastStatusJobId;
    const page = circularJobPage(ids, cursor, 32);
    state.lastStatusJobId = page.at(-1) ?? null;
    return page;
  }
  const priority = readDeliveryCandidates(state).slice(0, PRODUCTION_BUSINESS_CAPACITY_MAX).map(row => row.job_id);
  const selected = new Set(priority);
  for (let pageNumber = 0; pageNumber < 2 && selected.size < 32; pageNumber++) {
    const page = [...new Set([...state.store.jobIdsAfter(state.lastStatusJobId, 32),
      ...[...state.active.keys()].filter(id => state.lastStatusJobId === null
        || compareJobIds(id, state.lastStatusJobId) > 0)])].sort(compareJobIds).slice(0, 32);
    for (const id of page) {
      state.lastStatusJobId = id;
      selected.add(id);
      if (selected.size === 32) break;
    }
    if (page.length === 0 || page.length < 32 && state.lastStatusJobId === page[page.length - 1]) {
      state.lastStatusJobId = null;
    }
  }
  return [...selected];
};

const reconcileOneAuthority = async (state: RuntimeState, jobId: string): Promise<AuthorityReadback | null> => {
  let remote: RemoteProductionDeviceJobStatus;
  try { remote = await readProductionDeviceJobStatus(state.session, jobId); }
  catch (error) {
    if (!websiteJobAbsent(error)) throw error;
    await purgeDeletedJob(state, jobId);
    return null;
  }
  if (remote.control_intent.intent !== "none") {
    const running = state.active.get(jobId);
    state.activeAbort.get(jobId)?.abort(`CONTROL_INTENT:${remote.control_intent.intent}:${remote.control_intent.reason_code ?? "none"}`);
    if (running) await running;
    await state.store.joinOutboxWrites();
    if (remote.control_intent.intent === "cancel_requested"
      && remote.control_intent.reason_code === "ADMIN_AI_WORK_ORDER_REPLACEMENT") {
      (state.drainJobIds ??= new Set()).add(jobId);
    }
  }
  let task = state.store.readTask(jobId);
  if (!task) return null;
  await reconcileBusinessAdmission(state, task, remote);
  task = state.store.readTask(jobId);
  if (!task) return null;
  if (task.status === "failed" && task.attempt_failure) await reconcileAttemptFailure(state, task, remote);
  return { task: state.store.readTask(jobId)!, remote };
};

/** One fair bounded status pass for all durable states; direct execution keeps its own safety read. */
export const reconcileRuntimeAuthorities = async (state: RuntimeState): Promise<readonly AuthorityReadback[]> => {
  const selected: AuthorityReadback[] = [];
  for (const jobId of nextStatusJobIds(state)) {
    let span: RuntimeSpanHandle | null = null;
    try {
      span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({ traceId: jobId,
        owner: "production-runtime", component: "production-admission-readback", operation: "website.v6-request",
        typedIdentity: { kind: "job", jobId } }));
    } catch (error) {
      state.lastErrorCode = failureCode(error, "RUNTIME_LOG_SINK_WRITE_FAILED");
      state.lastErrorReason = safeReason(error);
    }
    try {
      const item = await reconcileOneAuthority(state, jobId);
      if (item) selected.push(item);
      if (span) requireRuntimeLogWrite(span.terminal({ outcome: "succeeded",
        ...(item?.task.status === "completed" ? { authorityRef: `production-task:${jobId}`,
          authorityHash: hashCanonical(item.task) } : {}) }));
    } catch (error) {
      recordJobReadbackFailure(state, jobId, error);
      if (span) terminalSpanFailure(span, error, runtimeLogCauseEventId(error), "EXECUTION_RECONCILIATION_PENDING");
    }
  }
  return selected;
};

const claimAdmissionEligible = (
  state: RuntimeState, availableNewSlots: number, hasExistingAttemptRecovery: boolean,
  hasPendingStagedResult: boolean, attestationEligible: boolean,
): boolean => {
  const browser = state.browserAuthority.readProductionRuntimeState();
  return (availableNewSlots > 0 || hasExistingAttemptRecovery)
    && (state.executor.availableCapacity() > 0 || hasPendingStagedResult)
    && attestationEligible && state.ledgerReconciled
    && (browser.browserAuthorityState === "present" || hasPendingStagedResult)
    && !state.draining && state.runtimeLogger.isWritable()
    && (state.providerRateLimitControl.canRequestClaimAuthority()
      || hasPendingStagedResult);
};

const workerIteration = async (state: RuntimeState): Promise<number> => {
  try {
  const authorities = await reconcileRuntimeAuthorities(state);
  if (!state.runtimeLogger.isWritable()) return 1_000;
  for (const reconcile of [
    () => state.providerRateLimitControl.reconcilePendingIntents(),
    () => state.executor.reconcilePendingProviderRateLimitIncidents(state.abort.signal),
  ]) {
    try { await reconcile(); }
    catch (error) {
      if (!typedExecutionFailure(error) && !failureCode(error).startsWith("BROWSER_")) throw error;
      if (isSharedTransportAuthorizationFailure(error)) throw error;
      state.lastErrorCode = failureCode(error, "PROVIDER_RECOVERY_PENDING");
      state.lastErrorReason = safeReason(error);
    }
  }
  refreshLedgerReconciled(state);
  const sourceEvidence = await prepareSourceHandoffs(state,
    authorities.map(item => ({ task: item.task, control: item.remote.control_intent })));
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
  const hasAcceptedAttemptRecovery = state.store.taskAuthorities().some((row) =>
    row.status === "failed" && row.current_attempt_id !== null
      && !state.active.has(row.task.job_id)
      && !state.store.attemptClosedByWebsite(row.task.job_id, row.current_attempt_id));
  const deliveryCandidates = state.draining ? [] : readDeliveryCandidates(state).filter(row => !state.active.has(row.job_id));
  const hasPendingStagedResult = deliveryCandidates.length > 0;
  const hasExistingAttemptRecovery = hasAcceptedAttemptRecovery || hasPendingStagedResult;
  const eligible = claimAdmissionEligible(state, availableNewSlots,
    hasExistingAttemptRecovery, hasPendingStagedResult, attestation.claim_eligible);
  if (!state.ledgerReconciled || !eligible && sourceEvidence.length === 0) return 1_000;
  const candidates = new Set(deliveryCandidates.map(row => row.job_id));
  const sources = sourceEvidence.filter(source => !candidates.has(source.job_id));
  const transportIds = [...new Set([...sources.map(source => source.job_id), ...candidates])].sort(compareJobIds);
  const cursor = state.lastTransportJobId;
  const page = circularJobPage(transportIds, cursor, PRODUCTION_BUSINESS_CAPACITY_MAX);
  const selected = new Set(page);
  const recoveryOnlyClaim = availableNewSlots <= 0 && hasExistingAttemptRecovery;
  if (page.length) state.lastTransportJobId = page[page.length - 1]!;
  const batch = await requestClaimBatch(
    state, Math.max(1, availableNewSlots), state.draining || recoveryOnlyClaim,
    sources.filter(source => selected.has(source.job_id)), deliveryCandidates.filter(candidate => selected.has(candidate.job_id)),
  );
  launchClaimJobs(state, batch.jobs);
  return batch.outcome === "LEASE_GRANTED" ? 1_000 : batch.next_claim_after_ms;
  } finally {
    await reconcileCompletedBrowserTargets(state);
  }
};

export const workerLoop = async (state: RuntimeState, onIterationSettled?: () => void): Promise<void> => {
  let delay = 1_000;
  while (!state.abort.signal.aborted) {
    try {
      state.iteration = workerIteration(state);
      delay = await state.iteration;
      if (state.lastErrorCode !== "BROWSER_HOST_UNAVAILABLE") {
        state.lastErrorCode = null;
        state.lastErrorReason = null;
      }
    } catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_RUNTIME_FAILED");
      state.lastErrorReason = safeReason(error);
      delay = Math.min(30_000, Math.max(1_000, delay * 2));
    }
    state.iteration = null;
    onIterationSettled?.();
    await wait(delay, state.abort.signal);
  }
};

export const sessionHeartbeatLoop = async (state: RuntimeState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await wait(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    if (!state.runtimeLogger.isWritable()) continue;
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
