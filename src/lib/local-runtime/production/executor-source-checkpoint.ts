import type { createProductionGptChildTools, GptProductionExecutionInput } from "../../../capabilities/gpt/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, sha256 } from "./contracts.js";
import type { ProductionRuntimeStore } from "./store.js";
import type { WebsiteAgentTask } from "./contracts.js";
import type { ProductionRoutePolicy } from "./route-policy.js";
import type { SourceReadbackObservation } from "./source-readback-contract.js";
import type { AcceptedSourceSettlement } from "./store-source-settlement.js";

type Checkpoint = Parameters<NonNullable<GptProductionExecutionInput["recordSettledCheckpoint"]>>[0];

export const recordSourceCheckpoint = (input: Readonly<{
  store: ProductionRuntimeStore; browserAuthority: WorkbenchBrowserAuthority;
  jobId: string; attemptId: string; checkpoint: Checkpoint;
}>): void => {
  const checkpoint = input.checkpoint;
  const history = input.browserAuthority.readJobBrowserHistoryEvidence(input.jobId);
  const effects = history.replayEffects.filter((effect) =>
    effect.effectIdentityHash === checkpoint.providerEffectIdentityHash
    && effect.attemptId === checkpoint.sourceAttemptId
    && effect.resultRevision === checkpoint.sourceResultRevision);
  if (!history.walHistoryVerified || effects.length !== 1) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_AMBIGUOUS");
  }
  const effect = effects[0]!;
  const expectedAuthorityHash = checkpoint.browserAuthorityRef
    === `browser-source:${checkpoint.providerEffectIdentityHash}`
    ? effect.walAuthorityHash : effect.rawWalAuthorityHash;
  if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
    || effect.physicalInputCount !== 1 || effect.anchorState !== "trusted"
    || !effect.canonicalConversationHash || !effect.userTurnHash
    || expectedAuthorityHash !== checkpoint.browserAuthorityHash
    || effect.canonicalConversationHash !== sha256(Buffer.from(
      checkpoint.canonicalConversationUrl, "utf8"))
    || effect.userTurnHash !== sha256(Buffer.from(checkpoint.userTurnId, "utf8"))) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_IDENTITY_MISMATCH");
  }
  const body = Object.freeze({
    kind: "settled_checkpoint" as const, path: "source_checkpoint" as const,
    effect_identity_hash: effect.effectIdentityHash,
    source_effect_set_hash: effect.sourceEffectSetHash,
    wal_authority_hash: effect.walAuthorityHash,
    provider_input_delta: 0 as const,
    source_attempt_id: checkpoint.sourceAttemptId,
    source_result_revision: checkpoint.sourceResultRevision,
    checkpoint_exact_call_identity_hash: checkpoint.checkpointExactCallIdentityHash,
    artifact_ref: checkpoint.artifactRef,
    artifact_content_hash: checkpoint.artifactContentHash,
    submit_prompt_hash: checkpoint.submitPromptHash,
    canonical_conversation_hash: effect.canonicalConversationHash,
    user_turn_hash: effect.userTurnHash,
  });
  input.store.recordSourceReadbackObservation(input.jobId,
    input.attemptId, {
      ...body, proof_hash: hashCanonical(body), observed_at: new Date().toISOString(),
    });
};

type Parent = NonNullable<GptProductionExecutionInput["providerContinuationParent"]>;
type Source = Parent["sources"][number];
type SettledObservation = Extract<SourceReadbackObservation, { kind: "settled_checkpoint" }>;
type BrowserHistory = ReturnType<WorkbenchBrowserAuthority["readJobBrowserHistoryEvidence"]>;
type Effect = BrowserHistory["replayEffects"][number];
type ContinuationInput = Readonly<{
  store: ProductionRuntimeStore; browserAuthority: WorkbenchBrowserAuthority;
  task: Pick<WebsiteAgentTask, "parent_task_ref" | "parent_result_ref" | "parent_result_hash">;
  relationKind: ProductionRoutePolicy["relation_kind"]; signal: AbortSignal;
  readAdoptedImageReference: ReturnType<typeof createProductionGptChildTools>["readAdoptedImageReference"];
}>;

const assertContinuationActive = (signal: AbortSignal): void => {
  if (signal.aborted) throw executionFailure("failed", typeof signal.reason === "string"
    ? signal.reason : "PRODUCTION_EXECUTION_ABORTED");
};

const checkpointEffect = (observation: SettledObservation, history: BrowserHistory): Effect => {
  const { proof_hash: proofHash, observed_at: _observedAt, ...body } = observation;
  const effects = history.replayEffects.filter(effect =>
    effect.effectIdentityHash === observation.effect_identity_hash
    && effect.attemptId === observation.source_attempt_id
    && effect.resultRevision === observation.source_result_revision);
  if (hashCanonical(body) !== proofHash || !history.walHistoryVerified || effects.length !== 1) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_AMBIGUOUS");
  }
  const effect = effects[0]!;
  if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
    || effect.physicalInputCount !== 1 || effect.anchorState !== "trusted"
    || effect.childCapabilityId !== "submit_exact_gpt_turn_once"
    || effect.sourceEffectSetHash !== observation.source_effect_set_hash
    || effect.walAuthorityHash !== observation.wal_authority_hash
    || effect.canonicalConversationHash !== observation.canonical_conversation_hash
    || effect.userTurnHash !== observation.user_turn_hash) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_IDENTITY_MISMATCH");
  }
  return effect;
};

