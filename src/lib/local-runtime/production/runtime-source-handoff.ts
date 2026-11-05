import { failureCode, typedExecutionFailure } from "../../execution-failure.js";
import { executionFailure } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { targetlessFirstFactHash } from "./store-source-settlement.js";
import { claimProductionTasks } from "./cloud-client.js";
import { safeReason, type RuntimeState } from "./runtime-state.js";
import { historicalEffectsSettled, sourceReadbackProofs } from "./runtime-source-readback-proofs.js";
import type { ControlIntent } from "./transport-protocol.js";
import { rejectedSourceCallMembers, type RejectedSourceCall } from "./source-readback-contract.js";

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

const readExactRejectedProviderCall = (browserInput: string,
  beforeRelease: BrowserHistory, attemptId: string, rejected: Rejected | undefined):
  false | BrowserHistory["replayCalls"][number] | null => {
  if (!isRejectedProviderResult(browserInput, rejected)) return false;
  const rejectedEffect = beforeRelease.replayEffects.find((effect) =>
    effect.effectIdentityHash === rejected?.provider_effect_identity_hash);
  const rejectedCall = rejectedEffect && beforeRelease?.replayCalls.find((call) =>
    call.productStepId === rejectedEffect.productStepId
    && call.callId === rejectedEffect.callId
    && call.childCapabilityId === rejectedEffect.childCapabilityId);
  const valid = !!rejected && rejectedEffectMatches(
    beforeRelease, attemptId, rejected, rejectedEffect || undefined, rejectedCall || undefined,
  );
  return valid ? rejectedCall ?? null : null;
};

const rejectedSourceGroup = (history: BrowserHistory, rejected: Rejected | undefined,
  primary: false | BrowserHistory["replayCalls"][number]): RejectedSourceCall | null => {
  if (!primary || !rejected?.provider_effect_identity_hash) return null;
  const identity = (call: BrowserHistory["replayCalls"][number], hash: `sha256:${string}`) => ({
    product_step_id: call.productStepId, call_id: call.callId, child_capability_id: call.childCapabilityId,
    source_effect_set_hash: call.sourceEffectSetHash, effect_identity_hash: hash });
  const head = identity(primary, rejected.provider_effect_identity_hash);
  if (rejected.code !== "GPT_RESPONSE_STOPPED_EMPTY") return head;
  const proof = rejected.stopped_empty_proof;
  if (!proof || proof.retries.length !== 5) return null;
  const root = proof.original_effect_identity_hash;
  const facts = [{ hash: root, ref: proof.original_wal_authority_ref, authority: proof.original_wal_authority_hash,
    ordinal: 0 }, ...proof.retries.map(item => ({ hash: item.effect_identity_hash,
    ref: item.wal_authority_ref, authority: item.wal_authority_hash, ordinal: item.ordinal }))];
  const terminal = history.replayEffects.find(effect => effect.effectIdentityHash === head.effect_identity_hash);
  const members = facts.map(fact => {
    const selected = history.replayEffects.filter(effect => effect.effectIdentityHash === fact.hash);
    const effect = selected[0];
    if (selected.length !== 1 || !effect || !terminal || effect.attemptId !== terminal.attemptId
      || effect.resultRevision !== terminal.resultRevision || effect.productStepId !== primary.productStepId
      || effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed" || effect.physicalInputCount !== 1
      || effect.authorityRef !== fact.ref || effect.rawWalAuthorityHash !== fact.authority) return null;
    const child = fact.ordinal === 0 ? "submit_exact_gpt_turn_once" : "retry_exact_gpt_response_once";
    if (effect.childCapabilityId !== child || fact.ordinal > 0
      && effect.callId !== `stopped-empty-retry:${root.slice(7)}:${fact.ordinal}`) return null;
    const calls = history.replayCalls.filter(call => call.productStepId === effect.productStepId
      && call.callId === effect.callId && call.childCapabilityId === child);
    return calls.length === 1 ? identity(calls[0]!, fact.hash) : null;
  });
  if (members.some(member => member === null) || members[5]?.effect_identity_hash !== head.effect_identity_hash) return null;
  return Object.freeze({ ...head, original_submit: members[0]!, prior_retries:
    members.slice(1, 5).map((member, index) => Object.freeze({ ...member!, ordinal: index + 1 })) });
};

const inheritedReplayAlreadySettled = (
  browserInput: string, historicalInput: string,
  priorHandoff: ReturnType<RuntimeState["store"]["readIssuedSourceHandoffForAttempt"]>,
  inheritedZeroSubmit: boolean, beforeRelease: BrowserHistory, settledHistory: Settlements, attemptId: string,
): boolean => browserInput === "zero" && historicalInput !== "zero"
  && priorHandoff?.kind === "delivery_priority_replay" && !inheritedZeroSubmit
  && historicalEffectsSettled(beforeRelease.replayEffects, settledHistory, attemptId);
