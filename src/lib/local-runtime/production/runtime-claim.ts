import { join } from "node:path";

import {
  executionFailure,
  executionFailureMetadata,
  failureCode,
  typedExecutionFailure,
} from "../../execution-failure.js";
import {
  serializeTerminalFailureTransport,
  terminalFailureHttpStatus,
} from "./terminal-failure.js";
import {
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import {
  buildProductionLeaseRelease,
  downloadProductionMaterials,
  terminalProductionTask,
  uploadProductionGeneratedImage,
  uploadProductionResult,
  type BuiltProductionLeaseRelease,
} from "./cloud-client.js";
import {
  readProductionDeviceJobStatus,
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { hashCanonical, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionExecutionLease } from "./contracts.js";
import {
  heartbeatWhileRunning,
  ProductionRuntimeBoundaryError,
} from "./runtime-execution-heartbeat.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";
import {
  releaseLeaseWithLog,
  runRuntimeSpan,
  runRuntimeSpanSync,
  terminalSpanFailure,
} from "./runtime-logging.js";
import {
  jobIdentity,
  leaseBudget,
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

const isResultTransportBoundary = (error: unknown): boolean => {
  const typed = typedExecutionFailure(error);
  const httpStatus = terminalFailureHttpStatus(error);
  const code = typed?.code ?? "";
  return code === "CLOUD_TRANSPORT_UNAVAILABLE"
    || code === "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE"
    || code === "AI_LEASE_FENCE_STALE" || code === "AI_V6_LEASE_RACE"
    || websiteJobAbsent(error)
    || code.startsWith("PRODUCTION_REMOTE_RECEIPT_")
    || code.startsWith("PRODUCTION_OUTBOX_")
    || (httpStatus !== null && httpStatus >= 500);
};

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


const releaseUnacceptedClaim = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  spanId: string,
  causeEventId: string,
): Promise<void> => {
  const release = buildProductionLeaseRelease(state.session, job, {
      reasonCode: failureCode(error).startsWith("V6_DEADLINE_")
        ? "LEASE_SAFETY_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
      attemptFailure: null,
    });
  await releaseLeaseWithLog(state, job, spanId, release, causeEventId);
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

const assertClaimIdentity = (job: ClaimedProductionTask): void => {
  if (job.grant.capability_manifest_hash !== productionCatalogHash) {
    throw executionFailure("failed", "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT");
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
  const failure = local?.attempt_failure ?? null;
  if (!failure) return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false });
  const websiteGrantedNewAttempt = local!.current_reason === "WAIT_NEW_ATTEMPT"
    && local!.current_attempt_id !== job.grant.attempt_id
    && failure.release_descriptor.attempt_id === local!.current_attempt_id
    && failureAllowsNewAttempt(failure.failure_core)
    && remote.attempt_failure === null
    && remote.next_action_code === "ACTIVE_ATTEMPT";
  if (websiteGrantedNewAttempt) {
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
  if (remote.attempt_failure && !remoteMatchesClaim && !remoteMatchesFirstFact) {
    const conflict = attemptFailureAuthorityConflict(remote, claimBoundFailure);
    const evidence = executionFailureMetadata(conflict)?.evidence;
    state.store.setCurrentReason(job.job_id, [conflict.code,
      evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
    throw conflict;
  }
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

const acceptClaim = (
  state: RuntimeState,
  job: ClaimedProductionTask,
  abort: AbortController,
  jobSpan: RuntimeSpanHandle,
  reconciledFailure: AttemptFailureFirstFact | null,
) => {
  const task = websiteAgentTaskFromClaim(job);
  assertClaimIdentity(job);
  const budget = leaseBudget(job, abort);
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-store", operation: "job.durable-accept", typedIdentity: jobIdentity(job),
  }));
  const record = runRuntimeSpanSync({
    span,
    action: () => reconciledFailure
      ? state.executor.acceptAfterFailureReconciled(task, job.grant.attempt_id, reconciledFailure)
      : state.executor.accept(task, job.grant.attempt_id),
    failureCode: "DURABLE_ACCEPT_FAILED",
    success: (accepted) => ({
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(accepted),
    }),
  });
  if (record.status !== "failed") {
    throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
  }
  return { task, budget, record };
};

const downloadClaimMaterials = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  materialDir: string,
  jobSpan: RuntimeSpanHandle,
) => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-materials", operation: "material.download-verify", typedIdentity: jobIdentity(job),
  }));
  return runRuntimeSpan({
    span, failureCode: "MATERIAL_DOWNLOAD_VERIFY_FAILED",
    action: () => downloadProductionMaterials(state.session, job, materialDir),
  });
};

