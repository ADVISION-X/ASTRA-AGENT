import type {
  GptContinuationCheckpointInput,
  GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import type {
  ProductionHash,
  WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import type {
  GeneratedImageArtifact,
  ProductSkill,
} from "../../mediator/product-plugin-contract.js";
import type {
  ConfirmedGptSubmitFailureReceipt,
  ExactGptCallFacts,
} from "../../capabilities/gpt/index.js";
import {
  continuationTextCheckpoint,
  fail,
  hashValue,
  objectValue,
  textHash,
  textValue,
  type SeoTurnCheckpoint,
} from "./seo-turn-contract.js";
import { imagePrompt } from "./seo-turn-prompts.js";
import {
  advanceLane,
  applyExactProfile,
  confirmedDeadline,
  createSeoExecutor,
  focusContinuation,
  preservePostSubmitReadback,
  preserveConfirmedSubmitDirectFailure,
  reconcileConfirmedSubmissionLocator,
  releaseLane,
  requireConfirmedSubmitDirectFailure,
  requireExactProfileEvidence,
  type SeoConfirmedSubmit,
} from "./seo-gpt-calls.js";

type ImageTurnInput = Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  task: WebsiteAgentTask;
  marker: string;
  stepId: string;
  continuationRef: string;
  expectedProvider: GptProviderContinuation;
  sourceAttemptId: string;
  predecessorCheckpoint: SeoTurnCheckpoint;
  predecessorSourceAttemptId: string;
  productSkill: ProductSkill;
}>;

const prepareImageSubmit = async (
  input: ImageTurnInput,
  prompt: string,
  promptHash: ProductionHash,
): Promise<ExactGptCallFacts> => {
  const promptWrite = { productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 43, input: { prompt } } as const;
  const draftReconcile = { productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft", actionOrdinal: 44, input: { files: [], prompt, turnMarker: input.marker } } as const;
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 45, input: { files: [], promptHash, turnMarker: input.marker } } as const;
  await applyExactProfile(input.flow.execute, input.stepId, [37, 38, 39, 40, 41, 42]);
  await input.flow.execute({ sessionKey: "", ...promptWrite });
  await input.flow.execute({ sessionKey: "", ...draftReconcile });
  try {
    await input.flow.execute({ sessionKey: "", ...turnSubmit });
  } catch (error) {
    const confirmed = requireConfirmedSubmitDirectFailure(
      error,
      await input.flow.confirmedSubmitFailure(turnSubmit),
    );
    await input.flow.execute({
      sessionKey: "", productStepId: input.stepId, callId: "submission-reconcile",
      child: "reconcile_gpt_turn_submission", actionOrdinal: 46,
      input: { expectedPromptHash: promptHash, timeoutMs: 60_000, turnMarker: input.marker },
    });
    return preserveConfirmedSubmitDirectFailure(error, confirmed);
  }
  const confirmed = await input.flow.facts(turnSubmit);
  confirmedDeadline(confirmed);
  return confirmed;
};

const recoverFailedImageSubmit = async (
  input: ImageTurnInput,
  prompt: string,
  receipt: ConfirmedGptSubmitFailureReceipt,
): Promise<ConfirmedGptSubmitFailureReceipt> => {
  await requireExactProfileEvidence(input.flow, input.stepId, [37, 38, 39, 40, 41, 42]);
  await input.flow.requireEvidence({
    productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt",
    actionOrdinal: 43, input: { prompt },
  });
  await input.flow.requireEvidence({
    productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft",
    actionOrdinal: 44, input: { files: [], prompt, turnMarker: input.marker },
  });
  confirmedDeadline(receipt);
  return receipt;
};

const settleCurrentImageSubmit = async (
  input: ImageTurnInput,
  prompt: string,
  promptHash: ProductionHash,
): Promise<ExactGptCallFacts> => {
  await requireExactProfileEvidence(input.flow, input.stepId, [37, 38, 39, 40, 41, 42]);
  await input.flow.requireEvidence({
    productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt",
    actionOrdinal: 43, input: { prompt },
  });
  await input.flow.requireEvidence({
    productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft",
    actionOrdinal: 44, input: { files: [], prompt, turnMarker: input.marker },
  });
  const submit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 45, input: { files: [], promptHash, turnMarker: input.marker } } as const;
  await input.flow.execute({ sessionKey: "", ...submit });
  const confirmed = await input.flow.facts(submit);
  confirmedDeadline(confirmed);
  return confirmed;
};

