import { createHash } from "node:crypto";

import type {
  GptAbilityGroup,
  GptChildCapabilityResult,
} from "./contract.js";
import {
  executionFailure,
  executionFailureCause,
  executionFailureMetadata,
  failureCode,
} from "../../lib/execution-failure.js";
import { persistGptEvidenceArtifacts } from "./evidence-artifacts.js";
import type { GptEvidenceStorePort } from "./production-ports.js";
import { gptAttachmentProviderDisplayName } from "./schema.js";

const persistedEvidenceRefs = new WeakMap<object, string>();
export const persistedGptEvidenceRef = (result: GptChildCapabilityResult): string | null =>
  persistedEvidenceRefs.get(result) ?? null;

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const jsonHash = (value: unknown): `sha256:${string}` =>
  hash(JSON.stringify(value) ?? "");

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonical(nested)]))
    : typeof value === "string" ? value.normalize("NFC") : value;

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;
const hashValue = (value: unknown): `sha256:${string}` | null =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value)
    ? value as `sha256:${string}` : null;
const stringHash = (value: unknown): `sha256:${string}` | null =>
  typeof value === "string" ? hash(value) : null;

const canonicalConversationUrlHash = (value: unknown): `sha256:${string}` | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return hash(`${url.origin}${url.pathname}`);
  } catch { return null; }
};

const attachmentLabelHashes = (
  intent: Parameters<GptAbilityGroup["execute"]>[0],
): readonly `sha256:${string}`[] | null => {
  const input = record(intent.input);
  if (!Array.isArray(input?.files)) return null;
  const labels = input.files.map((entry) => {
    const file = record(entry);
    if (typeof file?.providerDisplayName === "string") return file.providerDisplayName.normalize("NFC");
    if (typeof file?.displayName !== "string" || typeof file?.artifactRef !== "string") return null;
    try { return gptAttachmentProviderDisplayName(file.displayName.normalize("NFC"), intent.jobId, file.artifactRef); }
    catch { return null; }
  });
  if (labels.some((value) => value === null)) return null;
  return Object.freeze((labels as string[]).map(hash).sort());
};

const pageInputRoleHashes = (
  intent: Parameters<GptAbilityGroup["execute"]>[0],
): Readonly<Record<string, unknown>> => {
  const input = record(intent.input) ?? {};
  const profile = record(input.profile);
  const reasoningRequirement = record(profile?.reasoningRequirement);
  const attachmentHashes = attachmentLabelHashes(intent);
  const promptHash = typeof input.prompt === "string"
    ? hash(input.prompt) : hashValue(input.promptHash) ?? hashValue(input.expectedPromptHash)
      ?? hashValue(input.sourcePromptHash);
  const conversationUrlHash = canonicalConversationUrlHash(
    input.canonicalConversationUrl ?? input.sourceCanonicalConversationUrl,
  );
  const assistantTurnId = typeof input.assistantTurnId === "string"
    ? input.assistantTurnId : typeof input.sourceAssistantTurnId === "string" ? input.sourceAssistantTurnId : null;
  const reasoning = reasoningRequirement
    && ["exact", "exact-or-observed-maximum"].includes(String(reasoningRequirement.selectionPolicy))
    && ["fast", "medium", "high", "extra_high", "pro_standard"].includes(String(reasoningRequirement.requestedTier))
    ? Object.freeze({
      hash: hash(JSON.stringify(canonical(reasoningRequirement))),
      selectionPolicy: reasoningRequirement.selectionPolicy,
      requestedTier: reasoningRequirement.requestedTier,
    }) : null;
  return Object.freeze({
    promptHash,
    responseHash: hashValue(input.expectedResponseHash) ?? hashValue(input.sourceResponseHash),
    attachmentLabelHashes: attachmentHashes,
    attachmentSetHash: attachmentHashes === null ? null : hash(JSON.stringify(attachmentHashes)),
    modelDisplayNameHash: stringHash(profile?.modelDisplayName),
    reasoningRequirement: reasoning,
    conversationUrlHash,
    turnMarkerHash: stringHash(input.turnMarker ?? input.sourceTurnMarker),
    assistantTurnIdHash: stringHash(assistantTurnId),
  });
};

const safeProjection = (
  result: GptChildCapabilityResult,
  intent: Parameters<GptAbilityGroup["execute"]>[0],
  exactCallIdentityHash: `sha256:${string}`,
): Readonly<Record<string, unknown>> => Object.freeze({
  schema_version: "agent-gpt-evidence-safe.v2",
  exact_call_identity_hash: exactCallIdentityHash,
  product_step_id: result.proof.productStepId,
  call_id: result.proof.callId,
  input_hash: result.proof.inputHash,
  page_input_role_hashes: pageInputRoleHashes(intent),
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
  confirmed_submit_readback_document_hash:
    result.proof.childCapabilityId === "submit_exact_gpt_turn_once"
      && result.proof.committedMutation === "confirmed"
      && result.proof.browserFact?.browserOutcome === "CONFIRMED"
      && result.proof.browserFact.mutationOutcome === "confirmed"
      && !result.failureCode?.startsWith("GPT_DOCUMENT_TRANSITION_FORBIDDEN:")
      ? result.proof.afterDocumentRefHash
      : null,
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
  const projection = safeProjection(input.result, input.intent, input.exactCallIdentityHash);
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

export const persistGptPreExecutionFailure = async (input: Readonly<{
  intent: Parameters<GptAbilityGroup["execute"]>[0];
  evidenceStore: GptEvidenceStorePort;
  jobId: string;
  attemptId: string;
  stepId: string;
  exactCallIdentityHash: `sha256:${string}`;
  error: unknown;
}>): Promise<string> => {
  const metadata = executionFailureMetadata(input.error);
  const projection = Object.freeze({
    schema_version: "agent-gpt-pre-execution-failure.v1",
    exact_call_identity_hash: input.exactCallIdentityHash,
    product_step_id: input.intent.productStepId,
    call_id: input.intent.callId,
    input_hash: input.intent.inputHash,
    child_capability_id: input.intent.childCapabilityId,
    plugin_version: input.intent.pluginVersion,
    action_ordinal: input.intent.actionOrdinal,
    execution_identity_hash: hash(input.intent.executionId),
    failure_code: failureCode(input.error, "GPT_CHILD_RUNTIME_FAILED"),
    failure_cause: executionFailureCause(input.error),
    mutation_outcome: metadata?.mutationOutcome ?? "no",
    browser_effect: metadata?.browserEffect ?? null,
  });
  const appended = await input.evidenceStore.appendRecord({
    missionId: input.jobId,
    runId: input.attemptId,
    stepId: input.stepId,
    sourceCapabilityId: "gpt",
    sourceChildCapabilityId: input.intent.childCapabilityId,
    recordType: "failure",
    recordPayload: projection,
    idempotencyKey: `gpt-call-pre-execution-failure:v1:${input.exactCallIdentityHash}`,
    correlationId: input.intent.executionId,
  });
  if (appended.status !== "success" || !appended.recordRef) {
    throw executionFailure("failed", "EVIDENCE_APPEND_FAILED");
  }
  const readback = await input.evidenceStore.readRecordRef({
    childCapabilityId: "read-record-ref",
    recordRef: appended.recordRef,
  });
  if (readback.status !== "success" || !readback.record
    || jsonHash(readback.record.payload) !== jsonHash(projection)) {
    throw executionFailure("failed", "EVIDENCE_READBACK_FAILED");
  }
  return appended.recordRef;
};
