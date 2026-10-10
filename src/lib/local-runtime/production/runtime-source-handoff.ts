import { failureCode, typedExecutionFailure } from "../../execution-failure.js";
import { executionFailure } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { targetlessFirstFactHash } from "./store-source-settlement.js";
import { claimProductionTasks } from "./cloud-client.js";
import { safeReason, type RuntimeState } from "./runtime-state.js";
import { historicalEffectsSettled, sourceReadbackProofs } from "./runtime-source-readback-proofs.js";

type Task = ReturnType<RuntimeState["store"]["taskAuthorities"]>[number];
type BrowserHistory = ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>;
type Rejected = NonNullable<Task["attempt_failure"]>["failure_core"];
type SourceEvidence = NonNullable<Parameters<typeof claimProductionTasks>[4]>[number];
type Observations = ReturnType<RuntimeState["store"]["readSourceReadbackObservations"]>;
type Settlements = ReturnType<RuntimeState["store"]["readAcceptedSourceSettlements"]>;
const assertSealedSourceHandoff = (source: SourceEvidence): void => {
  if (!Object.hasOwn(source, "input_quiescence_proof")
    || Object.hasOwn(source, "browser_target_settled")
    || Object.hasOwn(source, "target_settlement_hash")
    || source.readback_proofs.some((proof) => proof.effects.some((effect) =>
      Object.hasOwn(effect, "old_path") || Object.hasOwn(effect, "old_target_ref_hash")
      || Object.hasOwn(effect, "old_document_ref_hash")))) {
    throw executionFailure("failed", "PRODUCTION_V43_SEALED_HANDOFF_CUTOVER_REQUIRED");
  }
};

const isRejectedProviderResult = (browserInput: string, rejected: Rejected | undefined): boolean =>
  !!(browserInput === "possible" && rejected
    && (rejected.code === "RESULT_SETTLED_UNUSABLE"
      && rejected.settled_result_payload_hash !== null
      || rejected.code === "GPT_RESPONSE_STOPPED_EMPTY" && rejected.stopped_empty_proof !== null)
    && rejected.effect_scope === "provider_effect" && rejected.browser_outcome === "CONFIRMED"
    && rejected.mutation_outcome === "confirmed"
    && rejected.provider_effect_identity_hash !== null);

const inheritedConflict = (
  state: RuntimeState, jobId: string, attemptId: string,
  browserInput: string, historicalInput: string,
) => {
  const priorHandoff = browserInput === "zero" && historicalInput !== "zero"
    ? state.store.readIssuedSourceHandoffForAttempt(jobId, attemptId) : null;
  const inheritedZeroSubmit = priorHandoff?.kind === "delivery_priority_replay"
    && priorHandoff.payload_slot_conflict !== null
    && priorHandoff.readback_proofs.length === priorHandoff.replay_calls.length
    && priorHandoff.readback_proofs.every((proof) => proof.disposition === "settled_reusable");
  const payloadConflict = inheritedZeroSubmit
    ? state.store.readResultPayloadSlotConflict(jobId, attemptId) : null;
  return { priorHandoff, inheritedZeroSubmit, payloadConflict };
};

const historicalRejectionSettled = (
  priorHandoff: ReturnType<RuntimeState["store"]["readIssuedSourceHandoffForAttempt"]>,
  inheritedZeroSubmit: boolean, before: BrowserHistory | null,
  settledHistory: Settlements, attemptId: string,
): boolean => (priorHandoff?.kind === "attempt_handoff" || inheritedZeroSubmit)
  && before?.walHistoryVerified === true
  && historicalEffectsSettled(before.replayEffects, settledHistory, attemptId);

const rejectedEffectMatches = (
  before: BrowserHistory | null, attemptId: string, rejected: Rejected,
  effect: BrowserHistory["replayEffects"][number] | undefined,
  call: BrowserHistory["replayCalls"][number] | undefined,
): boolean => !!before?.walHistoryVerified && !!effect && effect.state === "CONFIRMED" && !!call
  && effect.attemptId === attemptId && effect.childCapabilityId === rejected.child_capability_id
  && effect.authorityRef === rejected.evidence_ref
  && effect.rawWalAuthorityHash === rejected.evidence_hash
  && effect.mutationOutcome === "confirmed" && effect.physicalInputCount === 1
  && before.replayEffects.filter((item) => item.productStepId === effect.productStepId
    && item.callId === effect.callId && item.childCapabilityId === effect.childCapabilityId
    && item.attemptId === attemptId).length === 1
  && before.replayCalls.filter((item) => item.productStepId === effect.productStepId
    && item.callId === effect.callId && item.childCapabilityId === effect.childCapabilityId).length === 1
  && before.replayEffects.filter((item) =>
    item.effectIdentityHash === rejected.provider_effect_identity_hash).length === 1;

