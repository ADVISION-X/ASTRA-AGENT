import { createHash } from "node:crypto";

import { executionFailure } from "../../lib/execution-failure.js";
import type { GptEvidenceStorePort } from "./production-ports.js";
import {
  readGeneratedImageCheckpointArtifacts,
  readForkRelationArtifact,
  readSubmissionLocatorArtifact,
  readTextCheckpointArtifact,
} from "./artifact-reader.js";
import { isPendingExactEvidence } from "./evidence-fact.js";
import type {
  ExactGptCallFacts,
  ProductGptCallInput,
  ProductGptChildResult,
} from "./product-api.js";

type ReplayInput = Readonly<{
  call: ProductGptCallInput;
  facts: ExactGptCallFacts;
  evidenceStore: GptEvidenceStorePort;
  onSuccess(): void;
}>;

const success = (
  input: ReplayInput,
  value: unknown,
): ProductGptChildResult => {
  input.onSuccess();
  return Object.freeze({
    value: value as ProductGptChildResult["value"],
    evidenceRef: input.facts.evidence!.evidenceRef,
    evidenceHash: input.facts.evidence!.evidenceHash,
  });
};

const textCheckpoint = async (input: ReplayInput): Promise<ProductGptChildResult> => {
  const refs = input.facts.evidence!.artifactRefs;
  if (refs.length !== 1) throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_MISSING");
  return success(input, await readTextCheckpointArtifact(input.evidenceStore, refs[0]!));
};

const imageCheckpoint = async (input: ReplayInput): Promise<ProductGptChildResult> => {
  const refs = input.facts.evidence!.artifactRefs;
  if (refs.length !== 3) throw executionFailure("failed", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  const artifacts = await readGeneratedImageCheckpointArtifacts(input.evidenceStore, refs);
  return success(input, {
    ...artifacts,
    artifactId: `airesult_${artifacts.sha256.slice(7, 39)}`,
  });
};

const submissionLocator = async (input: ReplayInput): Promise<ProductGptChildResult> => {
  const refs = input.facts.evidence!.artifactRefs;
  if (refs.length !== 1) {
    throw executionFailure("failed", "GPT_SUBMISSION_LOCATOR_TASK_ARTIFACT_MISSING");
  }
  return success(input, await readSubmissionLocatorArtifact(input.evidenceStore, refs[0]!));
};

const forkRelationHash = (values: readonly string[]): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(values.join("\n")).digest("hex")}`;

const confirmedForkMutation = (input: ReplayInput): boolean => {
  const mutation = input.facts.mutation;
  return mutation !== null
    && mutation.owner === "browser"
    && mutation.effectScope === "provider_effect"
    && mutation.outcome === "CONFIRMED"
    && typeof mutation.terminalAt === "string"
    && mutation.terminalAt.length > 0
    && Number.isFinite(Date.parse(mutation.terminalAt))
    && typeof mutation.sourceAttemptId === "string"
    && mutation.sourceAttemptId.length > 0
    && mutation.productStepId === input.call.productStepId
    && mutation.callId === input.call.callId
    && mutation.childCapabilityId === "fork_exact_gpt_conversation_at_checkpoint"
    && mutation.actionOrdinal === input.call.actionOrdinal;
};

const forkRelation = async (input: ReplayInput): Promise<ProductGptChildResult> => {
  if (!confirmedForkMutation(input)) {
    throw executionFailure("failed", "GPT_FORK_TASK_EFFECT_RECEIPT_INVALID");
  }
  const refs = input.facts.evidence!.artifactRefs;
  if (refs.length !== 1) throw executionFailure("failed", "GPT_FORK_RELATION_TASK_ARTIFACT_MISSING");
  const relation = await readForkRelationArtifact(input.evidenceStore, refs[0]!);
  const call = input.call as ProductGptCallInput<"fork_exact_gpt_conversation_at_checkpoint">;
  const sourceUrl = relation.sourceCanonicalConversationUrl;
  const sourceAssistantTurnId = relation.sourceAssistantTurnId;
  const childUrl = relation.childCanonicalConversationUrl;
  const relationHash = relation.sourceToChildRelationHash;
  if (sourceUrl !== call.input.sourceCanonicalConversationUrl
    || sourceAssistantTurnId !== call.input.sourceAssistantTurnId
    || typeof childUrl !== "string"
    || childUrl === call.input.sourceCanonicalConversationUrl
    || relationHash !== forkRelationHash([
      call.input.sourceCanonicalConversationUrl,
      call.input.sourceTurnMarker,
      call.input.sourcePromptHash,
      call.input.sourceAssistantTurnId,
      call.input.sourceResponseHash,
      childUrl,
    ])) {
    throw executionFailure("failed", "GPT_FORK_RELATION_TASK_ARTIFACT_INVALID");
  }
  return success(input, relation);
};

export const readCompletedGptChildResult = async (
  input: ReplayInput,
): Promise<ProductGptChildResult | null> => {
  if (!input.facts.evidence || isPendingExactEvidence(input.facts.evidence)) return null;
  if (input.call.child === "checkpoint_gpt_text_response") return textCheckpoint(input);
  if (input.call.child === "checkpoint_gpt_generated_image") return imageCheckpoint(input);
  if (input.call.child === "reconcile_gpt_turn_submission") return submissionLocator(input);
  if (input.call.child === "fork_exact_gpt_conversation_at_checkpoint") return forkRelation(input);
  if (input.call.child === "submit_exact_gpt_turn_once") {
    const submit = input.call as ProductGptCallInput<"submit_exact_gpt_turn_once">;
    return success(input, { promptHash: submit.input.promptHash, mutationSent: false });
  }
  return null;
};
