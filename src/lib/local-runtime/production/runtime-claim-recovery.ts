import { executionFailure, executionFailureMetadata } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { buildProductionLeaseRelease } from "./cloud-client.js";
import { classifyAttemptFailure } from "./terminal-failure.js";
import { attemptFailureAuthorityConflict, firstFact, postFailureAndReadback,
  releaseReceiptMatches, remoteFailureMatches } from "./runtime-attempt-failure-readback.js";
import type { RuntimeState } from "./runtime-state.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import type { RemoteProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import type { AttemptFailureFirstFact } from "./terminal-failure.js";
import type { StoredProductionTask } from "./store.js";

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

const authorizedHistoricalEffects = (
  state: RuntimeState, job: ClaimedProductionTask,
  history: ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>,
): boolean => {
  const historical = history.replayEffects.filter((effect) =>
    effect.attemptId !== job.grant.attempt_id
    || effect.resultRevision !== job.grant.result_revision);
  if (historical.length === 0) return true;
  if (historical.some((effect) => effect.resultRevision >= job.grant.result_revision)) return false;
  if (job.grant.prior_result_rejection !== null) {
    return state.store.readIssuedSourceHandoffForAttempt(
      job.job_id, job.grant.attempt_id,
    )?.kind === "attempt_handoff";
  }
  const replay = job.grant.delivery_priority_replay_grant;
  if (!replay) return false;
  const source = state.store.readIssuedSourceHandoff(
    job.job_id, job.grant.attempt_id, replay.source_seal_hash,
  );
  const proved = new Set(source?.readback_proofs.flatMap((proof) =>
    proof.effects.map((effect) => `${effect.effect_identity_hash}:${effect.source_effect_set_hash}:${effect.wal_authority_hash}`)) ?? []);
  return source?.kind === "delivery_priority_replay"
    && historical.every((effect) => proved.has(`${effect.effectIdentityHash}:${effect.sourceEffectSetHash}:${effect.walAuthorityHash}`));
};

const provenZeroInputCallMatches = (
  state: RuntimeState, job: ClaimedProductionTask, failure: AttemptFailureFirstFact,
  replay: NonNullable<ClaimedProductionTask["grant"]["delivery_priority_replay_grant"]>,
): boolean => {
  const core = failure.failure_core;
  const original = core.evidence_ref && core.evidence_hash && core.provider_effect_identity_hash
    ? state.browserAuthority.readProvenZeroInputProviderCommand({
      authorityRef: core.evidence_ref, authorityHash: core.evidence_hash,
      jobId: job.job_id, attemptId: job.grant.attempt_id,
      resultRevision: job.grant.result_revision,
      effectIdentityHash: core.provider_effect_identity_hash,
    }) : null;
  return !!original && replay.calls.filter((call) =>
    call.product_step_id === original.productStepId && call.call_id === original.callId
    && call.child_capability_id === original.childCapabilityId
    && call.call_grant_hash === original.grantHash).length === 1;
};

const providerFailureHadZeroInput = (failure: AttemptFailureFirstFact): boolean => {
  const core = failure.failure_core;
  return core.effect_scope === "provider_effect" && core.browser_outcome === "REJECTED"
    && core.mutation_outcome === "no" && core.provider_effect_identity_hash !== null;
};

const canResumeRiskGrantAfterZeroInputFailure = async (
  state: RuntimeState, job: ClaimedProductionTask,
  failure: AttemptFailureFirstFact,
): Promise<boolean> => {
  const replay = job.grant.delivery_priority_replay_grant;
  const core = failure.failure_core;
  const providerNoInput = providerFailureHadZeroInput(failure);
  if (!job.grant.same_accepted_attempt || !replay
    || core.effect_scope !== "target_local" && !providerNoInput
    || state.browserAuthority.readAttemptPhysicalInputState(
      job.job_id, job.grant.attempt_id,
    ) !== "zero") return false;
  if (providerNoInput && !provenZeroInputCallMatches(state, job, failure, replay)) return false;
  const source = state.store.readIssuedSourceHandoff(
    job.job_id, job.grant.attempt_id, replay.source_seal_hash,
  );
  if (source?.kind !== "delivery_priority_replay") return false;
  const before = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  if (!before.walHistoryVerified || before.replayEffects.some((effect) =>
    effect.attemptId === job.grant.attempt_id)) return false;
  const after = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  return after.walHistoryVerified && after.unresolvedCommandCount === 0
    && after.unresolvedCommandSetHash === hashCanonical([])
    && authorizedHistoricalEffects(state, job, after);
};

