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
import { serializeTerminalFailureTransport } from "./terminal-failure.js";
import {
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import {
  buildProductionLeaseRelease,
  type BuiltProductionLeaseRelease,
} from "./cloud-client.js";
import {
  readProductionDeviceJobStatus,
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { hashCanonical } from "./contracts.js";
import { ProductionRuntimeBoundaryError } from "./runtime-execution-heartbeat.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import {
  releaseLeaseWithLog,
  terminalSpanFailure,
} from "./runtime-logging.js";
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
import type { AttemptFailureFirstFact, SerializedTerminalFailure } from "./terminal-failure.js";
import type { StoredProductionTask } from "./store.js";


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



const firstFact = (
  failureCore: SerializedTerminalFailure,
  release: BuiltProductionLeaseRelease,
): AttemptFailureFirstFact => Object.freeze({
  failure_core: failureCore,
  release_descriptor: release.descriptor,
});

const remoteFailureCore = (
  remote: NonNullable<RemoteProductionDeviceJobStatus["attempt_failure"]>,
): SerializedTerminalFailure => Object.freeze({
  code: remote.code,
  mutation_outcome: remote.mutation_outcome,
  effect_scope: remote.effect_scope,
  child_capability_id: remote.child_capability_id,
  browser_outcome: remote.browser_outcome,
  evidence_ref: remote.evidence_ref,
  evidence_hash: remote.evidence_hash,
  child_proof_ref: remote.child_proof_ref,
  child_proof_hash: remote.child_proof_hash,
  stopped_empty_proof: remote.stopped_empty_proof,
  cause: remote.cause,
  provider_effect_identity_hash: remote.provider_effect_identity_hash,
  settled_result_payload_hash: remote.settled_result_payload_hash,
});

const releaseReceiptMatches = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
): boolean => {
  const candidates = remote.write_receipts.filter((receipt) =>
    receipt.request_id === failure.release_descriptor.request_id
    && receipt.write_kind === "lease_release");
  if (candidates.length === 0) return false;
  if (candidates.length !== 1) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT");
  }
  const receipt = candidates[0]!;
  if (receipt.payload_hash !== failure.release_descriptor.write_request_payload_hash) return false;
  const response = receipt.response_json;
  const expectedReason = failure.failure_core.code === "RESULT_SETTLED_UNUSABLE"
    || failure.failure_core.code === "GPT_RESPONSE_STOPPED_EMPTY"
    ? "RESULT_REVISION_REJECTED"
    : failure.failure_core.effect_scope === "provider_effect"
      && ["dispatched", "confirmed"].includes(failure.failure_core.mutation_outcome)
      ? "PROVIDER_EFFECT_READBACK_PENDING"
      : failure.failure_core.code;
  return JSON.stringify(Object.keys(response).sort()) === JSON.stringify([
    "attempt_failure", "job_id", "lease_disposition", "payload_hash", "reason_code",
    "schema_version", "task_status", "terminal_payload_hash",
  ])
    && response.schema_version === "xuanxue-ai-lease-release-receipt.v6"
    && response.job_id === remote.job_id
    && response.task_status === "failed"
    && response.lease_disposition === "released"
    && response.reason_code === expectedReason
    && response.payload_hash === failure.release_descriptor.body_payload_hash
    && response.terminal_payload_hash === null
    && hashCanonical(response.attempt_failure) === hashCanonical(failure.failure_core);
};

const remoteFailureMatches = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
): boolean => Boolean(remote.attempt_failure
  && remote.attempt_failure.from_status === "failed"
  && remote.attempt_failure.to_status === "failed"
  && remote.attempt_failure.attempt_id === failure.release_descriptor.attempt_id
  && remote.attempt_failure.lease_version === failure.release_descriptor.lease_version
  && hashCanonical(remoteFailureCore(remote.attempt_failure)) === hashCanonical(failure.failure_core));

