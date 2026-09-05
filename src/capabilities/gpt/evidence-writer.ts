import { createHash } from "node:crypto";

import type {
  GptAbilityGroup,
  GptChildCapabilityResult,
} from "./contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { persistGptEvidenceArtifacts } from "./evidence-artifacts.js";
import type { GptEvidenceStorePort } from "./production-ports.js";

const persistedEvidenceRefs = new WeakMap<object, string>();
export const persistedGptEvidenceRef = (result: GptChildCapabilityResult): string | null =>
  persistedEvidenceRefs.get(result) ?? null;

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const jsonHash = (value: unknown): `sha256:${string}` =>
  hash(JSON.stringify(value) ?? "");

const safeProjection = (
  result: GptChildCapabilityResult,
  exactCallIdentityHash: `sha256:${string}`,
): Readonly<Record<string, unknown>> => Object.freeze({
  schema_version: "agent-gpt-evidence-safe.v2",
  exact_call_identity_hash: exactCallIdentityHash,
  child_capability_id: result.proof.childCapabilityId,
  plugin_version: result.proof.pluginVersion,
  action_ordinal: result.proof.actionOrdinal,
  execution_identity_hash: hash(result.proof.executionId),
  candidate_cardinality: result.proof.candidateCardinality,
  committed_mutation: result.proof.committedMutation,
  postcondition_result: result.proof.postconditionResult,
  result_status: result.status,
  reasoning_requirement_result: result.reasoningRequirementResult,
  failure_code: result.failureCode,
  failure_cause: result.failureCause,
  failure_proof: result.status === "failed" ? Object.freeze({
    internal_decision_code: result.proof.internalDecisionCode,
    fact_result_ids: result.proof.factResultIds,
    authority_ref_hashes: result.proof.authorityRefHashes,
    observation_revision_hash: result.proof.observationRevisionHash,
    browser_fact: result.proof.browserFact ? Object.freeze({
      exact_call_identity_hash: result.proof.browserFact.exactCallIdentityHash,
      child_capability_id: result.proof.browserFact.childCapabilityId,
      effect_scope: result.proof.browserFact.effectScope,
      browser_outcome: result.proof.browserFact.browserOutcome,
      mutation_outcome: result.proof.browserFact.mutationOutcome,
      terminal_at: result.proof.browserFact.terminalAt,
      evidence_ref: result.proof.browserFact.evidenceRef,
      evidence_hash: result.proof.browserFact.evidenceHash,
    }) : null,
    native_failure_code: result.proof.nativeFailureCode,
  }) : null,
  started_at: result.proof.startedAt,
  ended_at: result.proof.endedAt,
  source_evidence_hash: result.proof.evidenceHash,
});

export const persistGptChildEvidence = async (input: Readonly<{
  result: GptChildCapabilityResult;
  intent: Parameters<GptAbilityGroup["execute"]>[0];
  evidenceStore: GptEvidenceStorePort;
  jobId: string;
  attemptId: string;
  stepId: string;
  exactCallIdentityHash: `sha256:${string}`;
  settlesPendingEvidence?: boolean;
}>): Promise<Readonly<{ evidenceRef: string; artifactRefs: readonly string[] }>> => {
  const artifactRefs = await persistGptEvidenceArtifacts(input);
  const projection = safeProjection(input.result, input.exactCallIdentityHash);
  const evidenceKey = input.settlesPendingEvidence
    ? `gpt-call-terminal-evidence:v1:${input.exactCallIdentityHash}`
    : `gpt-call-evidence:v1:${input.exactCallIdentityHash}`;
  const appended = await input.evidenceStore.appendRecord({
    missionId: input.jobId, runId: input.attemptId, stepId: input.stepId, sourceCapabilityId: "gpt",
    sourceChildCapabilityId: input.result.proof.childCapabilityId,
    recordType: input.result.proof.committedMutation === "dispatched" ? "failure" : "evidence",
    recordPayload: projection, ...(artifactRefs.length ? { artifactRefs: [...artifactRefs] } : {}),
    idempotencyKey: evidenceKey,
    correlationId: input.intent.executionId,
    createdAt: input.result.proof.endedAt,
  });
  if (appended.status !== "success" || !appended.recordRef) throw executionFailure("failed", "EVIDENCE_APPEND_FAILED");
  const readback = await input.evidenceStore.readRecordRef({
    childCapabilityId: "read-record-ref", recordRef: appended.recordRef,
  });
  if (readback.status !== "success" || !readback.record
    || jsonHash(readback.record.payload) !== jsonHash(projection)) {
    throw executionFailure("failed", "EVIDENCE_READBACK_FAILED");
  }
  persistedEvidenceRefs.set(input.result, appended.recordRef);
  return Object.freeze({ evidenceRef: appended.recordRef, artifactRefs });
};
