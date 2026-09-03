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

const forkRelation = async (input: ReplayInput): Promise<ProductGptChildResult> => {
  const refs = input.facts.evidence!.artifactRefs;
  if (refs.length !== 1) throw executionFailure("failed", "GPT_FORK_RELATION_TASK_ARTIFACT_MISSING");
  return success(input, await readForkRelationArtifact(input.evidenceStore, refs[0]!));
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