const attemptFailureAuthorityConflict = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
) => {
  const remoteHash = hashCanonical(remoteFailureCore(remote.attempt_failure!));
  const localHash = hashCanonical(failure.failure_core);
  const evidenceRef = ["attempt-failure-authority-conflict", remote.job_id,
    failure.release_descriptor.attempt_id, String(failure.release_descriptor.lease_version),
    remote.attempt_failure!.attempt_id, String(remote.attempt_failure!.lease_version),
    failure.release_descriptor.request_id, localHash, remoteHash].join("|");
  return executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT", {
    metadata: { mutationOutcome: "no", evidence: {
      evidenceRef,
      evidenceHash: hashCanonical({ evidenceRef }),
    } },
  });
};

const failureAllowsNewAttempt = (failure: SerializedTerminalFailure): boolean =>
  failure.code === "RESULT_SETTLED_UNUSABLE" || failure.code === "GPT_RESPONSE_STOPPED_EMPTY"
  || (failure.effect_scope === "target_local" && failure.browser_outcome === "REJECTED")
  || (failure.effect_scope === "provider_effect" && failure.browser_outcome === "REJECTED"
    && failure.mutation_outcome === "no");

const assertAttemptFailureReadback = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
  releaseOutcome: "response_received" | "response_unknown" | "conflict_409",
): void => {
  if (remote.attempt_failure && !remoteFailureMatches(remote, failure)) {
    throw attemptFailureAuthorityConflict(remote, failure);
  }
  if (releaseOutcome === "conflict_409") {
    if (!remoteFailureMatches(remote, failure)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_CONFLICT_RESPONSE_INVALID");
  }
  if (!releaseReceiptMatches(remote, failure)) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
  }
};

const postFailureAndReadback = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  release: BuiltProductionLeaseRelease,
  failure: AttemptFailureFirstFact,
  parentSpanId: string,
  causeEventId: string,
): Promise<RemoteProductionDeviceJobStatus> => {
  let releaseError: unknown = null;
  try {
    await releaseLeaseWithLog(state, job, parentSpanId, release, causeEventId);
  } catch (error) {
    releaseError = error;
  }
  try {
    const remote = await readProductionDeviceJobStatus(state.session, job.job_id);
    const releaseOutcome = releaseError === null ? "response_received"
      : failureCode(releaseError) === "AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT"
        ? "conflict_409" : "response_unknown";
    assertAttemptFailureReadback(remote, failure, releaseOutcome);
    return remote;
  } catch (readbackError) {
    if (releaseError) {
      const metadata = executionFailureMetadata(readbackError);
      throw executionFailure(
        "failed",
        failureCode(readbackError, "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_FAILED"),
        { cause: new AggregateError(
          [releaseError, readbackError], "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_FAILED",
        ), ...(metadata ? { metadata } : {}) },
      );
    }
    throw readbackError;
  }
};

const applyRemoteFailureDisposition = async (
  state: RuntimeState,
  task: StoredProductionTask,
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
): Promise<void> => {
  if (remote.next_action_code === "WAIT_NEW_ATTEMPT") {
    const permanentRevocation = remote.current_reason?.code === "PRIVACY_SUBJECT_CLOSED";
    await state.browserAuthority.releaseJobBoundTarget(
      task.task.job_id,
      permanentRevocation ? "website-permanent-revocation" : "wait-new-attempt",
      state.abort.signal,
    );
    state.store.releaseAttemptForWebsiteDecision(task.task.job_id, task.current_attempt_id);
    return;
  }
  if (remote.next_action_code === "CONSUME_CURRENT_RESULT") {
    if (!task.staged_result) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RESULT_AUTHORITY_MISSING");
    }
    state.store.clearAttemptFailureForCurrentResult(task.task.job_id, failure);
    await reconcileBusinessAdmission(state, state.store.readTask(task.task.job_id)!);
  }
};