const preflightSourceHandoff = (state: RuntimeState, task: Task, attemptId: string, retirementControl?: ControlIntent) => {
  const jobId = task.task.job_id;
  const outbox = state.store.readResultOutboxHistoryEvidence(jobId, attemptId);
  if (outbox.candidateCount !== 0 || retirementControl && state.store.hasPendingCompleteOutput(jobId, attemptId)) return null;
  const browserInput = state.browserAuthority.readAttemptPhysicalInputState(jobId, attemptId);
  const historicalInput = state.browserAuthority.readJobPhysicalInputState(jobId);
  const observations = state.store.readSourceReadbackObservations(jobId, attemptId);
  const settledHistory = state.store.readAcceptedSourceSettlements(jobId);
  const rejected = task.attempt_failure?.failure_core;
  const beforeRelease = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
  if (!beforeRelease.walHistoryVerified) return null;
  const facts = { task, attemptId, outbox, browserInput, observations, settledHistory, retirementControl,
    rejected, historicalInput, beforeRelease };
  if (retirementControl) return { ...facts, rejectedResult: false as const, inheritedPayloadConflict: null,
    rejectedCall: false as const, rejectedGroup: null, ordinaryZeroSource: historicalInput === "zero" };
  const { priorHandoff, inheritedZeroSubmit, payloadConflict: inheritedPayloadConflict } =
    inheritedConflict(state, jobId, attemptId, browserInput, historicalInput);
  if (inheritedZeroSubmit && inheritedPayloadConflict === null) return null;
  const historicalRejection = historicalRejectionSettled(
    priorHandoff, !!inheritedZeroSubmit, beforeRelease, settledHistory, attemptId);
  if (inheritedReplayAlreadySettled(browserInput, historicalInput, priorHandoff,
    !!inheritedZeroSubmit, beforeRelease, settledHistory, attemptId)) return null;
  const rejectedCall = readExactRejectedProviderCall(browserInput, beforeRelease, attemptId, rejected);
  if (rejectedCall === null) return null;
  const rejectedResult = rejectedCall !== false;
  const rejectedGroup = rejectedSourceGroup(beforeRelease, rejected, rejectedCall);
  if (rejectedResult && rejectedGroup === null) return null;
  if (!historyReadbackAvailable(historicalInput === "zero" ? null : beforeRelease, rejectedResult, !!historicalRejection,
    observations, settledHistory)) return null;
  return { ...facts, rejectedResult, inheritedPayloadConflict, rejectedCall, rejectedGroup,
    ordinaryZeroSource: browserInput === "zero" && (historicalInput === "zero" || historicalRejection && !inheritedZeroSubmit) };
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
  const { task, attemptId, outbox, browserInput, rejectedResult } = preflight;
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
    readback_proofs: readbackProofs,
    rejected_call: preflight.rejectedGroup,
    input_quiescence_proof: browserInput === "zero" ? null : terminalWriterQuiescence(browser),
    readback_exhaustion_hash: preflight.ordinaryZeroSource || rejectedResult
      ? null : hashCanonical(readbackProofs.filter((proof) => proof.disposition === "replay_exhausted")),
  });
  const sealed = Object.freeze({ ...body, seal_hash: hashCanonical(body) });
  state.store.sealSourceHandoff(sealed, preflight.retirementControl);
  return sealed;
};

const handoffProofEligible = (
  preflight: Preflight, browser: BrowserHistory,
  provedCalls: BrowserHistory["replayCalls"],
  readbackProofs: NonNullable<ReturnType<typeof sourceReadbackProofs>>,
  reusablePayloadConflict: boolean,
): boolean => {
  const { rejectedResult } = preflight;
  if (preflight.retirementControl) return readbackProofs.length === browser.replayCalls.length;
  if (rejectedResult && (readbackProofs.length !== provedCalls.length
    || readbackProofs.some(proof => proof.disposition === "replay_exhausted" || proof.disposition === "unresolved"))) return false;
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
  const { task, attemptId, browserInput, observations, settledHistory,
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
  const rejectedEffects = new Set(rejectedSourceCallMembers(preflight.rejectedGroup).map(member => member.effect_identity_hash));
  const priorEffects = browser.replayEffects.filter(effect => !rejectedEffects.has(effect.effectIdentityHash));
  const provedCalls = browser.replayCalls.filter((call) =>
    priorEffects.some((effect) => effect.productStepId === call.productStepId
      && effect.callId === call.callId && effect.childCapabilityId === call.childCapabilityId));
  const readbackProofs = preflight.ordinaryZeroSource ? []
    : rejectedResult && provedCalls.length === 0 ? []
    : sourceReadbackProofs({ ...browser, replayCalls: provedCalls,
      replayEffects: priorEffects }, observations, settledHistory, preflight.retirementControl);
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

const sourceHandoffForJob = async (state: RuntimeState, jobId: string,
  control: ControlIntent | undefined): Promise<SourceEvidence | null> => {
  const task = state.store.readTask(jobId);
  if (!task || !task.current_attempt_id || state.active.has(jobId)) return null;
  const priorSeal = state.store.readSealedSourceHandoff(jobId, task.current_attempt_id);
  if (priorSeal) { assertSealedSourceHandoff(priorSeal); return priorSeal; }
  if (!control) return null;
  if (control.job_id !== jobId) throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
  const retirement = control.intent === "cancel_requested"
    && control.reason_code === "ADMIN_AI_WORK_ORDER_REPLACEMENT" && control.control_epoch > 0 ? control : undefined;
  if (!retirement && (task.status !== "failed" || control.intent !== "none") || task.staged_result) return null;
  const preflight = preflightSourceHandoff(state, task, task.current_attempt_id, retirement);
  return preflight ? prepareOneSourceHandoff(state, preflight) : null;
};

export const prepareSourceHandoffs = async (
  state: RuntimeState,
  authorities: readonly Readonly<{ task: Task; control: ControlIntent }>[],
): Promise<NonNullable<Parameters<typeof claimProductionTasks>[4]>> => {
  const evidence: SourceEvidence[] = [];
  const current = new Map(authorities.map(item => [item.task.task.job_id, item.control]));
  for (const jobId of new Set([...state.store.sealedSourceHandoffJobIds(), ...current.keys()])) {
    try {
      const sealed = await sourceHandoffForJob(state, jobId, current.get(jobId));
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