const historyReadbackAvailable = (
  before: BrowserHistory | null, rejectedResult: boolean, historicalRejection: boolean,
  observations: Observations, settledHistory: Settlements,
): boolean => !before || before.walHistoryVerified && before.replayEffects.length > 0
  && (rejectedResult || historicalRejection || before.replayEffects.every((effect) =>
    settledHistory.some((item) => item.effectIdentityHash === effect.effectIdentityHash
      && (item.kind === "risk_authorized"
        ? item.sourceEffectSetHash === effect.sourceEffectSetHash
        : item.sourceAttemptId === effect.attemptId))
    || effect.anchorState === "absent"
    || observations.some((item) => item.effect_identity_hash === effect.effectIdentityHash
      && (item.kind === "settled_checkpoint" || item.kind === "negative_exact"))))
  && (rejectedResult || historicalRejection || !before.replayEffects.some((effect) =>
    effect.anchorState === "trusted"
    && !settledHistory.some((item) => item.effectIdentityHash === effect.effectIdentityHash
      && (item.kind === "risk_authorized"
        ? item.sourceEffectSetHash === effect.sourceEffectSetHash
        : item.sourceAttemptId === effect.attemptId))
    && !observations.some((item) => item.effect_identity_hash === effect.effectIdentityHash
      && (item.path === "exact_conversation" || item.kind === "settled_checkpoint"))));

const readExactRejectedProviderCall = (beforeRelease: BrowserHistory, attemptId: string, rejected: Rejected | undefined) => {
  const rejectedEffect = beforeRelease.replayEffects.find((effect) =>
    effect.effectIdentityHash === rejected?.provider_effect_identity_hash);
  const rejectedCall = rejectedEffect && beforeRelease?.replayCalls.find((call) =>
    call.productStepId === rejectedEffect.productStepId
    && call.callId === rejectedEffect.callId
    && call.childCapabilityId === rejectedEffect.childCapabilityId);
  const valid = !!rejected && rejectedEffectMatches(
    beforeRelease, attemptId, rejected, rejectedEffect || undefined, rejectedCall || undefined,
  );
  return valid ? rejectedCall : null;
};

const inheritedReplayAlreadySettled = (
  browserInput: string, historicalInput: string,
  priorHandoff: ReturnType<RuntimeState["store"]["readIssuedSourceHandoffForAttempt"]>,
  inheritedZeroSubmit: boolean, beforeRelease: BrowserHistory, settledHistory: Settlements, attemptId: string,
): boolean => browserInput === "zero" && historicalInput !== "zero"
  && priorHandoff?.kind === "delivery_priority_replay" && !inheritedZeroSubmit
  && historicalEffectsSettled(beforeRelease.replayEffects, settledHistory, attemptId);

const preflightSourceHandoff = (state: RuntimeState, task: Task, attemptId: string) => {
  const jobId = task.task.job_id;
  const outbox = state.store.readResultOutboxHistoryEvidence(jobId, attemptId);
  if (outbox.candidateCount !== 0) return null;
  const browserInput = state.browserAuthority.readAttemptPhysicalInputState(jobId, attemptId);
  const historicalInput = state.browserAuthority.readJobPhysicalInputState(jobId);
  const observations = state.store.readSourceReadbackObservations(jobId, attemptId);
  const settledHistory = state.store.readAcceptedSourceSettlements(jobId);
  const rejected = task.attempt_failure?.failure_core;
  const rejectedResult = isRejectedProviderResult(browserInput, rejected);
  const beforeRelease = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
  if (!beforeRelease.walHistoryVerified) return null;
  const { priorHandoff, inheritedZeroSubmit, payloadConflict: inheritedPayloadConflict } =
    inheritedConflict(state, jobId, attemptId, browserInput, historicalInput);
  if (inheritedZeroSubmit && inheritedPayloadConflict === null) return null;
  const historicalRejection = historicalRejectionSettled(
    priorHandoff, !!inheritedZeroSubmit, beforeRelease, settledHistory, attemptId);
  if (inheritedReplayAlreadySettled(browserInput, historicalInput, priorHandoff,
    !!inheritedZeroSubmit, beforeRelease, settledHistory, attemptId)) return null;
  const rejectedCall = rejectedResult && readExactRejectedProviderCall(beforeRelease, attemptId, rejected);
  if (rejectedResult && !rejectedCall) return null;
  if (!historyReadbackAvailable(historicalInput === "zero" ? null : beforeRelease, rejectedResult, !!historicalRejection,
    observations, settledHistory)) return null;
  return { task, attemptId, outbox, browserInput, observations, settledHistory,
    rejected, rejectedResult, inheritedPayloadConflict, rejectedCall, historicalInput, beforeRelease,
    ordinaryZeroSource: browserInput === "zero" && (historicalInput === "zero"
      || historicalRejection && !inheritedZeroSubmit) };
};

