import type { SourceReadbackCallProof, SourceReadbackEffectProof } from "./source-readback-contract.js";
import { randomUUID } from "node:crypto";

import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
} from "../../runtime-logs/index.js";
import { failureCode } from "../../execution-failure.js";
import { claimProductionTasks } from "./cloud-client.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { PRODUCTION_BUSINESS_CAPACITY_MAX } from "./control-contract-dependency.js";
import { hashCanonical, sha256 } from "./contracts.js";
import type { ProductionRuntimeHealth } from "./runtime-contract.js";
import { executeClaim, reconcilePendingAttemptFailures } from "./runtime-claim.js";
import { classifyAttemptFailure } from "./terminal-failure.js";
import { purgeDeletedJob, reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { terminalSpanFailure } from "./runtime-logging.js";
import {
  refreshLedgerReconciled,
  safeReason,
  wait,
  type RuntimeState,
} from "./runtime-state.js";

const pendingAttemptFailureJobs = (state: RuntimeState) => state.store.pendingAttemptFailures()
  .filter((row) => row.current_attempt_id !== null);

const pendingProviderReadbackJobIds = (state: RuntimeState): ReadonlySet<string> => new Set(
  pendingAttemptFailureJobs(state)
    .filter((row) => row.attempt_failure !== null
      && !row.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")
      && (classifyAttemptFailure(row.attempt_failure.failure_core)
        === "same_attempt_provider_readback"
        || state.browserAuthority.readJobPhysicalInputState(row.task.job_id) !== "zero"))
    .map((row) => row.task.job_id),
);

const providerCooldownPaused = (reason: string | null): boolean =>
  reason === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE"
  || reason?.startsWith("PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE|") === true;

const pendingCooldownResumeJobIds = (state: RuntimeState): ReadonlySet<string> => new Set(
  state.store.taskAuthorities()
    .filter((row) => row.status === "failed" && row.current_attempt_id !== null
      && row.attempt_failure === null && providerCooldownPaused(row.current_reason))
    .map((row) => row.task.job_id),
);

export const claimReusesExistingBusinessSlot = (
  state: RuntimeState,
  job: Readonly<{ job_id: string; grant: Readonly<{
    attempt_id: string; same_accepted_attempt: boolean;
    source_handoff_seal_hash: `sha256:${string}` | null;
  }> }>,
): boolean => {
  const durable = state.store.readTask(job.job_id);
  if (durable?.current_attempt_id !== job.grant.attempt_id
    && durable?.current_reason === `SOURCE_HANDOFF_SEALED|${job.grant.source_handoff_seal_hash}`
    && job.grant.source_handoff_seal_hash !== null) return true;
  if (durable?.current_attempt_id !== job.grant.attempt_id) return false;
  return durable.status === "failed" && job.grant.same_accepted_attempt;
};

const businessInFlightJobIds = (state: RuntimeState): ReadonlySet<string> => new Set([
  ...state.active.keys(),
  ...state.store.taskAuthorities()
    .filter((row) => row.status === "failed" && row.current_attempt_id !== null)
    .map((row) => row.task.job_id),
]);

export const businessInFlightCount = (state: RuntimeState): number =>
  businessInFlightJobIds(state).size;

export const runtimeState = async (state: RuntimeState) => {
  refreshLedgerReconciled(state);
  const browser = state.browserAuthority.readProductionRuntimeState();
  const observedLane = state.browserAuthority.readBrowserLaneState();
  const lane: "blocked" | "busy" | "idle" = browser.browserAuthorityState !== "present"
    ? "blocked" : observedLane;
  return {
    agent_attested_in_flight: businessInFlightCount(state),
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
    browserLaneState: browser.browserAuthorityState !== "present"
      ? "blocked" : browserLane,
    controlContractVersion: state.session.controlContractVersion,
    catalogHash: productionCatalogHash, activeCount: state.active.size,
    pendingOutboxCount: state.store.pendingOutboxCount(),
    lastSuccessfulHeartbeatAt: state.lastHeartbeat,
    lastErrorCode: state.lastErrorCode, lastErrorReason: state.lastErrorReason, checkedAt: new Date().toISOString(),
  };
};

const requestClaimBatch = async (
  state: RuntimeState,
  available: number,
  forceCurrentAttestation: boolean,
  sourceEvidence: Parameters<typeof claimProductionTasks>[4],
  deliveryCandidates: Parameters<typeof claimProductionTasks>[5],
) => {
  const boundaryId = `aipclaim_${randomUUID()}`;
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: `producer:${state.runtimeLogger.producerRunId}`, boundaryId, owner: "production-runtime",
    component: "production-claim", operation: "cloud.claim",
    typedIdentity: { kind: "request", requestId: boundaryId },
  }));
  try {
    const batch = await claimProductionTasks(
      state.session, available, boundaryId, forceCurrentAttestation,
      sourceEvidence, deliveryCandidates,
    );
    state.providerRateLimitControl.observeWebsiteAuthority({
      serverNow: batch.server_now,
      reasonCodes: batch.reason_codes,
    });
    const claimDiagnostics = {
      outcome: batch.outcome,
      claimed_count: batch.jobs.length,
      reason_codes: batch.reason_codes,
    } as const;
    if (batch.outcome === "CLAIM_BLOCKED") {
      requireRuntimeLogWrite(span.terminal({
        claimDiagnostics,
        outcome: "failed", failure: runtimeFailureFromError({
          error: new Error(`CLAIM_BLOCKED:${batch.reason_codes.join(",") || "unspecified"}`),
          code: "CLAIM_BLOCKED", responsibleOwner: "website",
          impact: RuntimeFailureImpact.BLOCKING,
        }),
      }));
    } else requireRuntimeLogWrite(span.terminal({ outcome: "succeeded", claimDiagnostics }));
    return batch;
  } catch (error) {
    const terminal = terminalSpanFailure(
      span, error, runtimeLogCauseEventId(error), "CLAIM_REQUEST_FAILED", undefined, "website",
    );
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

const sourceReadbackProofs = (
  browser: ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>,
  observations: ReturnType<RuntimeState["store"]["readSourceReadbackObservations"]>,
  settledHistory: ReturnType<RuntimeState["store"]["readAcceptedSourceSettlements"]>,
): readonly SourceReadbackCallProof[] | null => {
  if (!browser.walHistoryVerified || browser.replayCalls.length === 0) return null;
  const calls: SourceReadbackCallProof[] = [];
  for (const call of browser.replayCalls) {
    const effects = browser.replayEffects.filter((effect) => effect.productStepId === call.productStepId
      && effect.callId === call.callId && effect.childCapabilityId === call.childCapabilityId);
    if (effects.length === 0) return null;
    const effectProofs: SourceReadbackEffectProof[] = [];
    for (const effect of effects) {
      const rejection = settledHistory.find((item): item is Extract<
        typeof settledHistory[number], { kind: "rejection_settled" }> =>
        item.kind === "rejection_settled"
        && item.effectIdentityHash === effect.effectIdentityHash
        && item.sourceAttemptId === effect.attemptId
        && item.sourceEffectSetHash === effect.sourceEffectSetHash
        && item.productStepId === call.productStepId
        && item.callId === call.callId
        && item.childCapabilityId === call.childCapabilityId);
      const risk = settledHistory.find((item) => item.kind === "risk_authorized"
        && item.effectIdentityHash === effect.effectIdentityHash
        && item.sourceEffectSetHash === effect.sourceEffectSetHash
        && item.productStepId === call.productStepId
        && item.callId === call.callId
        && item.childCapabilityId === call.childCapabilityId);
      const reused = settledHistory.find((item): item is Extract<
        typeof settledHistory[number], { kind: "reused_checkpoint" }> =>
        item.kind === "reused_checkpoint"
        && item.effectIdentityHash === effect.effectIdentityHash
        && item.sourceAttemptId === effect.attemptId
        && item.sourceEffectSetHash === effect.sourceEffectSetHash
        && item.productStepId === call.productStepId
        && item.callId === call.callId
        && item.childCapabilityId === call.childCapabilityId);
      if ([rejection, risk, reused].filter(Boolean).length > 1) return null;
      if (reused) {
        if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
          || effect.physicalInputCount !== 1 || effect.anchorState !== "trusted"
          || reused.effect.wal_authority_hash !== effect.walAuthorityHash
          || reused.effect.old_target_ref_hash !== effect.oldTargetRefHash
          || reused.effect.old_document_ref_hash !== effect.oldDocumentRefHash
          || reused.effect.anchor_proof_hash !== effect.anchorProofHash) return null;
        effectProofs.push(reused.effect);
        continue;
      }
      if (rejection) {
        if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
          || effect.physicalInputCount !== 1
          || effect.authorityRef !== rejection.evidenceRef
          || effect.walAuthorityHash !== rejection.evidenceHash) return null;
        effectProofs.push(Object.freeze({
          effect_identity_hash: effect.effectIdentityHash,
          source_effect_set_hash: effect.sourceEffectSetHash,
          old_target_ref_hash: effect.oldTargetRefHash,
          old_document_ref_hash: effect.oldDocumentRefHash,
          wal_authority_hash: effect.walAuthorityHash,
          anchor_state: effect.anchorState,
          anchor_proof_hash: effect.anchorProofHash,
          old_path: null, exact_path: null,
          rejection_settled: Object.freeze({
            source_attempt_id: effect.attemptId,
            source_handoff_seal_hash: rejection.sourceHandoffSealHash,
          }),
        }));
        continue;
      }
      if (risk) {
        effectProofs.push(Object.freeze({
          effect_identity_hash: effect.effectIdentityHash,
          source_effect_set_hash: effect.sourceEffectSetHash,
          old_target_ref_hash: effect.oldTargetRefHash,
          old_document_ref_hash: effect.oldDocumentRefHash,
          wal_authority_hash: effect.walAuthorityHash,
          anchor_state: effect.anchorState,
          anchor_proof_hash: effect.anchorProofHash,
          old_path: null, exact_path: null,
          risk_authorized: Object.freeze({
            source_handoff_seal_hash: risk.sourceHandoffSealHash }),
        }));
        continue;
      }
      const observationsForEffect = observations.filter((item) =>
        item.effect_identity_hash === effect.effectIdentityHash
        && item.source_effect_set_hash === effect.sourceEffectSetHash
        && item.old_target_ref_hash === effect.oldTargetRefHash
        && item.old_document_ref_hash === effect.oldDocumentRefHash
        && item.wal_authority_hash === effect.walAuthorityHash
        && item.provider_input_delta === 0);
      const settled = observationsForEffect.find((item): item is Extract<typeof item,
        { kind: "settled_checkpoint" }> => item.kind === "settled_checkpoint"
        && item.source_attempt_id === effect.attemptId
        && item.source_result_revision === effect.resultRevision);
      if (settled) {
        const { proof_hash: proofHash, observed_at: observedAt, ...settledBody } = settled;
        if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
          || effect.physicalInputCount !== 1 || effect.anchorState !== "trusted"
          || effect.canonicalConversationHash !== settled.canonical_conversation_hash
          || effect.userTurnHash !== settled.user_turn_hash
          || hashCanonical(settledBody) !== proofHash) return null;
        effectProofs.push(Object.freeze({
          effect_identity_hash: effect.effectIdentityHash,
          source_effect_set_hash: effect.sourceEffectSetHash,
          old_target_ref_hash: effect.oldTargetRefHash,
          old_document_ref_hash: effect.oldDocumentRefHash,
          wal_authority_hash: effect.walAuthorityHash,
          anchor_state: effect.anchorState,
          anchor_proof_hash: effect.anchorProofHash,
          old_path: null, exact_path: null,
          settled_checkpoint: Object.freeze({
            source_attempt_id: settled.source_attempt_id,
            source_result_revision: settled.source_result_revision,
            checkpoint_exact_call_identity_hash: settled.checkpoint_exact_call_identity_hash,
            artifact_ref: settled.artifact_ref,
            artifact_content_hash: settled.artifact_content_hash,
            submit_prompt_hash: settled.submit_prompt_hash,
            canonical_conversation_hash: settled.canonical_conversation_hash,
            user_turn_hash: settled.user_turn_hash,
            proof_hash: proofHash, observed_at: observedAt,
            provider_input_delta: 0,
          }),
        }));
        continue;
      }
      const old = observationsForEffect.find((item): item is Extract<typeof item, { kind: "negative_exact" }> =>
        item.kind === "negative_exact" && item.path === "old_target"
        && item.target_ref_hash === effect.oldTargetRefHash);
      const unavailable = observationsForEffect.find((item): item is Extract<typeof item, { kind: "old_instance_unavailable" }> =>
        item.kind === "old_instance_unavailable" && item.path === "old_target");
      const settlement = browser.targetSettlements.find((item) =>
        item.targetRefHash === effect.oldTargetRefHash);
      const exact = observationsForEffect.find((item): item is Extract<typeof item, { kind: "negative_exact" }> =>
        item.kind === "negative_exact"
        && item.path === "exact_conversation"
        && item.target_ref_hash !== effect.oldTargetRefHash);
      const unaddressable = effect.anchorState === "absent" && settlement !== undefined;
      if (!old && !unavailable && !unaddressable
        || effect.anchorState === "trusted" && !exact) return null;
      effectProofs.push(Object.freeze({
        effect_identity_hash: effect.effectIdentityHash,
        source_effect_set_hash: effect.sourceEffectSetHash,
        old_target_ref_hash: effect.oldTargetRefHash,
        old_document_ref_hash: effect.oldDocumentRefHash,
        wal_authority_hash: effect.walAuthorityHash,
        anchor_state: effect.anchorState,
        anchor_proof_hash: effect.anchorProofHash,
        old_path: old ? Object.freeze({ outcome: "negative_observed" as const,
          proof_hash: old.observation_revision_hash, observed_at: old.observed_at,
          provider_input_delta: 0 as const,
          target_ref_hash: old.target_ref_hash, document_ref_hash: old.document_ref_hash,
        }) : unavailable ? Object.freeze({ outcome: "instance_unavailable" as const,
          proof_hash: unavailable!.proof_hash, observed_at: unavailable!.observed_at,
          provider_input_delta: 0 as const, target_ref_hash: effect.oldTargetRefHash,
          document_ref_hash: effect.oldDocumentRefHash,
        }) : Object.freeze({ outcome: "unaddressable_quiesced" as const,
          proof_hash: hashCanonical({ effectIdentityHash: effect.effectIdentityHash,
            anchorProofHash: effect.anchorProofHash,
            settlementProofHash: settlement!.proofHash }),
          settlement_proof_hash: settlement!.proofHash,
          settlement_outcome: settlement!.outcome,
          observed_at: settlement!.releasedAt, provider_input_delta: 0 as const,
          target_ref_hash: effect.oldTargetRefHash,
          document_ref_hash: effect.oldDocumentRefHash,
        }),
        exact_path: effect.anchorState === "trusted" && exact ? Object.freeze({
          outcome: "negative_observed" as const,
          proof_hash: exact.observation_revision_hash,
          target_ref_hash: exact.target_ref_hash,
          document_ref_hash: exact.document_ref_hash,
          observed_at: exact.observed_at,
          provider_input_delta: 0 as const,
        }) : null,
      }));
    }
    calls.push(Object.freeze({
      product_step_id: call.productStepId, call_id: call.callId,
      child_capability_id: call.childCapabilityId,
      source_effect_set_hash: call.sourceEffectSetHash,
      disposition: effectProofs.some((effect) => effect.settled_checkpoint !== undefined)
        ? "settled_reusable" as const
        : effectProofs.some((effect) => effect.old_path !== null)
          ? "replay_exhausted" as const : "historical_settled" as const,
      effects: Object.freeze(effectProofs),
    }));
  }
  return Object.freeze(calls);
};

