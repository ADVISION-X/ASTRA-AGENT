import { executionFailure, executionFailureMetadata } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { buildProductionLeaseRelease } from "./cloud-client.js";
import { classifyAttemptFailure, type AttemptFailureFirstFact } from "./terminal-failure.js";
import { attemptFailureAuthorityConflict, firstFact, postFailureAndReadback,
  releaseReceiptMatches, remoteFailureMatches } from "./runtime-attempt-failure-readback.js";
import { historicalEffectsSettled, sourceReadbackProofs } from "./runtime-source-readback-proofs.js";
import type { RuntimeState } from "./runtime-state.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import type { RemoteProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import type { StoredProductionTask } from "./store.js";

type RemoteDisposition = (state: RuntimeState, task: StoredProductionTask,
  remote: RemoteProductionDeviceJobStatus) => Promise<void>;
type Recovery = Readonly<{
  reconciledFailure: AttemptFailureFirstFact | null; stopBeforeProduct: boolean;
  readbackOnlyCalls: readonly Readonly<{ productStepId: string; callId: string;
    childCapabilityId: "submit_exact_gpt_turn_once"; source?: Readonly<{ sourceAttemptId: string; sourceResultRevision: number; effectIdentityHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}` }> }>[] | null;
}>;

function grantAwaitsSourceSwitch(state: RuntimeState, job: ClaimedProductionTask,
  local: StoredProductionTask | null, remote: RemoteProductionDeviceJobStatus): boolean {
  return job.grant.source_handoff_seal_hash !== null && !!local?.current_attempt_id
    && local.current_attempt_id !== job.grant.attempt_id && remote.attempt_failure === null
    && state.store.readSealedSourceHandoff(job.job_id, local.current_attempt_id)?.seal_hash
      === job.grant.source_handoff_seal_hash;
}

function assertLocalFailureAuthority(local: StoredProductionTask | null, job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus): void {
  const failure = local?.attempt_failure;
  if (failure) {
    if (local!.current_attempt_id !== job.grant.attempt_id
      || failure.release_descriptor.attempt_id !== job.grant.attempt_id) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_MISSING");
    }
  } else {
    if (remote.attempt_failure) throw executionFailure("failed", "PRODUCTION_REMOTE_ATTEMPT_FAILURE_LOCAL_AUTHORITY_MISSING");
    if (job.grant.same_accepted_attempt && local && local.current_attempt_id !== job.grant.attempt_id) {
      throw executionFailure("failed", "PRODUCTION_REGRANTED_ATTEMPT_LOCAL_AUTHORITY_MISSING");
    }
  }
}

async function reconcileRelease(state: RuntimeState, job: ClaimedProductionTask,
  remote: RemoteProductionDeviceJobStatus, failure: AttemptFailureFirstFact,
  parentSpanId: string, applyDisposition: RemoteDisposition): Promise<Recovery> {
  const release = buildProductionLeaseRelease(state.session, job, {
    reasonCode: "ATTEMPT_FAILED", attemptFailure: failure.failure_core,
  });
  const current = firstFact(failure.failure_core, release);
  const matchesCurrent = remoteFailureMatches(remote, current);
  const matchesOriginal = remoteFailureMatches(remote, failure);
  if (remote.attempt_failure && !matchesCurrent && !matchesOriginal) {
    const conflict = attemptFailureAuthorityConflict(remote, current);
    const evidence = executionFailureMetadata(conflict)?.evidence;
    state.store.setCurrentReason(job.job_id,
      [conflict.code, evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"));
    throw conflict;
  }
  const acknowledged = releaseReceiptMatches(remote, failure) || matchesCurrent || matchesOriginal;
  const needsRebind = hashCanonical(current) !== hashCanonical(failure) && (matchesCurrent || !acknowledged);
  const effective = needsRebind
    ? state.store.rebindAttemptFailureReleaseDescriptor(job.job_id, failure, current).attempt_failure!
    : failure;
  if (!acknowledged) {
    const readback = await postFailureAndReadback(state, job, release, effective, parentSpanId, parentSpanId);
    await applyDisposition(state, state.store.readTask(job.job_id)!, readback);
  }
  return Object.freeze({ reconciledFailure: effective, stopBeforeProduct: !acknowledged, readbackOnlyCalls: null });
}

function provenZeroInputCallMatches(state: RuntimeState, job: ClaimedProductionTask,
  failure: AttemptFailureFirstFact,
  replay: NonNullable<ClaimedProductionTask["grant"]["delivery_priority_replay_grant"]>): boolean {
  const core = failure.failure_core;
  if (!core.evidence_ref || !core.evidence_hash || !core.provider_effect_identity_hash) return false;
  const fact = state.browserAuthority.readProvenZeroInputProviderCommand({
    authorityRef: core.evidence_ref, authorityHash: core.evidence_hash,
    jobId: job.job_id, attemptId: job.grant.attempt_id, resultRevision: job.grant.result_revision,
    effectIdentityHash: core.provider_effect_identity_hash,
  });
  return !!fact && replay.calls.filter(call => call.product_step_id === fact.productStepId
    && call.call_id === fact.callId && call.child_capability_id === fact.childCapabilityId
    && call.call_grant_hash === fact.grantHash).length === 1;
}

function canResumeRiskGrantAfterZeroInputFailure(
  state: RuntimeState, job: ClaimedProductionTask, failure: AttemptFailureFirstFact,
): boolean {
  const grant = job.grant.delivery_priority_replay_grant;
  if (!job.grant.same_accepted_attempt || !grant
    || state.browserAuthority.readAttemptPhysicalInputState(job.job_id, job.grant.attempt_id) !== "zero") return false;
  const core = failure.failure_core;
  const completeProviderZero = core.effect_scope === "provider_effect" && core.browser_outcome === "REJECTED"
    && core.mutation_outcome === "no" && core.provider_effect_identity_hash !== null;
  if (completeProviderZero && !provenZeroInputCallMatches(state, job, failure, grant)) return false;
  const before = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  if (!before.walHistoryVerified
    || before.replayEffects.some(effect => effect.attemptId === job.grant.attempt_id)) return false;
  const source = state.store.readIssuedSourceHandoff(job.job_id, job.grant.attempt_id, grant.source_seal_hash);
  if (source?.kind !== "delivery_priority_replay") return false;
  const settlements = state.store.readAcceptedSourceSettlements(job.job_id);
  const settled = historicalEffectsSettled(before.replayEffects, settlements, job.grant.attempt_id);
  const after = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  return settled && hashCanonical(after) === hashCanonical(before)
    && state.browserAuthority.readAttemptPhysicalInputState(job.job_id, job.grant.attempt_id) === "zero";
}

function changedRiskSourceReadbacks(state: RuntimeState, job: ClaimedProductionTask): Recovery["readbackOnlyCalls"] {
  const grant = job.grant.delivery_priority_replay_grant;
  if (!job.grant.same_accepted_attempt || !grant
    || state.browserAuthority.readAttemptPhysicalInputState(job.job_id, job.grant.attempt_id) !== "zero") return null;
  const source = state.store.readIssuedSourceHandoff(job.job_id, job.grant.attempt_id, grant.source_seal_hash);
  const before = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  if (source?.kind !== "delivery_priority_replay" || source.source_attempt_id !== grant.source_attempt_id
    || !before.walHistoryVerified || before.historyHash === source.browser_history_hash) return null;
  const observations = state.store.readSourceReadbackObservations(job.job_id, job.grant.attempt_id);
  const settled = state.store.readAcceptedSourceSettlements(job.job_id);
  const calls: NonNullable<Recovery["readbackOnlyCalls"]>[number][] = [];
  for (const call of before.replayCalls) {
    if (call.childCapabilityId !== "submit_exact_gpt_turn_once") continue;
    const authorized = source.readback_proofs.find((proof) => proof.product_step_id === call.productStepId
      && proof.call_id === call.callId && proof.child_capability_id === call.childCapabilityId);
    if (!authorized) continue;
    const effects = before.replayEffects.filter((effect) => effect.attemptId !== job.grant.attempt_id
      && effect.productStepId === call.productStepId && effect.callId === call.callId
      && effect.childCapabilityId === call.childCapabilityId
      && authorized.effects.some((old) => old.effect_identity_hash === effect.effectIdentityHash)
      && effect.anchorState === "trusted" && effect.state === "CONFIRMED"
      && effect.mutationOutcome === "confirmed" && effect.physicalInputCount === 1
      && sourceReadbackProofs({ ...before, replayCalls: [call], replayEffects: [effect] }, observations, settled) === null);
    const effect = effects[0];
    if (effect) calls.push(Object.freeze({ productStepId: call.productStepId, callId: call.callId,
      childCapabilityId: "submit_exact_gpt_turn_once", source: Object.freeze({
        sourceAttemptId: effect.attemptId, sourceResultRevision: effect.resultRevision,
        effectIdentityHash: effect.effectIdentityHash, walAuthorityHash: effect.walAuthorityHash }) }));
  }
  if (hashCanonical(state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id)) !== hashCanonical(before)
    || state.browserAuthority.readAttemptPhysicalInputState(job.job_id, job.grant.attempt_id) !== "zero") {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_AMBIGUOUS");
  }
  return calls.length ? Object.freeze(calls) : null;
}

export const reconcileClaimAttemptFailure = async (
  state: RuntimeState, job: ClaimedProductionTask, remote: RemoteProductionDeviceJobStatus,
  parentSpanId: string, applyRemoteFailureDisposition: RemoteDisposition,
): Promise<Recovery> => {
  const local = state.store.readTask(job.job_id);
  if (grantAwaitsSourceSwitch(state, job, local, remote)) {
    return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false, readbackOnlyCalls: null });
  }
  const failure = local?.attempt_failure ?? null;
  if (!failure && state.store.readAttemptFailureRaw(job.job_id) !== null) {
    throw executionFailure("failed", "PRODUCTION_FIRST_FACT_OPAQUE_RECONCILIATION_REQUIRED");
  }
  assertLocalFailureAuthority(local ?? null, job, remote);
  if (!failure) return Object.freeze({ reconciledFailure: null, stopBeforeProduct: false,
    readbackOnlyCalls: changedRiskSourceReadbacks(state, job) });
  const reconciled = await reconcileRelease(state, job, remote, failure, parentSpanId, applyRemoteFailureDisposition);
  if (reconciled.stopBeforeProduct) return reconciled;
  if (remote.next_action_code !== "ACTIVE_ATTEMPT") {
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_NEXT_ACTION_INVALID");
  }
  const effective = reconciled.reconciledFailure!;
  if (canResumeRiskGrantAfterZeroInputFailure(state, job, effective)) return reconciled;
  const sourceReadbacks = changedRiskSourceReadbacks(state, job);
  if (sourceReadbacks) return Object.freeze({ ...reconciled, readbackOnlyCalls: sourceReadbacks });
  const disposition = classifyAttemptFailure(effective.failure_core);
  if (disposition === "fail_closed") throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
  const sameAttempt = local!.current_attempt_id === job.grant.attempt_id;
  if ((disposition === "same_attempt_provider_readback") !== sameAttempt) {
    throw executionFailure("failed", "PRODUCTION_CLAIM_AFTER_FAILURE_IDENTITY_INVALID");
  }
  return reconciled;
};
