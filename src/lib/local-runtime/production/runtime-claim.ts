import { join } from "node:path";
import {
  acceptClaim, completeClaim, downloadClaimMaterials, executeAndUpload,
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
  readProductionDeviceJobStatus,
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { ProductionRuntimeBoundaryError } from "./runtime-execution-heartbeat.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import { releaseLeaseWithLog, terminalSpanFailure } from "./runtime-logging.js";
import {
  jobIdentity,
  safeReason,
  type RuntimeState,
} from "./runtime-state.js";
import {
  purgeDeletedJob,
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
    await reconcileBusinessAdmission(state, state.store.readTask(task.task.job_id)!);
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

export const reconcilePendingAttemptFailures = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.pendingAttemptFailures()) {
    const failure = task.attempt_failure;
    if (!failure) {
      state.store.setCurrentReason(task.task.job_id,
        "INVALID_FIRST_FACT_RECONCILIATION_PENDING");
      continue;
    }
    try {
      const remote = await readProductionDeviceJobStatus(state.session, task.task.job_id);
      if (pendingFailureConflicts(state, task, remote, failure)) continue;
      if (!releaseReceiptMatches(remote, failure) && !remoteFailureMatches(remote, failure)) continue;
      if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
        || remote.next_action_code === "CONSUME_CURRENT_RESULT") {
        await applyRemoteFailureDisposition(state, task, remote);
        continue;
      }
      if (remote.next_action_code !== "ACTIVE_ATTEMPT") {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_NEXT_ACTION_MISMATCH");
      }
      const disposition = classifyAttemptFailure(failure.failure_core);
      if (disposition !== "same_attempt_provider_readback") {
        state.store.setCurrentReason(task.task.job_id, "SOURCE_HANDOFF_RECONCILIATION_PENDING");
        continue;
      }
    } catch (error) {
      if (!websiteJobAbsent(error)) {
        const transport = typedRuntimeTransportFailure(error);
        const code = failureCode(error);
        const local = transport !== null || code === "CLOUD_TRANSPORT_UNAVAILABLE"
          || (typedExecutionFailure(error) !== null && ((code.startsWith("BROWSER_") && code !== "BROWSER_REPAIR_REQUIRED")
            || ["PRODUCTION_ATTEMPT_FAILURE_NEXT_ACTION_MISMATCH", "PRODUCTION_ATTEMPT_FAILURE_RESULT_AUTHORITY_MISSING",
              "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT", "BUSINESS_ADMISSION_RESULT_HASH_MISMATCH",
              "BUSINESS_ADMISSION_ATTEMPT_IDENTITY_MISSING"].includes(code)));
        if (!local || (transport && [401, 403].includes(transport.httpStatus))) throw error;
        state.lastErrorCode = failureCode(error, "ATTEMPT_RELEASE_READBACK_FAILED");
        state.lastErrorReason = safeReason(error);
        state.store.setCurrentReason(task.task.job_id, state.lastErrorCode);
        continue;
      }
      const active = state.activeAbort?.get(task.task.job_id);
      if (active) {
        active.abort("WEBSITE_JOB_ABSENT");
        continue;
      }
      try {
        await purgeDeletedJob(state, task.task.job_id);
      } catch (purgeError) {
        state.store.setCurrentReason(task.task.job_id,
          failureCode(purgeError, "PRODUCTION_JOB_PURGE_FAILED"));
      }
      continue;
    }
  }
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

const handleProductExecutionFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  jobSpan: RuntimeSpanHandle,
  recoveryReadback: boolean,
): Promise<void> => {
  if (error instanceof ProductionRuntimeBoundaryError) throw error.boundaryCause;
  if (websiteJobAbsent(error)) {
    await purgeDeletedJob(state, job.job_id);
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
    if (recoveryReadback) {
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

export const executeClaim = async (state: RuntimeState, job: ClaimedProductionTask): Promise<void> => {
  const abort = state.activeAbort.get(job.job_id)!;
  const acceptance: { durable: "unknown" | "unaccepted" | "accepted" } = { durable: "unknown" };
  const materialDir = join(productionRuntimeTaskPath(state.dataDir, job.job_id), "materials");
  const jobSpan = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, boundaryId: job.grant.claim_batch_id, owner: "production-runtime",
    component: "production-runtime", operation: "job.execute", typedIdentity: jobIdentity(job),
  }));
  try {
    acceptance.durable = "unaccepted";
    const remote = await readClaimAuthority(state, job, jobSpan);
    if (!remote) return;
    if (recoverMissingLocalTask(state, job, remote, acceptance, jobSpan)) return;
    restoreStagedResult(state, job, remote);
    if (await deliverExistingResult(state, job, acceptance, jobSpan)) return;
    if (job.grant.delivery_only) {
      throw executionFailure("failed", "PRODUCTION_DELIVERY_ONLY_RESULT_PENDING");
    }
    const failureReconciliation = await reconcileClaimAttemptFailure(
      state, job, remote, jobSpan.spanId, applyRemoteFailureDisposition,
    );
    if (failureReconciliation.stopBeforeProduct) {
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    const claim = acceptClaim(
      state, job, abort, jobSpan, failureReconciliation.reconciledFailure,
      failureReconciliation.readbackOnlyCalls,
    );
    acceptance.durable = "accepted";
    state.store.markExecuting(job.job_id);
    const materials = await downloadClaimMaterials(state, job, materialDir, jobSpan);
    let result: Awaited<ReturnType<typeof executeAndUpload>>;
    try {
      result = await executeAndUpload({
        state, job, task: claim.task, budget: claim.budget,
        materials, abort, jobSpan,
      });
    } catch (error) {
      await handleProductExecutionFailure(
        state, job, error, jobSpan,
        failureReconciliation.reconciledFailure !== null
          || job.grant.same_accepted_attempt
            && state.browserAuthority.readJobPhysicalInputState(job.job_id) !== "zero",
      );
      return;
    }
    await completeClaim({ state, job, ...result, materialDir, jobSpan });
  } catch (error) {
    if (websiteJobAbsent(error)) {
      try {
        await purgeDeletedJob(state, job.job_id);
        requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
        return;
      } catch (purgeError) {
        error = purgeError;
      }
    }
    const failureEvent = terminalSpanFailure(
      jobSpan, error, runtimeLogCauseEventId(error), "JOB_RUNTIME_BOUNDARY_FAILED",
    );
    await handleRuntimeBoundaryFailure({
      state, job, durability: acceptance.durable, error, parentSpanId: jobSpan.spanId,
      causeEventId: failureEvent.eventId,
    });
  }
};