type Preflight = NonNullable<ReturnType<typeof preflightSourceHandoff>>;

const verifySourceArtifacts = async (
  state: RuntimeState, jobId: string, artifacts: readonly Readonly<{
    sourceAttemptId: string; checkpointExactCallIdentityHash: `sha256:${string}`;
    artifactRef: string; artifactContentHash: `sha256:${string}`;
  }>[],
): Promise<boolean> => {
  for (const artifact of artifacts) {
    try { await state.executor.verifySourceCheckpointArtifact({ jobId, ...artifact }); }
    catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
      state.lastErrorReason = safeReason(error);
      return false;
    }
  }
  return true;
};

const terminalWriterQuiescence = (browser: BrowserHistory) => {
  if (!browser.walHistoryVerified || browser.unresolvedCommandCount !== 0
    || browser.unresolvedCommandSetHash !== hashCanonical([])) return null;
  const body = Object.freeze({ kind: "terminal_wal" as const,
    browser_history_hash: browser.historyHash,
    source_effect_set_hash: hashCanonical(browser.replayCalls
      .map((call) => call.sourceEffectSetHash).sort()),
    unresolved_command_set_hash: browser.unresolvedCommandSetHash });
  return Object.freeze({ ...body, proof_hash: hashCanonical(body) });
};

const sealSourceHandoff = (
  state: RuntimeState, preflight: Preflight, browser: BrowserHistory,
  readbackProofs: NonNullable<ReturnType<typeof sourceReadbackProofs>>,
  payloadSlotConflict: ReturnType<RuntimeState["store"]["readResultPayloadSlotConflict"]>,
  reusablePayloadConflict: boolean,
): SourceEvidence | null => {
  const { task, attemptId, outbox, browserInput, rejected, rejectedResult, rejectedCall } = preflight;
  const firstRaw = state.store.readAttemptFailureRaw(task.task.job_id);
  if (rejectedResult && firstRaw === null) return null;
  const body = Object.freeze({
    kind: preflight.ordinaryZeroSource || rejectedResult
      ? "attempt_handoff" as const : "delivery_priority_replay" as const,
    job_id: task.task.job_id, source_attempt_id: attemptId,
    source_task_hash: hashCanonical(task.task),
    first_fact_raw_hash: targetlessFirstFactHash(firstRaw),
    outbox_history_hash: outbox.historyHash, outbox_candidate_count: outbox.candidateCount,
    payload_slot_conflict: reusablePayloadConflict ? payloadSlotConflict : null,
    browser_history_hash: browser.historyHash, browser_row_count: browser.rowCount,
    browser_input_state: browserInput,
    replay_calls: preflight.ordinaryZeroSource ? []
      : browser.replayCalls.map((call) => Object.freeze({
        product_step_id: call.productStepId, call_id: call.callId,
        child_capability_id: call.childCapabilityId, source_effect_set_hash: call.sourceEffectSetHash,
      })),
    rejected_call: rejectedResult && rejectedCall && rejected?.provider_effect_identity_hash ? Object.freeze({
      product_step_id: rejectedCall.productStepId, call_id: rejectedCall.callId,
      child_capability_id: rejectedCall.childCapabilityId,
      source_effect_set_hash: rejectedCall.sourceEffectSetHash,
      effect_identity_hash: rejected.provider_effect_identity_hash,
    }) : null,
    readback_proofs: readbackProofs,
    input_quiescence_proof: browserInput === "zero" ? null : terminalWriterQuiescence(browser),
    readback_exhaustion_hash: preflight.ordinaryZeroSource || rejectedResult
      ? null : hashCanonical(readbackProofs.filter((proof) => proof.disposition === "replay_exhausted")),
  });
  const sealed = Object.freeze({ ...body, seal_hash: hashCanonical(body) });
  state.store.sealSourceHandoff(sealed);
  return sealed;
};

const handoffProofEligible = (
  preflight: Preflight, browser: BrowserHistory,
  provedCalls: BrowserHistory["replayCalls"],
  readbackProofs: NonNullable<ReturnType<typeof sourceReadbackProofs>>,
  reusablePayloadConflict: boolean,
): boolean => {
  const { rejectedResult, rejectedCall } = preflight;
  if (rejectedResult && (readbackProofs.some((proof) => proof.disposition === "replay_exhausted")
    || browser.replayCalls.length - readbackProofs.length > 1
    || browser.replayCalls.length - readbackProofs.length === 1
      && provedCalls.some((call) => Boolean(rejectedCall)
        && call.productStepId === (rejectedCall || null)?.productStepId
        && call.callId === (rejectedCall || null)?.callId
        && call.childCapabilityId === (rejectedCall || null)?.childCapabilityId))) return false;
  return preflight.ordinaryZeroSource || readbackProofs.some((proof) =>
    proof.disposition === "replay_exhausted") || rejectedResult || reusablePayloadConflict;
};