export const historicalEffectsSettled = (
  effects: readonly Pick<ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>["replayEffects"][number],
    "attemptId" | "effectIdentityHash" | "sourceEffectSetHash" | "productStepId" | "callId"
    | "childCapabilityId" | "authorityRef" | "walAuthorityHash">[],
  settledHistory: ReturnType<RuntimeState["store"]["readAcceptedSourceSettlements"]>,
  currentAttemptId: string,
): boolean => effects.length > 0 && effects.every((effect) =>
  effect.attemptId !== currentAttemptId
  && settledHistory.some((item) => item.effectIdentityHash === effect.effectIdentityHash
    && item.sourceEffectSetHash === effect.sourceEffectSetHash
    && item.productStepId === effect.productStepId
    && item.callId === effect.callId
    && item.childCapabilityId === effect.childCapabilityId
    && (item.kind === "risk_authorized" ? true
      : item.kind === "reused_checkpoint"
        ? item.sourceAttemptId === effect.attemptId
          && item.effect.wal_authority_hash === effect.walAuthorityHash
        : item.sourceAttemptId === effect.attemptId
          && item.evidenceRef === effect.authorityRef
          && item.evidenceHash === effect.walAuthorityHash)));

const prepareSourceHandoffs = async (
  state: RuntimeState,
): Promise<NonNullable<Parameters<typeof claimProductionTasks>[4]>> => {
  const evidence: NonNullable<Parameters<typeof claimProductionTasks>[4]>[number][] = [];
  for (const task of state.store.taskAuthorities()) {
    const jobId = task.task.job_id;
    if (task.status !== "failed" || !task.current_attempt_id || task.staged_result
      || state.active.has(jobId)) continue;
    const priorSeal = state.store.readSealedSourceHandoff(jobId, task.current_attempt_id);
    if (priorSeal) {
      evidence.push(priorSeal);
      continue;
    }
    const outbox = state.store.readResultOutboxHistoryEvidence(jobId, task.current_attempt_id);
    if (outbox.candidateCount !== 0) continue;
    const browserInput = state.browserAuthority.readAttemptPhysicalInputState(
      jobId, task.current_attempt_id,
    );
    const historicalInput = state.browserAuthority.readJobPhysicalInputState(jobId);
    const jobRefHash = sha256(Buffer.from(jobId, "utf8"));
    const observations = state.store.readSourceReadbackObservations(jobId, task.current_attempt_id);
    const settledHistory = state.store.readAcceptedSourceSettlements(jobId);
    const rejected = task.attempt_failure?.failure_core;
    const rejectedResult = browserInput === "possible" && rejected
      && (rejected.code === "RESULT_SETTLED_UNUSABLE"
        && rejected.settled_result_payload_hash !== null
        || rejected.code === "GPT_RESPONSE_STOPPED_EMPTY"
          && rejected.stopped_empty_proof !== null)
      && rejected.effect_scope === "provider_effect"
      && rejected.browser_outcome === "CONFIRMED"
      && rejected.mutation_outcome === "confirmed"
      && rejected.provider_effect_identity_hash !== null;
    const beforeRelease = historicalInput === "zero" ? null
      : state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
    const priorHandoff = browserInput === "zero" && historicalInput === "possible"
      ? state.store.readIssuedSourceHandoffForAttempt(jobId, task.current_attempt_id)
      : null;
    const inheritedZeroSubmit = priorHandoff?.kind === "delivery_priority_replay"
      && priorHandoff.payload_slot_conflict !== null
      && priorHandoff.readback_proofs.length === priorHandoff.replay_calls.length
      && priorHandoff.readback_proofs.every((proof) => proof.disposition === "settled_reusable");
    const inheritedPayloadConflict = inheritedZeroSubmit
      ? state.store.readResultPayloadSlotConflict(jobId, task.current_attempt_id) : null;
    if (inheritedZeroSubmit && inheritedPayloadConflict === null) continue;
    const historicalRejection = (priorHandoff?.kind === "attempt_handoff"
      || inheritedZeroSubmit)
      && beforeRelease?.walHistoryVerified === true
      && historicalEffectsSettled(beforeRelease.replayEffects, settledHistory,
        task.current_attempt_id);
    if (browserInput === "zero" && historicalInput !== "zero" && !historicalRejection) continue;
    const rejectedEffect = rejectedResult && beforeRelease?.replayEffects.find((effect) =>
      effect.effectIdentityHash === rejected.provider_effect_identity_hash);
    const rejectedCall = rejectedEffect && beforeRelease?.replayCalls.find((call) =>
      call.productStepId === rejectedEffect.productStepId
      && call.callId === rejectedEffect.callId
      && call.childCapabilityId === rejectedEffect.childCapabilityId);
    if (rejectedResult && (!beforeRelease?.walHistoryVerified
      || !rejectedEffect || rejectedEffect.state !== "CONFIRMED"
      || !rejectedCall
      || rejectedEffect.attemptId !== task.current_attempt_id
      || rejectedEffect.childCapabilityId !== rejected.child_capability_id
      || rejectedEffect.authorityRef !== rejected.evidence_ref
      || rejectedEffect.walAuthorityHash !== rejected.evidence_hash
      || rejectedEffect.mutationOutcome !== "confirmed"
      || rejectedEffect.physicalInputCount !== 1
      || beforeRelease.replayEffects.filter((effect) =>
        effect.productStepId === rejectedEffect.productStepId
        && effect.callId === rejectedEffect.callId
        && effect.childCapabilityId === rejectedEffect.childCapabilityId
        && effect.attemptId === task.current_attempt_id).length !== 1
      || beforeRelease.replayCalls.filter((call) =>
        call.productStepId === rejectedEffect.productStepId
        && call.callId === rejectedEffect.callId
        && call.childCapabilityId === rejectedEffect.childCapabilityId).length !== 1
      || beforeRelease.replayEffects.filter((effect) =>
        effect.effectIdentityHash === rejected.provider_effect_identity_hash).length !== 1)) continue;
    if (beforeRelease && (!beforeRelease.walHistoryVerified
      || beforeRelease.replayEffects.length === 0
      || !rejectedResult && !historicalRejection
        && !beforeRelease.replayEffects.every((effect) => settledHistory.some((item) =>
          item.effectIdentityHash === effect.effectIdentityHash
          && (item.kind === "risk_authorized"
            ? item.sourceEffectSetHash === effect.sourceEffectSetHash
            : item.sourceAttemptId === effect.attemptId))
          || effect.anchorState === "absent"
        || observations.some((item) => item.effect_identity_hash === effect.effectIdentityHash
          && (item.path === "old_target" || item.kind === "settled_checkpoint")))
      || !rejectedResult && !historicalRejection
        && beforeRelease.replayEffects.some((effect) => effect.anchorState === "trusted"
        && !settledHistory.some((item) => item.effectIdentityHash === effect.effectIdentityHash
          && (item.kind === "risk_authorized"
            ? item.sourceEffectSetHash === effect.sourceEffectSetHash
            : item.sourceAttemptId === effect.attemptId))
        && !observations.some((item) => item.effect_identity_hash === effect.effectIdentityHash
          && (item.path === "exact_conversation" || item.kind === "settled_checkpoint"))))) continue;
    let sourceArtifactsVerified = true;
    for (const observation of observations) {
      if (observation.kind !== "settled_checkpoint") continue;
      try {
        await state.executor.verifySourceCheckpointArtifact({
          jobId, sourceAttemptId: observation.source_attempt_id,
          checkpointExactCallIdentityHash: observation.checkpoint_exact_call_identity_hash,
          artifactRef: observation.artifact_ref,
          artifactContentHash: observation.artifact_content_hash,
        });
      } catch (error) {
        state.lastErrorCode = failureCode(error, "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
        state.lastErrorReason = safeReason(error);
        sourceArtifactsVerified = false;
        break;
      }
    }
    if (!sourceArtifactsVerified) continue;
    if (state.browserAuthority.readUnreleasedTargetClaims()
      .some((claim) => claim.jobRefHash === jobRefHash)) {
      try {
        await state.browserAuthority.releaseJobBoundTarget(
          jobId, "wait-new-attempt", state.abort.signal,
        );
      } catch (error) {
        state.lastErrorCode = failureCode(error, "SOURCE_TARGET_RELEASE_PENDING");
        state.lastErrorReason = safeReason(error);
        continue;
      }
    }
    if (state.browserAuthority.readUnreleasedTargetClaims()
      .some((claim) => claim.jobRefHash === jobRefHash)) continue;
    const browser = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
    if (!browser.walHistoryVerified || !browser.targetSettled) continue;
    const priorEffects = rejectedResult ? browser.replayEffects.filter((effect) =>
      effect.effectIdentityHash !== rejected.provider_effect_identity_hash)
      : browser.replayEffects;
    const provedCalls = browser.replayCalls.filter((call) =>
      priorEffects.some((effect) => effect.productStepId === call.productStepId
        && effect.callId === call.callId
        && effect.childCapabilityId === call.childCapabilityId));
    const readbackProofs = browserInput === "zero" && inheritedPayloadConflict === null ? []
      : rejectedResult && provedCalls.length === 0 ? []
      : sourceReadbackProofs({ ...browser, replayCalls: provedCalls,
        replayEffects: priorEffects }, observations,
        settledHistory);
    if (readbackProofs === null) continue;
    let reusableArtifactsVerified = true;
    for (const proof of readbackProofs) for (const effect of proof.effects) {
      if (effect.settled_checkpoint === undefined) continue;
      try {
        await state.executor.verifySourceCheckpointArtifact({
          jobId, sourceAttemptId: effect.settled_checkpoint.source_attempt_id,
          checkpointExactCallIdentityHash:
            effect.settled_checkpoint.checkpoint_exact_call_identity_hash,
          artifactRef: effect.settled_checkpoint.artifact_ref,
          artifactContentHash: effect.settled_checkpoint.artifact_content_hash,
        });
      } catch (error) {
        state.lastErrorCode = failureCode(error, "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
        state.lastErrorReason = safeReason(error);
        reusableArtifactsVerified = false;
        break;
      }
    }
    if (!reusableArtifactsVerified) continue;
    const payloadSlotConflict = browserInput === "possible"
      ? state.store.readResultPayloadSlotConflict(jobId, task.current_attempt_id)
      : inheritedPayloadConflict;
    const reusablePayloadConflict = payloadSlotConflict !== null
      && readbackProofs.length === browser.replayCalls.length
      && readbackProofs.length > 0
      && readbackProofs.every((proof) => proof.disposition === "settled_reusable");
    if (rejectedResult && (readbackProofs.some((proof) =>
      proof.disposition === "replay_exhausted")
      || browser.replayCalls.length - readbackProofs.length > 1
      || browser.replayCalls.length - readbackProofs.length === 1
        && provedCalls.some((call) => Boolean(rejectedCall)
          && call.productStepId === (rejectedCall || null)?.productStepId
          && call.callId === (rejectedCall || null)?.callId
          && call.childCapabilityId === (rejectedCall || null)?.childCapabilityId))) continue;
    if (browserInput !== "zero" && !readbackProofs.some((proof) =>
      proof.disposition === "replay_exhausted") && !rejectedResult
      && !reusablePayloadConflict) continue;
    const firstRaw = state.store.readAttemptFailureRaw(jobId);
    if (rejectedResult && firstRaw === null) continue;
    const body = Object.freeze({
      kind: browserInput === "zero" && !reusablePayloadConflict || rejectedResult
        ? "attempt_handoff" as const : "delivery_priority_replay" as const,
      job_id: jobId,
      source_attempt_id: task.current_attempt_id,
      source_task_hash: hashCanonical(task.task),
      first_fact_raw_hash: firstRaw === null ? null : sha256(Buffer.from(firstRaw, "utf8")),
      outbox_history_hash: outbox.historyHash,
      outbox_candidate_count: outbox.candidateCount,
      payload_slot_conflict: reusablePayloadConflict ? payloadSlotConflict : null,
      browser_history_hash: browser.historyHash,
      browser_row_count: browser.rowCount,
      browser_input_state: browserInput,
      replay_calls: browserInput === "zero" && !reusablePayloadConflict ? []
        : browser.replayCalls.map((call) => Object.freeze({
        product_step_id: call.productStepId, call_id: call.callId,
        child_capability_id: call.childCapabilityId,
        source_effect_set_hash: call.sourceEffectSetHash,
      })),
      rejected_call: rejectedResult && rejectedCall ? Object.freeze({
        product_step_id: rejectedCall.productStepId,
        call_id: rejectedCall.callId,
        child_capability_id: rejectedCall.childCapabilityId,
        source_effect_set_hash: rejectedCall.sourceEffectSetHash,
        effect_identity_hash: rejected.provider_effect_identity_hash,
      }) : null,
      readback_proofs: readbackProofs,
      browser_target_settled: true,
      target_settlement_hash: browser.targetSettlementHash,
      readback_exhaustion_hash: browserInput === "zero" && !reusablePayloadConflict
        || rejectedResult ? null
        : hashCanonical(readbackProofs.filter((proof) => proof.disposition === "replay_exhausted")),
    });
    const sealed = Object.freeze({ ...body, seal_hash: hashCanonical(body) });
    state.store.sealSourceHandoff(sealed);
    evidence.push(sealed);
  }
  return evidence;
};

const launchClaimJobs = (
  state: RuntimeState,
  jobs: Awaited<ReturnType<typeof claimProductionTasks>>["jobs"],
): void => {
  const uniqueJobIds = new Set(jobs.map((job) => job.job_id));
  const executingJobIds = new Set(state.active.keys());
  const resultingBusinessJobIds = new Set([...businessInFlightJobIds(state), ...uniqueJobIds]);
  if (jobs.length > PRODUCTION_BUSINESS_CAPACITY_MAX || uniqueJobIds.size !== jobs.length
    || jobs.some((job) => executingJobIds.has(job.job_id))
    || jobs.some((job) => businessInFlightJobIds(state).has(job.job_id)
      && !claimReusesExistingBusinessSlot(state, job))
    || resultingBusinessJobIds.size > PRODUCTION_BUSINESS_CAPACITY_MAX) {
    throw new Error("V6_CLAIM_BATCH_INVALID");
  }
  for (const job of jobs) {
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

const reconcilePendingBusinessAdmissions = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.pendingBusinessAdmissions()) {
    const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
      traceId: task.task.job_id, owner: "production-runtime", component: "production-admission-readback",
      operation: "website.v6-request",
      typedIdentity: { kind: "job", jobId: task.task.job_id },
    }));
    try {
      const outcome = await reconcileBusinessAdmission(state, task);
      if (outcome === "deleted") {
        requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
        continue;
      }
      const current = state.store.readTask(task.task.job_id)!;
      requireRuntimeLogWrite(span.terminal(outcome === "completed" ? {
        outcome: "succeeded", authorityRef: `production-task:${task.task.job_id}`,
        authorityHash: hashCanonical(current),
      } : { outcome: "succeeded" }));
    } catch (error) {
      terminalSpanFailure(span, error, runtimeLogCauseEventId(error),
        "BUSINESS_ADMISSION_RECONCILIATION_FAILED");
    }
  }
};

