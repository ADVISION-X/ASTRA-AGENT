import { join } from "node:path";
import {
  acceptClaim, completeClaim, executeAndUpload,
  handleRuntimeBoundaryFailure,
} from "./runtime-claim-operations.js";

import {
  executionFailure,
  executionFailureMetadata,
  failureCode,
  typedExecutionFailure,
} from "../../execution-failure.js";
import { classifyAttemptFailure, serializeTerminalFailureTransport } from "./terminal-failure.js";
import {
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { buildProductionLeaseRelease } from "./cloud-client.js";
import {
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { ProductionRuntimeBoundaryError, renewExecutionLease } from "./runtime-execution-heartbeat.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import { type ClaimedProductionTask } from "./transport-protocol.js";
import { releaseLeaseWithLog, terminalSpanFailure } from "./runtime-logging.js";
import {
  jobIdentity,
  leaseBudget,
  safeReason,
  type RuntimeState,
} from "./runtime-state.js";
import {
  websiteJobAbsent,
} from "./runtime-business-admission.js";
import { productionRuntimeTaskPath } from "./runtime-storage-inventory.js";
import { reconcileBusinessAdmission } from "./runtime-business-admission.js";
import type { AttemptFailureFirstFact } from "./terminal-failure.js";
import type { StoredProductionTask } from "./store.js";
import {
  attemptFailureAuthorityConflict, firstFact, postFailureAndReadback,
  releaseReceiptMatches, remoteFailureMatches,
} from "./runtime-attempt-failure-readback.js";
import { reconcileClaimAttemptFailure } from "./runtime-claim-recovery.js";
import { reconcileSourceReadbackFailure } from "./runtime-claim-source-readback-failure.js";
import { readClaimAuthority, recoverMissingLocalTask, restoreStagedResult,
  deliverExistingResult } from "./runtime-claim-preproduct.js";


const authoritativeGptDialog = (
  error: unknown,
  expectedCode: "BROWSER_GPT_DIALOG_UNRECOGNIZED" | "BROWSER_KNOWN_GPT_RATE_LIMIT",
): Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }> | null => {
  if (failureCode(error) !== expectedCode) return null;
  const authority = executionFailureMetadata(error)?.knownGptDialogAuthority;
  return authority ? Object.freeze({
    authorityRef: authority.evidenceRef,
    authorityHash: authority.evidenceHash,
  }) : null;
};



const applyRemoteFailureDisposition = async (
  state: RuntimeState,
  task: StoredProductionTask,
  remote: RemoteProductionDeviceJobStatus,
): Promise<void> => {
  if (remote.next_action_code === "WAIT_NEW_ATTEMPT") {
    if (!task.staged_result
      && state.store.readResultOutboxHistoryEvidence(
        task.task.job_id, task.current_attempt_id ?? "").candidateCount === 0
      && state.browserAuthority.readJobPhysicalInputState(task.task.job_id) === "zero") {
      await state.browserAuthority.releaseJobBoundTarget(
        task.task.job_id, "wait-new-attempt", state.abort.signal,
      );
    }
    state.store.setCurrentReason(task.task.job_id,
      "SOURCE_HANDOFF_RECONCILIATION_PENDING");
    return;
  }
  if (remote.next_action_code === "CONSUME_CURRENT_RESULT") {
    if (!task.staged_result) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RESULT_AUTHORITY_MISSING");
    }
    await reconcileBusinessAdmission(state, state.store.readTask(task.task.job_id)!, remote);
  }
};

