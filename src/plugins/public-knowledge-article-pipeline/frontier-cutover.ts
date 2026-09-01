import {
  type GptContinuationTextCheckpoint,
  type StoredGptContinuation,
} from "../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { type WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { readTextCheckpointArtifact } from "../../lib/local-runtime/production/gpt-artifact-reader.js";
import { executionFailure } from "../../lib/typed-failure.js";
import { PLUGIN_ID, turnMarker } from "./seo-turn-contract.js";
import { readCutoverTextEvidence } from "./frontier-cutover-evidence.js";

const sameProvider = (
  left: StoredGptContinuation["provider"],
  right: StoredGptContinuation["provider"],
): boolean => JSON.stringify(left) === JSON.stringify(right);

const verifiedOriginCheckpoint = async (input: Readonly<{
  continuation: StoredGptContinuation;
  task: WebsiteAgentTask;
  pluginVersion: number;
  evidenceStore: ForensicsPersistenceAbilityGroup;
}>): Promise<GptContinuationTextCheckpoint> => {
  const origin = input.continuation.origin_checkpoint;
  const provider = input.continuation.origin_provider;
  if (!origin || provider.prior_task_id !== input.task.job_id
    || provider.provider_page_url !== origin.canonical_conversation_url
    || provider.prior_prompt_hash !== origin.prompt_hash
    || provider.prior_raw_output_hash !== origin.semantic_text_hash
    || provider.prior_turn_marker !== origin.turn_marker) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_IDENTITY_INVALID");
  }
  const artifact = await readTextCheckpointArtifact(input.evidenceStore, origin.artifact_ref);
  const checkpointInput = Object.freeze({
    assistantTurnId: origin.assistant_turn_id,
    canonicalConversationUrl: origin.canonical_conversation_url,
    expectedPromptHash: origin.prompt_hash,
    expectedResponseHash: origin.semantic_text_hash,
    turnMarker: origin.turn_marker,
  });
  await readCutoverTextEvidence({
    evidenceStore: input.evidenceStore,
    task: input.task,
    pluginVersion: input.pluginVersion,
    sourceAttemptId: origin.source_attempt_id,
    stepId: "corpus_research",
    actionOrdinal: 15,
    checkpointInput,
    expectedEvidenceRef: origin.evidence_ref,
    expectedEvidenceHash: origin.evidence_hash,
    expectedArtifactRef: origin.artifact_ref,
  });
  if (artifact.assistantTurnId !== origin.assistant_turn_id
    || artifact.rawDomHash !== origin.raw_dom_hash
    || artifact.semanticTextHash !== origin.semantic_text_hash) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED");
  }
  return Object.freeze({ checkpoint_kind: "text", ...origin });
};

const nextAssistantTurn = (originAssistantTurnId: string): string => {
  const match = /^conversation-turn-([1-9][0-9]*)$/u.exec(originAssistantTurnId);
  const ordinal = Number(match?.[1]);
  if (!Number.isSafeInteger(ordinal)) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_IDENTITY_INVALID");
  }
  return `conversation-turn-${ordinal + 2}`;
};

export const reconstructPublicKnowledgeLegacyCurrentCheckpoint = async (input: Readonly<{
  continuation: StoredGptContinuation;
  task: WebsiteAgentTask;
  pluginVersion: number;
  candidateAttemptIds: readonly string[];
  evidenceStore: ForensicsPersistenceAbilityGroup;
}>): Promise<GptContinuationTextCheckpoint> => {
  const origin = input.continuation.origin_checkpoint;
  const provider = input.continuation.provider;
  if (!origin || input.continuation.plugin_id !== PLUGIN_ID
    || provider.prior_task_id !== input.task.job_id) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_IDENTITY_INVALID");
  }
  if (sameProvider(provider, input.continuation.origin_provider)) {
    return verifiedOriginCheckpoint(input);
  }
  const imageSourceAttemptIds = [...new Set([
    origin.source_attempt_id,
    ...input.candidateAttemptIds,
  ])].filter((attemptId) => provider.prior_turn_marker
    === turnMarker(input.task, attemptId, "article_image_generation"));
  if (imageSourceAttemptIds.length > 0) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_PREDECESSOR_UNAVAILABLE");
  }
  const sourceAttemptIds = [...new Set([
    origin.source_attempt_id,
    ...input.candidateAttemptIds,
  ])].filter((attemptId) => provider.prior_turn_marker
    === turnMarker(input.task, attemptId, "article_synthesis"));
  if (sourceAttemptIds.length !== 1) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED");
  }
  const sourceAttemptId = sourceAttemptIds[0]!;
  const assistantTurnId = nextAssistantTurn(origin.assistant_turn_id);
  const checkpointInput = Object.freeze({
    assistantTurnId,
    canonicalConversationUrl: provider.provider_page_url,
    expectedPromptHash: provider.prior_prompt_hash,
    expectedResponseHash: provider.prior_raw_output_hash,
    turnMarker: provider.prior_turn_marker,
  });
  const evidence = await readCutoverTextEvidence({
    evidenceStore: input.evidenceStore,
    task: input.task,
    pluginVersion: input.pluginVersion,
    sourceAttemptId,
    stepId: "article_synthesis",
    actionOrdinal: 30,
    checkpointInput,
  });
  const artifact = await readTextCheckpointArtifact(input.evidenceStore, evidence.artifactRef);
  if (artifact.assistantTurnId !== assistantTurnId
    || artifact.semanticTextHash !== provider.prior_raw_output_hash) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED");
  }
  return Object.freeze({
    checkpoint_kind: "text",
    source_attempt_id: sourceAttemptId,
    assistant_turn_id: assistantTurnId,
    artifact_ref: evidence.artifactRef,
    raw_dom_hash: artifact.rawDomHash as `sha256:${string}`,
    semantic_text_hash: artifact.semanticTextHash as `sha256:${string}`,
    canonical_conversation_url: provider.provider_page_url,
    prompt_hash: provider.prior_prompt_hash,
    turn_marker: provider.prior_turn_marker,
    evidence_ref: evidence.evidenceRef,
    evidence_hash: evidence.evidenceHash,
  });
};