const reconcileCompletedBrowserTargets = async (state: RuntimeState): Promise<void> => {
  if (state.browserAuthority.readProductionRuntimeState().browserAuthorityState !== "present") return;
  const boundJobRefHash = state.browserAuthority.readBoundJobRefHash();
  const unclosed = state.browserAuthority.readUnreleasedTargetClaims();
  const completedWithOldClaim = state.store.taskAuthorities()
    .filter((task) => task.status === "completed"
      && unclosed.some((claim) => claim.jobRefHash === sha256(Buffer.from(task.task.job_id, "utf8"))))
    .map((task) => task.task.job_id);
  const pending = [...new Set([
    ...state.store.pendingBrowserCleanupJobIds(), ...completedWithOldClaim,
  ])];
  if (pending.length === 0) return;
  const jobId = boundJobRefHash
    ? pending.find((candidate) => sha256(Buffer.from(candidate, "utf8")) === boundJobRefHash)
    : pending[0];
  if (!jobId) return;
  try {
    await state.browserAuthority.releaseJobBoundTarget(
      jobId, "business-admitted", state.abort.signal,
    );
    const releasedJobRefHash = sha256(Buffer.from(jobId, "utf8"));
    if (state.browserAuthority.readUnreleasedTargetClaims()
      .some((claim) => claim.jobRefHash === releasedJobRefHash)
      || (boundJobRefHash === releasedJobRefHash
        && state.browserAuthority.readBoundJobRefHash() === boundJobRefHash)) {
      throw new Error("BROWSER_ADMITTED_TARGET_RELEASE_READBACK_MISSING");
    }
    state.store.settleBrowserCleanup(jobId);
  } catch (error) {
    state.lastErrorCode = failureCode(error, "BROWSER_ADMITTED_TARGET_CLEANUP_PENDING");
    state.lastErrorReason = safeReason(error);
  }
};