export const reconcilePendingAttemptFailures = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.pendingAttemptFailures()) {
    const failure = task.attempt_failure!;
    let remote: RemoteProductionDeviceJobStatus;
    try {
      remote = await readProductionDeviceJobStatus(state.session, task.task.job_id);
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
      await purgeDeletedJob(state, task.task.job_id);
      continue;
    }
    if (remote.attempt_failure && !remoteFailureMatches(remote, failure)) {
      const conflict = attemptFailureAuthorityConflict(remote, failure);
      const evidence = executionFailureMetadata(conflict)?.evidence;
      state.store.setCurrentReason(task.task.job_id, [conflict.code,
        evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
      continue;
    }
    if (!releaseReceiptMatches(remote, failure) && !remoteFailureMatches(remote, failure)) {
      continue;
    }
    if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
      || remote.next_action_code === "CONSUME_CURRENT_RESULT") {
      if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
        && remote.current_reason?.code !== "PRIVACY_SUBJECT_CLOSED"
        && state.browserAuthority.hasUnresolvedBrowserMutation()) {
        continue;
      }
      await applyRemoteFailureDisposition(state, task, remote, failure);
      continue;
    }
    if (remote.next_action_code !== "ACTIVE_ATTEMPT"
      || failureAllowsNewAttempt(failure.failure_core)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_NEXT_ACTION_MISMATCH");
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
    await applyRemoteFailureDisposition(state, persisted, remote, localFailure);
  } catch (readbackError) {
    const code = failureCode(readbackError, "ATTEMPT_RELEASE_READBACK_FAILED");
    const evidence = executionFailureMetadata(readbackError)?.evidence;
    state.store.setCurrentReason(job.job_id,
      [code, evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
    state.lastErrorCode = code;
    state.lastErrorReason = safeReason(readbackError);
  }
};


const websiteAuthorizedNewAttempt = (
  local: StoredProductionTask,
  failure: AttemptFailureFirstFact,
  job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus,
): boolean => local.current_reason === "WAIT_NEW_ATTEMPT"
  && local.current_attempt_id !== job.grant.attempt_id
  && failure.release_descriptor.attempt_id === local.current_attempt_id
  && failureAllowsNewAttempt(failure.failure_core)
  && remote.attempt_failure === null
  && remote.next_action_code === "ACTIVE_ATTEMPT";

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
  const failure = local?.attempt_failure ?? null;
  if (!failure) return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false });
  if (websiteAuthorizedNewAttempt(local!, failure, job, remote)) {
    return Object.freeze({ reconciledFailure: failure, stopBeforeProduct: false });
  }
  if (local!.current_reason === "WAIT_NEW_ATTEMPT") {
    throw executionFailure("failed", "PRODUCTION_WAIT_NEW_ATTEMPT_AUTHORITY_CONFLICT");
  }
  if (local!.current_attempt_id !== job.grant.attempt_id
    || failure.release_descriptor.attempt_id !== job.grant.attempt_id) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_MISSING");
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
    await applyRemoteFailureDisposition(state, state.store.readTask(job.job_id)!, reconciled, rebound);
    return Object.freeze({ reconciledFailure: rebound, stopBeforeProduct: true });
  }
  if (remote.next_action_code !== "ACTIVE_ATTEMPT") {
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_NEXT_ACTION_INVALID");
  }
  const sameAttempt = local!.current_attempt_id === job.grant.attempt_id;
  if (sameAttempt === failureAllowsNewAttempt(failure.failure_core)) {
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_IDENTITY_INVALID");
  }
  return Object.freeze({ reconciledFailure: effectiveFailure, stopBeforeProduct: false });
};


const handleProductExecutionFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  jobSpan: RuntimeSpanHandle,
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
  terminalSpanFailure(
    jobSpan, error, runtimeLogCauseEventId(error), "JOB_EXECUTION_FAILED",
    browserAuthority ?? undefined,
    browserAuthority ? "browser-session" : undefined,
  );
  if (code === "BROWSER_GPT_DIALOG_UNRECOGNIZED" && mismatchAuthority) {
    state.store.setCurrentReason(job.job_id, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
    return;
  }
  let cooldownGateClosed = false;
  if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT" && rateLimitAuthority) {
    try {
      state.providerRateLimitControl.assertProviderSubmitAllowed();
    } catch (gateError) {
      cooldownGateClosed = failureCode(gateError) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE";
    }
  }
  if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT" && rateLimitAuthority && cooldownGateClosed) {
    state.store.setCurrentReason(job.job_id, [
      "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE",
      rateLimitAuthority.authorityRef,
      rateLimitAuthority.authorityHash,
    ].join("|"));
    return;
  }
  await persistAttemptFailure(state, job, error, jobSpan.spanId);
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
      await handleProductExecutionFailure(state, job, error, jobSpan);
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