const bindRecordedFailureToRemote = async (
  state: RuntimeState, job: ClaimedProductionTask, remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact, parentSpanId: string,
  applyRemoteFailureDisposition: (state: RuntimeState, task: StoredProductionTask,
    remote: RemoteProductionDeviceJobStatus) => Promise<void>,
): Promise<Readonly<{ effectiveFailure: AttemptFailureFirstFact; stopBeforeProduct: boolean }>> => {
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
      ? failure : state.store.rebindAttemptFailureReleaseDescriptor(
        job.job_id, failure, claimBoundFailure,
      ).attempt_failure!;
    const reconciled = await postFailureAndReadback(
      state, job, claimRelease, rebound, parentSpanId, parentSpanId,
    );
    await applyRemoteFailureDisposition(state, state.store.readTask(job.job_id)!, reconciled);
    return Object.freeze({ effectiveFailure: rebound, stopBeforeProduct: true });
  }
  return Object.freeze({ effectiveFailure, stopBeforeProduct: false });
};

/** The grant carries the exact typed seal of the local source attempt and awaits only the issued-attempt switch. */
const grantAwaitsSourceSwitch = (
  state: RuntimeState, job: ClaimedProductionTask,
  local: StoredProductionTask | null, remote: RemoteProductionDeviceJobStatus,
): boolean => {
  if (job.grant.source_handoff_seal_hash === null || !local?.current_attempt_id) return false;
  return state.store.readSealedSourceHandoff(job.job_id, local.current_attempt_id)?.seal_hash
    === job.grant.source_handoff_seal_hash
    && local.current_attempt_id !== job.grant.attempt_id && remote.attempt_failure === null;
};

export const reconcileClaimAttemptFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus,
  parentSpanId: string,
  applyRemoteFailureDisposition: (state: RuntimeState, task: StoredProductionTask,
    remote: RemoteProductionDeviceJobStatus) => Promise<void>,
): Promise<Readonly<{
  reconciledFailure: AttemptFailureFirstFact | null;
  stopBeforeProduct: boolean;
  readbackOnlyCalls: readonly Readonly<{ productStepId: string; callId: string;
    childCapabilityId: "submit_exact_gpt_turn_once" }>[] | null;
}>> => {
  const local = state.store.readTask(job.job_id);
  if (grantAwaitsSourceSwitch(state, job, local, remote)) {
    return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false,
      readbackOnlyCalls: null });
  }
  const failure = local?.attempt_failure ?? null;
  if (!failure) {
    if (state.store.readAttemptFailureRaw(job.job_id) !== null) {
      throw executionFailure("failed", "PRODUCTION_FIRST_FACT_OPAQUE_RECONCILIATION_REQUIRED");
    }
    assertAbsentLocalFailureAuthority(local ?? null, job, remote);
    return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false,
      readbackOnlyCalls: null });
  }
  if (assertLocalClaimFailureAuthority(local!, failure, job)) {
    return Object.freeze({ reconciledFailure: failure, stopBeforeProduct: false,
      readbackOnlyCalls: null });
  }
  const { effectiveFailure, stopBeforeProduct } = await bindRecordedFailureToRemote(
    state, job, remote, failure, parentSpanId, applyRemoteFailureDisposition,
  );
  if (stopBeforeProduct) return Object.freeze({ reconciledFailure: effectiveFailure,
    stopBeforeProduct: true, readbackOnlyCalls: null });
  if (remote.next_action_code !== "ACTIVE_ATTEMPT") {
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_NEXT_ACTION_INVALID");
  }
  const sameAttempt = local!.current_attempt_id === job.grant.attempt_id;
  const disposition = classifyAttemptFailure(effectiveFailure.failure_core);
  if (sameAttempt && await canResumeRiskGrantAfterZeroInputFailure(
    state, job, effectiveFailure,
  )) {
    return Object.freeze({ reconciledFailure: effectiveFailure, stopBeforeProduct: false,
      readbackOnlyCalls: null });
  }
  if (disposition === "fail_closed") {
    throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
  }
  if ((disposition === "same_attempt_provider_readback") !== sameAttempt)
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_IDENTITY_INVALID");
  return Object.freeze({ reconciledFailure: effectiveFailure, stopBeforeProduct: false,
    readbackOnlyCalls: null });
};
