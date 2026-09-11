import type { ProductGptChildResult } from "../../capabilities/gpt/index.js";
import type {
  ProductionHash,
  WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import type {
  GeneratedImageArtifact,
  ProductSkill,
} from "../../mediator/product-plugin-contract.js";
import {
  fail,
  hashValue,
  objectValue,
  textHash,
  textValue,
} from "./seo-turn-contract.js";
import { imagePrompt } from "./seo-turn-prompts.js";
import {
  applyExactProfile,
  createSeoExecutor,
} from "./seo-gpt-calls.js";
import {
  executeAndReadConfirmedSubmit,
  SEO_PROVIDER_PROBE_BUDGET_MS,
} from "./seo-submit-readback.js";

type ImageTurnInput = Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  task: WebsiteAgentTask;
  marker: string;
  stepId: string;
  article: Readonly<Record<string, unknown>>;
  productSkill: ProductSkill;
}>;

const prepareImageSubmit = async (
  input: ImageTurnInput,
  prompt: string,
  promptHash: ProductionHash,
): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once">> => {
  const promptWrite = { productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 43, input: { prompt } } as const;
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 45, input: { files: [], promptHash } } as const;
  await applyExactProfile(input.flow.execute, input.stepId, [37, 38, 39, 40, 41, 42]);
  await input.flow.execute({ sessionKey: "", ...promptWrite });
  return executeAndReadConfirmedSubmit({
    execute: () => input.flow.execute({ sessionKey: "", ...turnSubmit }) as Promise<ProductGptChildResult<"submit_exact_gpt_turn_once">>,
  });
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
  submit: ProductGptChildResult<"submit_exact_gpt_turn_once">,
): Promise<Readonly<{
  canonicalConversationUrl: string;
  mediaHash: ProductionHash;
  generated: GeneratedImageArtifact;
}>> => {
    const { canonicalConversationUrl, userTurnId } = submit.value;
    const checkpointCall = {
      sessionKey: "", productStepId: input.stepId, callId: "image-checkpoint",
      child: "checkpoint_gpt_generated_image", actionOrdinal: 47,
      input: {
        canonicalConversationUrl, expectedPromptHash: promptHash,
        probeBudgetMs: SEO_PROVIDER_PROBE_BUDGET_MS, userTurnId, turnMarker: input.marker,
      },
    } as const;
    const checkpoint = await input.flow.execute(checkpointCall);
    const artifactRefs = checkpoint.artifactRefs;
    if (artifactRefs.length !== 3 || !artifactRefs[0] || !artifactRefs[1]) {
      fail("SEO_IMAGE_ARTIFACT_RECEIPT_INVALID");
    }
    const value = objectValue(checkpoint.value, "SEO_IMAGE_ARTIFACT_INVALID");
    const mediaHash = hashValue(value.mediaHash, "SEO_IMAGE_ARTIFACT_INVALID");
    const originalMediaType = textValue(value.originalMediaType, "SEO_IMAGE_ARTIFACT_INVALID");
    if (!originalMediaType.startsWith("image/")) fail("SEO_IMAGE_ARTIFACT_INVALID");
  return Object.freeze({
      canonicalConversationUrl, mediaHash, generated: imageArtifact(value),
  });
};

export const generateImage = async (input: ImageTurnInput): Promise<GeneratedImageArtifact> => {
  const prompt = imagePrompt(input.task, input.marker, input.productSkill, input.article);
  const promptHash = textHash(prompt);
  const confirmed = await prepareImageSubmit(input, prompt, promptHash);
  return (await checkpointSubmittedImage(
    input, promptHash, confirmed,
  )).generated;
};