const imageArtifact = (value: unknown): GeneratedImageArtifact => {
  const artifact = objectValue(value, "SEO_IMAGE_ARTIFACT_INVALID");
  if (artifact.mediaType !== "image/webp" || artifact.width !== 1200 || artifact.height !== 630
    || !Number.isSafeInteger(artifact.bytes) || Number(artifact.bytes) < 1
    || !(artifact.originalBytes instanceof Uint8Array) || !(artifact.webpBytes instanceof Uint8Array)
    || artifact.originalBytes.byteLength < 1 || artifact.webpBytes.byteLength !== artifact.bytes) {
    fail("SEO_IMAGE_ARTIFACT_INVALID");
  }
  return Object.freeze({
    artifact_id: textValue(artifact.artifactId, "SEO_IMAGE_ARTIFACT_INVALID"),
    webp_bytes: artifact.webpBytes, original_bytes: artifact.originalBytes,
    sha256: hashValue(artifact.sha256, "SEO_IMAGE_ARTIFACT_INVALID"),
    original_sha256: hashValue(artifact.originalSha256, "SEO_IMAGE_ARTIFACT_INVALID"),
    bytes: Number(artifact.bytes), media_type: "image/webp", width: 1200, height: 630,
  });
};

const checkpointSubmittedImage = async (
  input: ImageTurnInput,
  promptHash: ProductionHash,
  confirmedSubmit: SeoConfirmedSubmit,
  canonicalConversationUrl: string,
): Promise<Readonly<{
  canonicalConversationUrl: string;
  mediaHash: ProductionHash;
  generated: GeneratedImageArtifact;
  currentCheckpoint: GptContinuationCheckpointInput;
}>> => {
  try {
    const stable = await input.flow.execute({
      sessionKey: "", productStepId: input.stepId, callId: "image-wait",
      child: "wait_for_stable_gpt_image", actionOrdinal: 47,
      input: {
        absoluteDeadline: confirmedDeadline(confirmedSubmit), canonicalConversationUrl,
        expectedPromptHash: promptHash, turnMarker: input.marker,
      },
    });
    const stableValue = objectValue(stable.value, "SEO_IMAGE_RESPONSE_INVALID");
    const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_IMAGE_RESPONSE_INVALID");
    const mediaHash = hashValue(stableValue.mediaHash, "SEO_IMAGE_RESPONSE_INVALID");
    const checkpointCall = {
      sessionKey: "", productStepId: input.stepId, callId: "image-checkpoint",
      child: "checkpoint_gpt_generated_image", actionOrdinal: 48,
      input: {
        assistantTurnId, canonicalConversationUrl, expectedPromptHash: promptHash,
        expectedMediaHash: mediaHash,
        predecessorTextCheckpoint: continuationTextCheckpoint(
          input.predecessorSourceAttemptId, input.predecessorCheckpoint,
        ),
        turnMarker: input.marker,
      },
    } as const;
    const checkpoint = await input.flow.execute(checkpointCall);
    const checkpointFacts = await input.flow.facts(checkpointCall);
    const artifactRefs = checkpointFacts.evidence?.artifactRefs ?? [];
    if (artifactRefs.length !== 3 || !artifactRefs[0] || !artifactRefs[1]) {
      fail("SEO_IMAGE_ARTIFACT_RECEIPT_INVALID");
    }
    const value = objectValue(checkpoint.value, "SEO_IMAGE_ARTIFACT_INVALID");
    const originalMediaType = textValue(value.originalMediaType, "SEO_IMAGE_ARTIFACT_INVALID");
    if (!originalMediaType.startsWith("image/")) fail("SEO_IMAGE_ARTIFACT_INVALID");
    return Object.freeze({
      canonicalConversationUrl, mediaHash, generated: imageArtifact(value),
      currentCheckpoint: Object.freeze({
        checkpointKind: "generated_image", sourceAttemptId: input.sourceAttemptId,
        assistantTurnId, canonicalConversationUrl, promptHash, mediaHash, turnMarker: input.marker,
        originalArtifactRef: artifactRefs[0],
        originalSha256: hashValue(value.originalSha256, "SEO_IMAGE_ARTIFACT_INVALID"),
        originalBytes: Number(value.originalSizeBytes),
        originalMediaType: originalMediaType as `image/${string}`,
        originalWidth: Number(value.originalWidth), originalHeight: Number(value.originalHeight),
        webpArtifactRef: artifactRefs[1],
        webpSha256: hashValue(value.sha256, "SEO_IMAGE_ARTIFACT_INVALID"),
        webpBytes: Number(value.bytes), mediaType: "image/webp", width: 1200, height: 630,
        evidenceRef: checkpoint.evidenceRef, evidenceHash: checkpoint.evidenceHash,
        predecessorTextCheckpoint: continuationTextCheckpoint(
          input.predecessorSourceAttemptId, input.predecessorCheckpoint,
        ),
      }),
    });
  } catch (error) {
    return preservePostSubmitReadback(error, confirmedSubmit);
  }
};