const hasReusablePayloadConflict = (
  payloadSlotConflict: ReturnType<RuntimeState["store"]["readResultPayloadSlotConflict"]>,
  readbackProofs: NonNullable<ReturnType<typeof sourceReadbackProofs>>,
  browser: BrowserHistory,
): boolean => payloadSlotConflict !== null
  && readbackProofs.length === browser.replayCalls.length && readbackProofs.length > 0
  && readbackProofs.every((proof) => proof.disposition === "settled_reusable");

const prepareOneSourceHandoff = async (
  state: RuntimeState, preflight: Preflight,
): Promise<SourceEvidence | null> => {
  const { task, attemptId, browserInput, observations, settledHistory, rejected,
    rejectedResult, inheritedPayloadConflict } = preflight;
  const jobId = task.task.job_id;
  if (!await verifySourceArtifacts(state, jobId, observations
    .filter((item) => item.kind === "settled_checkpoint")
    .map((item) => ({ sourceAttemptId: item.source_attempt_id,
      checkpointExactCallIdentityHash: item.checkpoint_exact_call_identity_hash,
      artifactRef: item.artifact_ref, artifactContentHash: item.artifact_content_hash })))) return null;
  const browser = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
  if (!browser.walHistoryVerified
    || hashCanonical(browser) !== hashCanonical(preflight.beforeRelease)) return null;
  const priorEffects = rejectedResult ? browser.replayEffects.filter((effect) =>
    effect.effectIdentityHash !== rejected?.provider_effect_identity_hash) : browser.replayEffects;
  const provedCalls = browser.replayCalls.filter((call) =>
    priorEffects.some((effect) => effect.productStepId === call.productStepId
      && effect.callId === call.callId && effect.childCapabilityId === call.childCapabilityId));
  const readbackProofs = preflight.ordinaryZeroSource ? []
    : rejectedResult && provedCalls.length === 0 ? []
    : sourceReadbackProofs({ ...browser, replayCalls: provedCalls,
      replayEffects: priorEffects }, observations, settledHistory);
  if (readbackProofs === null) return null;
  if (!await verifySourceArtifacts(state, jobId, readbackProofs.flatMap((proof) =>
    proof.effects.flatMap((effect) => effect.settled_checkpoint ? [{
      sourceAttemptId: effect.settled_checkpoint.source_attempt_id,
      checkpointExactCallIdentityHash: effect.settled_checkpoint.checkpoint_exact_call_identity_hash,
      artifactRef: effect.settled_checkpoint.artifact_ref,
      artifactContentHash: effect.settled_checkpoint.artifact_content_hash,
    }] : [])))) return null;
  const payloadSlotConflict = browserInput === "possible"
    ? state.store.readResultPayloadSlotConflict(jobId, attemptId) : inheritedPayloadConflict;
  const reusablePayloadConflict = hasReusablePayloadConflict(
    payloadSlotConflict, readbackProofs, browser);
  if (!handoffProofEligible(preflight, browser, provedCalls, readbackProofs,
    reusablePayloadConflict)) return null;
  if (hashCanonical(state.browserAuthority.readJobBrowserHistoryEvidence(jobId)) !== hashCanonical(browser)
    || state.browserAuthority.readAttemptPhysicalInputState(jobId, attemptId) !== browserInput
    || state.browserAuthority.readJobPhysicalInputState(jobId) !== preflight.historicalInput) return null;
  return sealSourceHandoff(state, preflight, browser, readbackProofs,
    payloadSlotConflict, reusablePayloadConflict);
};

export const prepareSourceHandoffs = async (
  state: RuntimeState,
): Promise<NonNullable<Parameters<typeof claimProductionTasks>[4]>> => {
  const evidence: SourceEvidence[] = [];
  for (const task of state.store.taskAuthorities()) {
    const jobId = task.task.job_id;
    if (task.status !== "failed" || !task.current_attempt_id || task.staged_result
      || state.active.has(jobId)) continue;
    try {
      const priorSeal = state.store.readSealedSourceHandoff(jobId, task.current_attempt_id);
      if (priorSeal) { assertSealedSourceHandoff(priorSeal); evidence.push(priorSeal); continue; }
      const preflight = preflightSourceHandoff(state, task, task.current_attempt_id);
      if (!preflight) continue;
      const sealed = await prepareOneSourceHandoff(state, preflight);
      if (sealed) evidence.push(sealed);
    } catch (error) {
      if (!typedExecutionFailure(error)) throw error;
      state.lastErrorCode = failureCode(error, "SOURCE_HANDOFF_RECONCILIATION_PENDING");
      state.lastErrorReason = safeReason(error);
      state.store.setCurrentReason(jobId, state.lastErrorCode);
    }
  }
  return evidence;
};
