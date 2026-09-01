import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { requireRuntimeLogWrite, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import { executionFailure } from "../../typed-failure.js";
import {
  readGeneratedImageCheckpointArtifacts,
  readSubmissionLocatorArtifact,
  readTextCheckpointArtifact,
} from "./gpt-artifact-reader.js";
import { isPendingExactEvidence } from "./production-gpt-call-facts.js";
import type { ExactGptCallFacts, ProductGptCallInput, ProductGptChildResult } from "./plugin.js";

type ReplayInput = Readonly<{
  call: ProductGptCallInput;
  facts: ExactGptCallFacts;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  span: RuntimeSpanHandle;
  browserMutation: boolean;
}>;

const success = (
  input: ReplayInput,
  value: unknown,
): ProductGptChildResult => {
  requireRuntimeLogWrite(input.span.terminal({ outcome: "succeeded" }));
  return Object.freeze({
    value,
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

export const readCompletedGptChildResult = async (
  input: ReplayInput,
): Promise<ProductGptChildResult | null> => {
  if (!input.facts.evidence || isPendingExactEvidence(input.facts.evidence)) return null;
  if (input.call.child === "checkpoint_gpt_text_response") return textCheckpoint(input);
  if (input.call.child === "checkpoint_gpt_generated_image") return imageCheckpoint(input);
  if (input.call.child === "reconcile_gpt_turn_submission") return submissionLocator(input);
  if (!input.browserMutation || input.facts.mutation?.outcome === "DISPATCHED") return null;
  return success(input, null);
};
