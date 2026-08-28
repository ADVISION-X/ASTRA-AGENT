import { randomUUID } from "node:crypto";

import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
} from "../../runtime-logs/index.js";
import { failureCode } from "../../typed-failure.js";
import { claimProductionTasks } from "./cloud-client.js";
import { sendProductionOutboxWrite } from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { hashCanonical } from "./contracts.js";
import type { ProductionRuntimeHealth } from "./runtime-contract.js";
import { executeClaim } from "./runtime-claim.js";
import { emitRuntimeState, terminalSpanFailure } from "./runtime-logging.js";
import {
  classifyFailure,
  refreshLedgerReconciled,
  safeReason,
  wait,
  type RuntimeState,
} from "./runtime-state.js";

export const runtimeState = async (state: RuntimeState) => {
  refreshLedgerReconciled(state);
  const browser = state.browserAuthority.readProductionRuntimeState();
  const observedLane = state.browserAuthority.readBrowserLaneState();
  const lane: "blocked" | "busy" | "idle" = browser.browserAuthorityState !== "present"
    || observedLane === "unsettled" ? "blocked" : observedLane;
  return {
    business_in_flight: state.active.size,
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
    browserLaneState: browser.browserAuthorityState !== "present" || browserLane === "unsettled"
      ? "blocked" : browserLane,
    contractManifestHash: state.session.device.control_manifest_hash,
    catalogHash: productionCatalogHash, activeCount: state.active.size,
    pendingOutboxCount: state.store.pendingOutboxCount(), lastSuccessfulHeartbeatAt: state.lastHeartbeat,
    lastErrorCode: state.lastErrorCode, lastErrorReason: state.lastErrorReason, checkedAt: new Date().toISOString(),
  };
};

export const flushOutboxWithLog = async (state: RuntimeState): Promise<void> => {
  for (const write of state.store.pendingOutbox()) {
    const current = state.store.readOutboxAuthority(write.idempotency_key)!;
    if (current.state === "failed") state.store.markOutboxPending(write.idempotency_key);
    const authority = state.store.readOutboxAuthority(write.idempotency_key)!;
    const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
      traceId: authority.jobId, owner: "outbox", component: "production-outbox", operation: "outbox.flush",
      typedIdentity: { kind: "outbox", jobId: authority.jobId, outboxId: authority.idempotencyKey },
    }));
    try {
      await state.store.deliverOutbox(write.idempotency_key, () => sendProductionOutboxWrite(state.session, write));
      const delivered = state.store.readOutboxAuthority(write.idempotency_key)!;
      requireRuntimeLogWrite(span.terminal({
        outcome: "success", authorityRef: `production-outbox:${delivered.idempotencyKey}`,
        authorityHash: hashCanonical(delivered),
      }));
    } catch (error) {
      state.store.markOutboxFailed(write.idempotency_key, "OUTBOX_DELIVERY_FAILED");
      const failed = state.store.readOutboxAuthority(write.idempotency_key)!;
      const terminal = requireRuntimeLogWrite(span.terminal({
        outcome: "failed", authorityRef: `production-outbox:${failed.idempotencyKey}`,
        authorityHash: hashCanonical(failed), failure: runtimeFailureFromError({
          error, code: "OUTBOX_DELIVERY_FAILED", responsibleOwner: "outbox",
          recovery: RuntimeRecovery.RETRY, impact: RuntimeFailureImpact.BLOCKING,
        }),
      }));
      throw withRuntimeLogCause(error, terminal.eventId);
    }
  }
};

const requestClaimBatch = async (state: RuntimeState, available: number) => {
  const boundaryId = `aipclaim_${randomUUID()}`;
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: `producer:${state.runtimeLogger.producerRunId}`, boundaryId, owner: "production-runtime",
    component: "production-claim", operation: "cloud.claim",
    typedIdentity: { kind: "request", requestId: boundaryId },
  }));
  try {
    const batch = await claimProductionTasks(state.session, available, boundaryId);
    if (batch.outcome === "CLAIM_BLOCKED") {
      requireRuntimeLogWrite(span.terminal({
        outcome: "failed", failure: runtimeFailureFromError({
          error: new Error(`CLAIM_BLOCKED:${batch.reason_codes.join(",") || "unspecified"}`),
          code: "CLAIM_BLOCKED", responsibleOwner: "production-runtime",
          recovery: RuntimeRecovery.BACKOFF, impact: RuntimeFailureImpact.BLOCKING,
        }),
      }));
      emitRuntimeState({ state, stateKey: "claim.admission", current: "blocked" });
    } else requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
    return batch;
  } catch (error) {
    const terminal = terminalSpanFailure(
      span, error, classifyFailure(error), runtimeLogCauseEventId(error), "CLAIM_REQUEST_FAILED",
    );
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

const launchClaimJobs = (
  state: RuntimeState,
  jobs: Awaited<ReturnType<typeof claimProductionTasks>>["jobs"],
): void => {
  for (const job of [...jobs].sort((left, right) => left.job_id.localeCompare(right.job_id))) {
    if (state.active.has(job.job_id)) continue;
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

const workerIteration = async (state: RuntimeState): Promise<number> => {
  await flushOutboxWithLog(state);
  const attestation = await state.session.ensureFreshAttestation();
  state.lastHeartbeat = attestation.issued_at;
  emitRuntimeState({ state, stateKey: "cloud.session", current: "connected" });
  const available = Math.min(10 - state.active.size, state.executor.availableCapacity());
  const eligible = available > 0 && attestation.claim_eligible && state.ledgerReconciled
    && !state.draining && state.runtimeLogger.isWritable();
  emitRuntimeState({
    state, stateKey: "claim.admission",
    current: state.draining ? "draining" : eligible ? "eligible" : "blocked",
  });
  if (!eligible) return 1_000;
  const batch = await requestClaimBatch(state, available);
  launchClaimJobs(state, batch.jobs);
  return batch.outcome === "LEASE_GRANTED" ? 1_000 : batch.next_claim_after_ms;
};

export const workerLoop = async (state: RuntimeState): Promise<void> => {
  let delay = 1_000;
  while (!state.abort.signal.aborted) {
    try {
      delay = await workerIteration(state);
      state.lastErrorCode = null;
      state.lastErrorReason = null;
    } catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_RUNTIME_FAILED");
      state.lastErrorReason = safeReason(error);
      emitRuntimeState({ state, stateKey: "cloud.session", current: "stale" });
      emitRuntimeState({ state, stateKey: "claim.admission", current: "blocked" });
      delay = Math.min(30_000, Math.max(1_000, delay * 2));
    }
    await wait(delay, state.abort.signal);
  }
};

export const sessionHeartbeatLoop = async (state: RuntimeState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await wait(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    emitRuntimeState({
      state, stateKey: "producer.alive", current: "alive", freshForMs: 65_000, force: true, owner: "app-shell",
    });
    try {
      const receipt = await state.session.heartbeat();
      state.lastHeartbeat = receipt.issued_at;
      emitRuntimeState({ state, stateKey: "cloud.session", current: "connected" });
    } catch (error) {
      state.lastErrorCode = failureCode(error, "SESSION_HEARTBEAT_FAILED");
      state.lastErrorReason = safeReason(error);
      emitRuntimeState({ state, stateKey: "cloud.session", current: "stale" });
      if (!state.draining) emitRuntimeState({ state, stateKey: "claim.admission", current: "blocked" });
    }
  }
};