const pendingFailureConflicts = (
  state: RuntimeState, task: StoredProductionTask,
  remote: RemoteProductionDeviceJobStatus, failure: AttemptFailureFirstFact,
): boolean => {
  if (!remote.attempt_failure || remoteFailureMatches(remote, failure)) return false;
  const conflict = attemptFailureAuthorityConflict(remote, failure);
  const evidence = executionFailureMetadata(conflict)?.evidence;
  state.store.setCurrentReason(task.task.job_id, [conflict.code,
    evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
  return true;
};

const attemptReadbackFailureIsLocal = (error: unknown): boolean => {
  const transport = typedRuntimeTransportFailure(error);
  if (transport) return ![401, 403].includes(transport.httpStatus);
  const code = failureCode(error);
  if (code === "CLOUD_TRANSPORT_UNAVAILABLE") return true;
  if (typedExecutionFailure(error) === null) return false;
  return code.startsWith("BROWSER_") && code !== "BROWSER_REPAIR_REQUIRED"
    || ["PRODUCTION_ATTEMPT_FAILURE_NEXT_ACTION_MISMATCH", "PRODUCTION_ATTEMPT_FAILURE_RESULT_AUTHORITY_MISSING",
      "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT", "BUSINESS_ADMISSION_RESULT_HASH_MISMATCH",
      "BUSINESS_ADMISSION_ATTEMPT_IDENTITY_MISSING"].includes(code);
};
const persistAttemptFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  parentSpanId: string,
): Promise<void> => {
  const failure = serializeTerminalFailureTransport(error);
  const release = buildProductionLeaseRelease(state.session, job, {
    reasonCode: "ATTEMPT_FAILED", attemptFailure: failure,
  });
  const localFailure = firstFact(failure, release);
  const persisted = state.store.recordAttemptFailure(job.job_id, job.grant.attempt_id, localFailure);
  try {
    const remote = await postFailureAndReadback(
      state, job, release, localFailure, parentSpanId,
      runtimeLogCauseEventId(error) ?? parentSpanId,
    );
    await applyRemoteFailureDisposition(state, persisted, remote);
  } catch (readbackError) {
    const code = failureCode(readbackError, "ATTEMPT_RELEASE_READBACK_FAILED");
    const evidence = executionFailureMetadata(readbackError)?.evidence;
    state.store.setCurrentReason(job.job_id,
      [code, evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
    state.lastErrorCode = code;
    state.lastErrorReason = safeReason(readbackError);
  }
};
const pauseForProviderCooldown = (
  state: RuntimeState, job: ClaimedProductionTask, code: string,
  rateLimitAuthority: Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }> | null,
): boolean => {
  if (code !== "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE"
    && (code !== "BROWSER_KNOWN_GPT_RATE_LIMIT" || !rateLimitAuthority)) return false;
  try {
    state.providerRateLimitControl.assertProviderSubmitAllowed();
    return false;
  } catch (gateError) {
    if (failureCode(gateError) !== "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return false;
  }
  if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT" && rateLimitAuthority) {
    state.store.setCurrentReason(job.job_id, [
      "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE",
      rateLimitAuthority.authorityRef,
      rateLimitAuthority.authorityHash,
    ].join("|"));
    return true;
  }
  state.store.setCurrentReason(job.job_id, "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
  return true;
};

/** Consume this iteration's exact status instead of issuing a second failed-only scan. */
export const reconcileAttemptFailure = async (state: RuntimeState, task: StoredProductionTask,
  remote: RemoteProductionDeviceJobStatus): Promise<void> => {
  const failure = task.attempt_failure;
  if (!failure) return;
  try {
    if (pendingFailureConflicts(state, task, remote, failure)
      || !releaseReceiptMatches(remote, failure) && !remoteFailureMatches(remote, failure)) return;
    if (remote.next_action_code === "WAIT_NEW_ATTEMPT" || remote.next_action_code === "CONSUME_CURRENT_RESULT") {
      await applyRemoteFailureDisposition(state, task, remote);
    } else if (remote.next_action_code !== "ACTIVE_ATTEMPT") {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_NEXT_ACTION_MISMATCH");
    }
  } catch (error) {
    if (!attemptReadbackFailureIsLocal(error)) throw error;
    state.lastErrorCode = failureCode(error, "ATTEMPT_RELEASE_READBACK_FAILED");
    state.lastErrorReason = safeReason(error);
    state.store.setCurrentReason(task.task.job_id, state.lastErrorCode);
  }
};

const handleProductExecutionFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  jobSpan: RuntimeSpanHandle,
  recoveryReadback: boolean,
): Promise<void> => {
  if (error instanceof ProductionRuntimeBoundaryError) throw error.boundaryCause;
  if (websiteJobAbsent(error)) {
    state.activeAbort.get(job.job_id)?.abort("WEBSITE_JOB_ABSENT");
    requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
    return;
  }
  const code = failureCode(error);
  const mismatchAuthority = authoritativeGptDialog(error, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  const rateLimitAuthority = authoritativeGptDialog(error, "BROWSER_KNOWN_GPT_RATE_LIMIT");
  const browserAuthority = mismatchAuthority ?? rateLimitAuthority;
  const failureEvent = terminalSpanFailure(
    jobSpan, error, runtimeLogCauseEventId(error), "JOB_EXECUTION_FAILED",
    browserAuthority ?? undefined,
    browserAuthority ? "browser-session" : undefined,
  );
  try {
    if (recoveryReadback && !(code === "RESULT_SETTLED_UNUSABLE"
      && state.store.readAttemptFailureRaw(job.job_id) === null
      && classifyAttemptFailure(serializeTerminalFailureTransport(error)) === "new_attempt_allowed")) {
      await reconcileSourceReadbackFailure(state, job, error, code);
      const release = buildProductionLeaseRelease(state.session, job, {
        reasonCode: "PROVIDER_READBACK_UNAVAILABLE", attemptFailure: null,
      });
      await releaseLeaseWithLog(state, job, jobSpan.spanId, release, failureEvent.eventId);
      return;
    }
    if (code === "BROWSER_GPT_DIALOG_UNRECOGNIZED" && mismatchAuthority) {
      state.store.setCurrentReason(job.job_id, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
      return;
    }
    if (pauseForProviderCooldown(state, job, code, rateLimitAuthority)) return;
    await persistAttemptFailure(state, job, error, jobSpan.spanId);
  } catch (postTerminalError) {
    state.lastErrorCode = failureCode(postTerminalError, "PRODUCTION_FAILURE_RECONCILIATION_PENDING");
    state.lastErrorReason = safeReason(postTerminalError);
  }
};

const acceptControlledClaim = (state: RuntimeState, job: ClaimedProductionTask,
  jobSpan: RuntimeSpanHandle, budget: () => Parameters<typeof acceptClaim>[2]): void => {
  if (state.store.readTask(job.job_id)?.current_attempt_id !== job.grant.attempt_id) {
    acceptClaim(state, job, budget(), jobSpan, null, null);
  }
};

export const executeClaim = async (state: RuntimeState, job: ClaimedProductionTask): Promise<void> => {
  const abort = state.activeAbort.get(job.job_id)!;
  const acceptance: { durable: "unknown" | "unaccepted" | "accepted" } = { durable: "unknown" };
  const jobSpan = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, boundaryId: job.grant.claim_batch_id, owner: "production-runtime",
    component: "production-runtime", operation: "job.execute", typedIdentity: jobIdentity(job),
  }));
  try {
    acceptance.durable = "unaccepted";
    const authority = await readClaimAuthority(state, job, jobSpan);
    if (!authority) return;
    const controlRequested = authority.control_intent.intent !== "none";
    if (controlRequested) {
      abort.abort(`CONTROL_INTENT:${authority.control_intent.intent}:${authority.control_intent.reason_code ?? "none"}`);
      acceptControlledClaim(state, job, jobSpan, () => leaseBudget(job, abort));
      acceptance.durable = "accepted";
    }
    if (recoverMissingLocalTask(state, job, authority, acceptance, jobSpan)) return;
    restoreStagedResult(state, job, authority);
    if (await deliverExistingResult(state, job, acceptance, jobSpan)) return;
    if (controlRequested) {
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    if (job.grant.delivery_only) throw executionFailure("failed", "PRODUCTION_DELIVERY_ONLY_RESULT_PENDING");
    const recovery = await reconcileClaimAttemptFailure(state, job, authority, jobSpan.spanId, applyRemoteFailureDisposition);
    if (recovery.stopBeforeProduct) {
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    const budget = leaseBudget(job, abort);
    budget.control_epoch = authority.control_intent.control_epoch;
    await renewExecutionLease({ state, job, budget, abort, parentSpanId: jobSpan.spanId });
    if (abort.signal.aborted) {
      acceptControlledClaim(state, job, jobSpan, () => budget);
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    const accepted = acceptClaim(state, job, budget, jobSpan, recovery.reconciledFailure, recovery.readbackOnlyCalls);
    acceptance.durable = "accepted";
    state.store.markExecuting(job.job_id);
    const materialDir = join(productionRuntimeTaskPath(state.dataDir, job.job_id), "materials");
    let result: Awaited<ReturnType<typeof executeAndUpload>>;
    try {
      result = await executeAndUpload({ state, job, task: accepted.task, budget: accepted.budget, materialDir, abort, jobSpan });
    } catch (error) {
      await handleProductExecutionFailure(state, job, error, jobSpan,
        !(error instanceof ProductionRuntimeBoundaryError) && (recovery.reconciledFailure !== null
          || job.grant.same_accepted_attempt && state.browserAuthority.readJobPhysicalInputState(job.job_id) !== "zero"));
      return;
    }
    await completeClaim({ state, job, result, jobSpan });
  } catch (error) {
    if (websiteJobAbsent(error)) {
      state.activeAbort.get(job.job_id)?.abort("WEBSITE_JOB_ABSENT");
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    const failure = terminalSpanFailure(jobSpan, error, runtimeLogCauseEventId(error), "JOB_RUNTIME_BOUNDARY_FAILED");
    await handleRuntimeBoundaryFailure({ state, job, error, durability: acceptance.durable,
      parentSpanId: jobSpan.spanId, causeEventId: failure.eventId });
  }
};