export const generateImage = async (input: ImageTurnInput): Promise<GeneratedImageArtifact> => {
  const prompt = imagePrompt(input.task, input.marker, input.productSkill);
  const promptHash = textHash(prompt);
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 45, input: { files: [], promptHash, turnMarker: input.marker } } as const;
  const failedSubmit = await input.flow.confirmedSubmitFailure(turnSubmit);
  const recoveredConversationUrl = failedSubmit
    ? await reconcileConfirmedSubmissionLocator({
      actionOrdinal: 46,
      confirmedSubmit: failedSubmit,
      flow: input.flow,
      marker: input.marker,
      promptHash,
      stepId: input.stepId,
    }) : null;
  const currentSubmit = failedSubmit ? null : await input.flow.facts(turnSubmit);
  const priorSubmit = failedSubmit
    ? null
    : currentSubmit && (currentSubmit.mutation || currentSubmit.evidence)
      ? currentSubmit : await input.flow.facts(turnSubmit, "task_exact_effect");
  const lane = await focusContinuation(
    input.flow, input.task, input.stepId, input.continuationRef,
    input.expectedProvider, [34, 35, 36], 50,
  );
  let advanced = false;
  try {
    let confirmed: SeoConfirmedSubmit;
    if (failedSubmit) {
      confirmed = await recoverFailedImageSubmit(input, prompt, failedSubmit);
    } else if (currentSubmit && (currentSubmit.mutation || currentSubmit.evidence)) {
      confirmed = await settleCurrentImageSubmit(input, prompt, promptHash);
    } else if (priorSubmit && !priorSubmit.mutation && !priorSubmit.evidence) {
      confirmed = await prepareImageSubmit(input, prompt, promptHash);
    } else if (priorSubmit?.mutation?.outcome === "CONFIRMED"
      && priorSubmit.mutation.terminalAt
      && priorSubmit.evidence?.readbackVerified === true) {
      confirmedDeadline(priorSubmit);
      confirmed = priorSubmit;
    } else {
      fail("SEO_IMAGE_SUBMIT_FACT_UNRESOLVED");
    }
    const canonicalConversationUrl = recoveredConversationUrl
      ?? await reconcileConfirmedSubmissionLocator({
        actionOrdinal: 46,
        confirmedSubmit: confirmed,
        flow: input.flow,
        marker: input.marker,
        promptHash,
        stepId: input.stepId,
      });
    const checkpoint = await checkpointSubmittedImage(
      input, promptHash, confirmed, canonicalConversationUrl,
    );
    await advanceLane(input.flow.execute, input.task, input.stepId, lane, {
      canonicalConversationUrl: checkpoint.canonicalConversationUrl,
      promptHash, rawOutputHash: checkpoint.mediaHash, turnMarker: input.marker,
    }, checkpoint.currentCheckpoint, 49);
    advanced = true;
    return checkpoint.generated;
  } finally {
    if (!advanced) await releaseLane(input.flow.execute, input.task, input.stepId, lane, 50);
  }
};
