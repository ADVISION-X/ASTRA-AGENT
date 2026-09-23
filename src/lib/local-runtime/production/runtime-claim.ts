import { join } from "node:path";
import {
  acceptClaim, completeClaim, downloadClaimMaterials, executeAndUpload,
  handleRuntimeBoundaryFailure,
} from "./runtime-claim-operations.js";

import {
  executionFailure,
  executionFailureMetadata,
  failureCode,
} from "../../execution-failure.js";
import { classifyAttemptFailure, serializeTerminalFailureTransport } from "./terminal-failure.js";
import {
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { buildProductionLeaseRelease, buildTerminalProductionIntent,
  deliverTerminalProductionIntent } from "./cloud-client.js";
import {
  readProductionDeviceJobStatus,
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { hashCanonical, sha256 } from "./contracts.js";
import { ProductionRuntimeBoundaryError } from "./runtime-execution-heartbeat.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";
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
      && !state.store.hasUploadedResultCandidate(task.task.job_id, task.current_attempt_id ?? "")
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
    let remote: RemoteProductionDeviceJobStatus;
    try {
      remote = await readProductionDeviceJobStatus(state.session, task.task.job_id);
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
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
    if (pendingFailureConflicts(state, task, remote, failure)) continue;
    if (!releaseReceiptMatches(remote, failure) && !remoteFailureMatches(remote, failure)) continue;
    if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
      || remote.next_action_code === "CONSUME_CURRENT_RESULT") {
      if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
        && state.browserAuthority.hasUnresolvedBrowserMutation()) continue;
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
const assertClaimFailureAuthority = (
  state: RuntimeState,
  job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus,
  claimBoundFailure: AttemptFailureFirstFact,
  remoteMatchesClaim: boolean,
  remoteMatchesFirstFact: boolean,
): void => {
  if (!remote.attempt_failure || remoteMatchesClaim || remoteMatchesFirstFact) return;
  const conflict = attemptFailureAuthorityConflict(remote, claimBoundFailure);
  const evidence = executionFailureMetadata(conflict)?.evidence;
  state.store.setCurrentReason(job.job_id, [conflict.code,
    evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
  throw conflict;
};

const assertLocalClaimFailureAuthority = (
  local: StoredProductionTask, failure: AttemptFailureFirstFact,
  job: ClaimedProductionTask,
): boolean => {
  if (local.current_attempt_id !== job.grant.attempt_id
    || failure.release_descriptor.attempt_id !== job.grant.attempt_id) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_MISSING");
  }
  return false;
};

const assertAbsentLocalFailureAuthority = (
  local: StoredProductionTask | null, job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus,
): void => {
  if (remote.attempt_failure) {
    throw executionFailure("failed", "PRODUCTION_REMOTE_ATTEMPT_FAILURE_LOCAL_AUTHORITY_MISSING");
  }
  if (job.grant.same_accepted_attempt
    && local && local.current_attempt_id !== job.grant.attempt_id) {
    throw executionFailure("failed", "PRODUCTION_REGRANTED_ATTEMPT_LOCAL_AUTHORITY_MISSING");
  }
};

const reconcileClaimAttemptFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus,
  parentSpanId: string,
): Promise<Readonly<{
  reconciledFailure: AttemptFailureFirstFact | null;
  stopBeforeProduct: boolean;
}>> => {
  const local = state.store.readTask(job.job_id);
  if (job.grant.source_handoff_seal_hash !== null
    && local?.current_reason === `SOURCE_HANDOFF_SEALED|${job.grant.source_handoff_seal_hash}`
    && local.current_attempt_id !== job.grant.attempt_id
    && remote.attempt_failure === null) {
    return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false });
  }
  const failure = local?.attempt_failure ?? null;
  if (!failure) {
    if (state.store.readAttemptFailureRaw(job.job_id) !== null) {
      throw executionFailure("failed", "PRODUCTION_FIRST_FACT_OPAQUE_RECONCILIATION_REQUIRED");
    }
    assertAbsentLocalFailureAuthority(local ?? null, job, remote);
    return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false });
  }
  if (assertLocalClaimFailureAuthority(local!, failure, job)) {
    return Object.freeze({ reconciledFailure: failure, stopBeforeProduct: false });
  }
  const claimRelease = buildProductionLeaseRelease(state.session, job, {
    reasonCode: "ATTEMPT_FAILED", attemptFailure: failure.failure_core,
  });
  const claimBoundFailure = firstFact(failure.failure_core, claimRelease);
  const remoteMatchesClaim = remoteFailureMatches(remote, claimBoundFailure);
  const remoteMatchesFirstFact = remoteFailureMatches(remote, failure);
  assertClaimFailureAuthority(
    state, job, remote, claimBoundFailure, remoteMatchesClaim, remoteMatchesFirstFact,
  );
  let effectiveFailure = failure;
  if (remoteMatchesClaim && hashCanonical(claimBoundFailure) !== hashCanonical(failure)) {
    effectiveFailure = state.store.rebindAttemptFailureReleaseDescriptor(
      job.job_id, failure, claimBoundFailure,
    ).attempt_failure!;
  }
  const remoteHasFailure = releaseReceiptMatches(remote, failure)
    || remoteMatchesFirstFact || remoteMatchesClaim;
  if (!remoteHasFailure) {
    const rebound = hashCanonical(claimBoundFailure) === hashCanonical(failure)
      ? failure
      : state.store.rebindAttemptFailureReleaseDescriptor(
        job.job_id, failure, claimBoundFailure,
      ).attempt_failure!;
    const reconciled = await postFailureAndReadback(
      state, job, claimRelease, rebound, parentSpanId, parentSpanId,
    );
    await applyRemoteFailureDisposition(state, state.store.readTask(job.job_id)!, reconciled);
    return Object.freeze({ reconciledFailure: rebound, stopBeforeProduct: true });
  }
  if (remote.next_action_code !== "ACTIVE_ATTEMPT") {
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_NEXT_ACTION_INVALID");
  }
  const sameAttempt = local!.current_attempt_id === job.grant.attempt_id;
  const disposition = classifyAttemptFailure(effectiveFailure.failure_core);
  if (disposition === "fail_closed")
    throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
  if ((disposition === "same_attempt_provider_readback") !== sameAttempt)
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_IDENTITY_INVALID");
  return Object.freeze({ reconciledFailure: effectiveFailure, stopBeforeProduct: false });
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
      const evidenceHash = executionFailureMetadata(error)?.evidence?.evidenceHash ?? null;
      state.store.recordSourceReadbackFailure(
        job.job_id, job.grant.attempt_id, code, evidenceHash,
      );
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
    let remote: Awaited<ReturnType<typeof readProductionDeviceJobStatus>>;
    try {
      remote = await readProductionDeviceJobStatus(state.session, job.job_id);
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
      await purgeDeletedJob(state, job.job_id);
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    if (remote.status !== "failed" || remote.terminal_status !== null
      || remote.accepted_attempt_count !== job.grant.accepted_attempt_count) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
    }
    if (!state.store.readTask(job.job_id) && job.grant.same_accepted_attempt
      && remote.attempt_failure === null) {
      const outbox = state.store.readResultOutboxHistoryEvidence(job.job_id, job.grant.attempt_id);
      const browser = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
      if (!browser.walHistoryVerified) {
        throw executionFailure("failed", "PRODUCTION_LOCAL_AUTHORITY_HISTORY_UNVERIFIED");
      }
      const jobRefHash = sha256(Buffer.from(job.job_id, "utf8"));
      const targetClaimed = state.browserAuthority.readUnreleasedTargetClaims()
        .some((claim) => claim.jobRefHash === jobRefHash);
      if (outbox.rowCount > 0 || browser.rowCount > 0 || targetClaimed
        || remote.staged_result !== null || remote.staged_artifact_receipts.length > 0) {
        state.executor.accept(websiteAgentTaskFromClaim(job), job.grant.attempt_id);
        acceptance.durable = "accepted";
        state.store.setCurrentReason(job.job_id, "LOCAL_AUTHORITY_RECOVERY_PENDING");
        requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
        return;
      }
    }
    const staged = state.store.readTask(job.job_id);
    if (!staged?.staged_result && remote.staged_result === null
      && remote.staged_artifact_receipts.some((receipt) => receipt.role === "result_envelope")) {
      const recovered = state.store.readUploadedResultEnvelope(job.job_id, job.grant.attempt_id);
      if (recovered) {
        const receipts = remote.staged_artifact_receipts.map((artifact) => artifact.receipt_hash);
        const recoveredIntent = buildTerminalProductionIntent(state.session, job, {
          status: "completed", payload_hash: hashCanonical(recovered),
          result_receipt_hashes: receipts,
          terminal_source_first_fact_raw: state.store.readAttemptFailureRaw(job.job_id),
        });
        state.store.markExecuting(job.job_id);
        state.store.stageResultAndEnqueueTerminal({
          jobId: job.job_id, attemptId: job.grant.attempt_id,
          result: recovered, terminal: recoveredIntent.write,
          websiteStagedArtifactReceipts: remote.staged_artifact_receipts,
        });
      }
    }
    if (!staged?.staged_result && remote.staged_result) {
      if (staged?.current_attempt_id !== job.grant.attempt_id
        || !job.grant.same_accepted_attempt) {
        throw executionFailure("failed", "PRODUCTION_WEBSITE_STAGED_RESULT_IDENTITY_MISMATCH");
      }
      const receipts = remote.staged_artifact_receipts.map((artifact) => artifact.receipt_hash);
      const recoveredIntent = buildTerminalProductionIntent(state.session, job, {
        status: "completed", payload_hash: hashCanonical(remote.staged_result),
        result_receipt_hashes: receipts,
        terminal_source_first_fact_raw: state.store.readAttemptFailureRaw(job.job_id),
      });
      state.store.markExecuting(job.job_id);
      state.store.stageResultAndEnqueueTerminal({
        jobId: job.job_id, attemptId: job.grant.attempt_id,
        result: remote.staged_result, terminal: recoveredIntent.write,
        websiteStagedArtifactReceipts: remote.staged_artifact_receipts,
      });
    }
    const durableStaged = state.store.readTask(job.job_id);
    if (durableStaged?.staged_result) {
      if (durableStaged.current_attempt_id !== job.grant.attempt_id
        || !job.grant.same_accepted_attempt) {
        throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_REGRANT_IDENTITY_MISMATCH");
      }
      const intent = buildTerminalProductionIntent(state.session, job, {
        status: "completed", payload_hash: hashCanonical(durableStaged.staged_result),
        result_receipt_hashes: state.store.readStagedTerminalReceipts(
          job.job_id, job.grant.attempt_id, durableStaged.staged_result),
        terminal_source_first_fact_raw: state.store.readAttemptFailureRaw(job.job_id),
      });
      state.store.enqueue(intent.write);
      acceptance.durable = "accepted";
      await deliverTerminalProductionIntent(state.session, state.store, intent);
      state.store.setCurrentReason(job.job_id, "BUSINESS_ADMISSION_PENDING");
      await reconcileBusinessAdmission(state, state.store.readTask(job.job_id)!);
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    const failureReconciliation = await reconcileClaimAttemptFailure(
      state, job, remote, jobSpan.spanId,
    );
    if (failureReconciliation.stopBeforeProduct) {
      requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
      return;
    }
    const claim = acceptClaim(
      state, job, abort, jobSpan, failureReconciliation.reconciledFailure,
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
        state, job, error, jobSpan, failureReconciliation.reconciledFailure !== null,
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