const handleRuntimeBoundaryFailure = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  durability: "unknown" | "unaccepted" | "accepted";
  error: unknown;
  parentSpanId: string;
  causeEventId: string;
}>): Promise<void> => {
  const current = input.state.store.readTask(input.job.job_id);
  if (current?.status === "failed" && current.current_attempt_id === input.job.grant.attempt_id) {
    const evidence = executionFailureMetadata(input.error)?.evidence;
    input.state.store.setCurrentReason(
      input.job.job_id,
      [failureCode(input.error, "PRODUCTION_RUNTIME_BOUNDARY_FAILED"),
        evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"),
    );
  }
  if (input.durability !== "unaccepted" || current?.attempt_failure) return;
  try {
    await releaseUnacceptedClaim(
      input.state, input.job, input.error, input.parentSpanId, input.causeEventId,
    );
  } catch (releaseError) {
    input.state.lastErrorCode = failureCode(releaseError, "LEASE_RELEASE_FAILED");
    input.state.lastErrorReason = safeReason(releaseError);
  }
};

const executeAndUpload = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  task: WebsiteAgentTask;
  budget: ProductionExecutionLease;
  materials: Awaited<ReturnType<typeof downloadProductionMaterials>>;
  abort: AbortController;
  jobSpan: RuntimeSpanHandle;
}>) => {
  let uploaded: Awaited<ReturnType<typeof uploadProductionResult>> | undefined;
  let uploadBoundaryFailure: unknown | undefined;
  const generatedImageReceipts: Awaited<ReturnType<typeof uploadProductionGeneratedImage>>["transportReceipt"][] = [];
  let execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
  try {
    execution = await heartbeatWhileRunning({
      state: input.state, job: input.job, budget: input.budget,
      execution: input.state.executor.execute(input.task, input.materials, input.budget, input.jobSpan.spanId,
        async (output) => {
        const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
          traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, owner: "production-runtime",
          component: "production-result", operation: "result.upload", typedIdentity: jobIdentity(input.job),
        }));
        try {
          uploaded = await runRuntimeSpan({
            span, failureCode: "RESULT_UPLOAD_FAILED", action: () => uploadProductionResult({
              session: input.state.session, store: input.state.store, job: input.job,
              output,
              priorArtifactReceipts: generatedImageReceipts,
            }),
          });
        } catch (error) {
          if (isResultTransportBoundary(error)) uploadBoundaryFailure = error;
          throw error;
        }
        return uploaded.envelope;
        },
        async (artifact) => {
          const uploadedImage = await uploadProductionGeneratedImage(
            input.state.session, input.state.store, input.job, artifact,
          );
          generatedImageReceipts.push(uploadedImage.transportReceipt);
          return uploadedImage.receipt;
        }),
      abort: input.abort, parentSpanId: input.jobSpan.spanId,
    });
  } catch (error) {
    if (uploadBoundaryFailure !== undefined) {
      throw new ProductionRuntimeBoundaryError(uploadBoundaryFailure);
    }
    throw error;
  }
  if (!uploaded) throw new Error("PLUGIN_RESULT_UPLOAD_MISSING");
  return { execution, uploaded };
};

const providerEffectProofHashMatches = (
  proof: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>["providerEffectReadbackProof"],
): boolean => {
  if (!proof) return false;
  const { proof_hash: proofHash, ...proofBody } = proof;
  return hashCanonical(proofBody) === proofHash;
};

export const stageCompletedClaimResult = (input: Readonly<{
  store: RuntimeState["store"];
  job: ClaimedProductionTask;
  execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
}>): void => {
  const pendingFailure = input.store.readTask(input.job.job_id)?.attempt_failure ?? null;
  if (pendingFailure) {
    const proof = input.execution.providerEffectReadbackProof;
    if (!proof || proof.schema_version !== "provider-effect-readback-proof.v1"
      || !providerEffectProofHashMatches(proof)
      || proof.job_id !== input.job.job_id
      || proof.attempt_id !== input.job.grant.attempt_id
      || proof.result_revision !== input.job.grant.result_revision
      || proof.provider_effect_identity_hash
        !== pendingFailure.failure_core.provider_effect_identity_hash
      || proof.browser_authority_ref !== pendingFailure.failure_core.evidence_ref
      || proof.browser_authority_hash !== pendingFailure.failure_core.evidence_hash
      || pendingFailure.failure_core.effect_scope !== "provider_effect"
      || !["dispatched", "confirmed"].includes(pendingFailure.failure_core.mutation_outcome)
      || proof.readback_provider_input_delta !== 0) {
      throw executionFailure("failed", "PROVIDER_EFFECT_READBACK_PROOF_INVALID");
    }
    input.store.stageResultAfterProviderEffectReadback(
      input.job.job_id, input.execution.result, pendingFailure,
    );
    return;
  }
  input.store.stageResult(input.job.job_id, input.execution.result);
};

const completeClaim = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
  uploaded: Awaited<ReturnType<typeof uploadProductionResult>>;
  materialDir: string;
  jobSpan: RuntimeSpanHandle;
}>): Promise<void> => {
  const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
    traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, boundaryId: input.job.grant.claim_batch_id,
    owner: "production-runtime", component: "production-runtime", operation: "job.terminal",
    typedIdentity: jobIdentity(input.job),
  }));
  const payloadHash = hashCanonical(input.execution.result);
  stageCompletedClaimResult({ store: input.state.store, job: input.job, execution: input.execution });
  await runRuntimeSpan({
    span, failureCode: "JOB_TERMINAL_FAILED", action: async () => {
      await terminalProductionTask(input.state.session, input.state.store, input.job, {
        status: "completed", payload_hash: payloadHash,
        result_receipt_hashes: input.uploaded.artifact_receipts.map((receipt) => receipt.receipt_hash),
      });
      input.state.store.setCurrentReason(input.job.job_id, "BUSINESS_ADMISSION_PENDING");
      return input.state.store.readTask(input.job.job_id)!;
    },
    success: (record) => ({
      authorityRef: `production-task:${input.job.job_id}`, authorityHash: hashCanonical(record),
    }),
  });
  const record = input.state.store.readTask(input.job.job_id)!;
  await reconcileBusinessAdmission(input.state, record);
  const current = input.state.store.readTask(input.job.job_id)!;
  requireRuntimeLogWrite(input.jobSpan.terminal({
    outcome: "succeeded", authorityRef: `production-task:${input.job.job_id}`,
    authorityHash: hashCanonical(current),
  }));
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