const reconcileUnfinishedExecutionsWithoutReceipt = async (state: RuntimeState): Promise<void> => {
  for (const task of state.store.unfinishedExecutionsWithoutReceipt()) {
    if (state.active.has(task.task.job_id)) continue;
    try {
      const remote = await readProductionDeviceJobStatus(state.session, task.task.job_id);
      if (remote.next_action_code === "WAIT_NEW_ATTEMPT"
        && task.current_reason !== "SOURCE_HANDOFF_RECONCILIATION_PENDING"
        && !task.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")) {
        state.store.setCurrentReason(task.task.job_id,
          "SOURCE_HANDOFF_RECONCILIATION_PENDING");
      }
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
      try {
        await purgeDeletedJob(state, task.task.job_id);
      } catch (purgeError) {
        state.store.setCurrentReason(task.task.job_id,
          failureCode(purgeError, "PRODUCTION_JOB_PURGE_FAILED"));
      }
    }
  }
};

const workerIteration = async (state: RuntimeState): Promise<number> => {
  await reconcilePendingBusinessAdmissions(state);
  await reconcileCompletedBrowserTargets(state);
  const hasDeliveryCandidate = state.store.pendingBusinessAdmissions().length > 0;
  try {
    await state.providerRateLimitControl.reconcilePendingIntents();
    await state.executor.reconcilePendingProviderRateLimitIncidents(state.abort.signal);
    await reconcilePendingAttemptFailures(state);
  } catch (error) {
    if (!hasDeliveryCandidate) throw error;
    state.lastErrorCode = failureCode(error, "PROVIDER_RECOVERY_PENDING");
    state.lastErrorReason = safeReason(error);
  }
  try {
    await reconcileUnfinishedExecutionsWithoutReceipt(state);
  } catch (error) {
    if (!hasDeliveryCandidate) throw error;
    state.lastErrorCode = failureCode(error, "EXECUTION_RECONCILIATION_PENDING");
    state.lastErrorReason = safeReason(error);
  }
  refreshLedgerReconciled(state);
  const sourceEvidence = hasDeliveryCandidate
    && state.browserAuthority.readProductionRuntimeState().browserAuthorityState !== "present"
    ? [] : await prepareSourceHandoffs(state);
  const attestation = await state.session.ensureFreshAttestation();
  state.providerRateLimitControl.observeWebsiteAuthority({
    serverNow: attestation.issued_at,
    reasonCodes: attestation.reason_codes,
  });
  state.lastHeartbeat = attestation.issued_at;
  const availableNewSlots = Math.min(
    PRODUCTION_BUSINESS_CAPACITY_MAX - businessInFlightCount(state),
    state.executor.availableCapacity(),
  );
  const hasPendingProviderReadback = pendingProviderReadbackJobIds(state).size > 0;
  const hasAcceptedAttemptRecovery = state.store.taskAuthorities().some((row) =>
    row.status === "failed" && row.current_attempt_id !== null
      && !state.active.has(row.task.job_id));
  const hasPendingCooldownResume = pendingCooldownResumeJobIds(state).size > 0;
  const hasPendingStagedResult = state.store.pendingBusinessAdmissions().length > 0;
  const deliveryCandidates = state.store.taskAuthorities()
    .filter((row) => row.status === "failed" && row.current_attempt_id !== null
      && row.staged_result !== null)
    .map((row) => ({ job_id: row.task.job_id,
      attempt_id: row.current_attempt_id!,
      candidate_hash: hashCanonical(row.staged_result) }));
  const hasExistingAttemptRecovery = hasAcceptedAttemptRecovery
    || hasPendingProviderReadback || hasPendingCooldownResume
    || hasPendingStagedResult || sourceEvidence.length > 0;
  const browser = state.browserAuthority.readProductionRuntimeState();
  const eligible = (availableNewSlots > 0 || hasExistingAttemptRecovery)
    && (state.executor.availableCapacity() > 0 || hasPendingStagedResult)
    && attestation.claim_eligible && state.ledgerReconciled
    && (browser.browserAuthorityState === "present" || hasPendingStagedResult)
    && !state.draining && state.runtimeLogger.isWritable()
    && (state.providerRateLimitControl.canRequestClaimAuthority()
      || hasPendingStagedResult);
  if (!eligible) return 1_000;
  const recoveryOnlyClaim = availableNewSlots <= 0 && hasExistingAttemptRecovery;
  const batch = await requestClaimBatch(
    state, Math.max(1, availableNewSlots), recoveryOnlyClaim,
    sourceEvidence, deliveryCandidates,
  );
  launchClaimJobs(state, batch.jobs);
  return batch.outcome === "LEASE_GRANTED" ? 1_000 : batch.next_claim_after_ms;
};

export const workerLoop = async (state: RuntimeState): Promise<void> => {
  let delay = 1_000;
  while (!state.abort.signal.aborted) {
    try {
      delay = await workerIteration(state);
      if (state.lastErrorCode !== "BROWSER_HOST_UNAVAILABLE") {
        state.lastErrorCode = null;
        state.lastErrorReason = null;
      }
    } catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_RUNTIME_FAILED");
      state.lastErrorReason = safeReason(error);
      delay = Math.min(30_000, Math.max(1_000, delay * 2));
    }
    await wait(delay, state.abort.signal);
  }
};

export const sessionHeartbeatLoop = async (state: RuntimeState): Promise<void> => {
  while (!state.abort.signal.aborted) {
    await wait(20_000, state.abort.signal);
    if (state.abort.signal.aborted) return;
    try {
      const receipt = await state.session.heartbeat();
      state.providerRateLimitControl.observeWebsiteAuthority({
        serverNow: receipt.issued_at,
        reasonCodes: receipt.reason_codes,
      });
      state.lastHeartbeat = receipt.issued_at;
    } catch (error) {
      state.lastErrorCode = failureCode(error, "SESSION_HEARTBEAT_FAILED");
      state.lastErrorReason = safeReason(error);
    }
  }
};