const checkpointGrantMatches = (
  grant: AcceptedSourceSettlement, observation: SettledObservation, effect: Effect,
): boolean => {
  if (grant.kind !== "reused_checkpoint") return false;
  const { proof_hash: proofHash, observed_at: _observedAt, ...checkpoint } = grant.effect.settled_checkpoint;
  return grant.sourceAttemptId === observation.source_attempt_id
    && grant.productStepId === effect.productStepId && grant.callId === effect.callId
    && grant.childCapabilityId === effect.childCapabilityId
    && grant.effectIdentityHash === effect.effectIdentityHash
    && grant.sourceEffectSetHash === effect.sourceEffectSetHash
    && grant.effect.anchor_state === "trusted" && grant.effect.anchor_proof_hash === effect.anchorProofHash
    && proofHash === observation.proof_hash
    && hashCanonical({ ...checkpoint, kind: "settled_checkpoint", path: "source_checkpoint",
      effect_identity_hash: grant.effect.effect_identity_hash,
      source_effect_set_hash: grant.effect.source_effect_set_hash,
      wal_authority_hash: grant.effect.wal_authority_hash }) === proofHash;
};

const collectContinuationSources = async (
  input: ContinuationInput, jobId: string, completionAttempt: string, resultRefs: readonly string[],
): Promise<readonly Source[]> => {
  const observations = input.store.readSourceReadbackObservations(jobId, completionAttempt);
  const settlements = input.store.readAcceptedSourceSettlements(jobId);
  const history = input.browserAuthority.readJobBrowserHistoryEvidence(jobId);
  const expected = new Set(resultRefs), adopted = new Set<string>();
  const seen = new Map<string, string>(), sources: Source[] = [];
  for (const observation of observations) {
    assertContinuationActive(input.signal);
    if (observation.kind !== "settled_checkpoint") continue;
    const effect = checkpointEffect(observation, history);
    if (observation.source_attempt_id !== completionAttempt
      && !settlements.some(grant => checkpointGrantMatches(grant, observation, effect))) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
    }
    const ref = expected.has(observation.artifact_ref) ? observation.artifact_ref
      : await input.readAdoptedImageReference({ jobId, sourceAttemptId: observation.source_attempt_id,
        checkpointExactCallIdentityHash: observation.checkpoint_exact_call_identity_hash,
        artifactRef: observation.artifact_ref, artifactContentHash: observation.artifact_content_hash,
        canonicalConversationHash: observation.canonical_conversation_hash, userTurnHash: observation.user_turn_hash });
    assertContinuationActive(input.signal);
    if (!expected.has(ref)) throw executionFailure("failed", "PRODUCTION_PARENT_RESULT_BINDING_INVALID");
    adopted.add(ref);
    const prior = seen.get(effect.effectIdentityHash);
    if (prior && prior !== observation.proof_hash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CONFLICT");
    }
    if (prior) continue;
    seen.set(effect.effectIdentityHash, observation.proof_hash);
    sources.push(Object.freeze({ jobId, sourceAttemptId: effect.attemptId,
      sourceResultRevision: effect.resultRevision, productStepId: effect.productStepId,
      callId: effect.callId, childCapabilityId: effect.childCapabilityId,
      effectIdentityHash: effect.effectIdentityHash, walAuthorityHash: effect.walAuthorityHash }));
  }
  if (sources.length === 0 || adopted.size !== expected.size) {
    throw executionFailure("failed", "PRODUCTION_PARENT_SOURCE_EVIDENCE_MISSING");
  }
  return Object.freeze(sources);
};

/** A completed result authorizes locator selection only through its adopted source identities. */
export const readContinuationSources = async (input: ContinuationInput): Promise<Parent | null> => {
  if (input.relationKind !== "provider_continuation" || !input.task.parent_task_ref) return null;
  assertContinuationActive(input.signal);
  const parent = input.store.readTask(input.task.parent_task_ref);
  if (!parent) throw executionFailure("failed", "PRODUCTION_PARENT_RESULT_BINDING_MISSING");
  if (parent.status !== "completed" || !parent.result
    || parent.task.job_id !== input.task.parent_task_ref || parent.result.job_id !== parent.task.job_id
    || parent.result.result_payload_ref !== input.task.parent_result_ref
    || parent.result.result_payload_hash !== input.task.parent_result_hash) {
    throw executionFailure("failed", "PRODUCTION_PARENT_RESULT_BINDING_INVALID");
  }
  const sources = await collectContinuationSources(input, parent.task.job_id,
    parent.current_attempt_id, parent.result.evidence_refs);
  assertContinuationActive(input.signal);
  const current = input.store.readTask(parent.task.job_id);
  if (!current || current.status !== "completed" || current.current_attempt_id !== parent.current_attempt_id
    || current.task.request_hash !== parent.task.request_hash
    || hashCanonical(current.result) !== hashCanonical(parent.result)) {
    throw executionFailure("failed", "PRODUCTION_PARENT_RESULT_BINDING_INVALID");
  }
  return Object.freeze({ jobId: parent.task.job_id, sources });
};
