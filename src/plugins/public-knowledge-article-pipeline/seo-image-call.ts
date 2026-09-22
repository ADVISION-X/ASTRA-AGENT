import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ProductGptChildResult } from "../../capabilities/gpt/index.js";
import type {
  ProductionHash,
  WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import type { GeneratedImageArtifact } from "../../mediator/product-plugin-contract.js";
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
}>;

const prepareImageSubmit = async (
  input: ImageTurnInput,
  prompt: string,
  promptHash: ProductionHash,
): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once">> => {
  const promptWrite = { productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 43, input: { prompt } } as const;
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 45, input: { files: [], promptHash } } as const;
  return executeAndReadConfirmedSubmit({
    read: () => input.flow.readConfirmedSubmit(turnSubmit),
    prepare: async () => {
      await applyExactProfile(input.flow.execute, input.stepId, [37, 38, 39, 41, 42]);
      await input.flow.execute({ sessionKey: "", ...promptWrite });
    },
    execute: () => input.flow.execute({ sessionKey: "", ...turnSubmit }) as Promise<ProductGptChildResult<"submit_exact_gpt_turn_once">>,
  });
};

const imageArtifact = (value: unknown): GeneratedImageArtifact => {
  const artifact = objectValue(value, "SEO_IMAGE_ARTIFACT_INVALID");
  if (artifact.mediaType !== "image/webp"
    || !Number.isSafeInteger(artifact.width)
    || !Number.isSafeInteger(artifact.height)
    || !Number.isSafeInteger(artifact.bytes) || Number(artifact.bytes) < 1
    || !(artifact.webpBytes instanceof Uint8Array)
    || artifact.webpBytes.byteLength !== artifact.bytes) {
    fail("SEO_IMAGE_ARTIFACT_INVALID");
  }
  return Object.freeze({
    artifact_id: textValue(artifact.artifactId, "SEO_IMAGE_ARTIFACT_INVALID"),
    webp_bytes: artifact.webpBytes,
    sha256: hashValue(artifact.sha256, "SEO_IMAGE_ARTIFACT_INVALID"),
    bytes: Number(artifact.bytes), media_type: "image/webp",
    width: Number(artifact.width), height: Number(artifact.height),
  });
};

const sha256 = (value: Uint8Array): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const originalImageBytes = (value: unknown): Uint8Array => {
  const source = objectValue(value, "SEO_IMAGE_ARTIFACT_INVALID");
  if (!(source.originalBytes instanceof Uint8Array) || source.originalBytes.byteLength < 1
    || !Number.isSafeInteger(source.originalSizeBytes)
    || source.originalSizeBytes !== source.originalBytes.byteLength
    || sha256(source.originalBytes) !== source.originalSha256
    || typeof source.originalMediaType !== "string" || !source.originalMediaType.startsWith("image/")) {
    fail("SEO_IMAGE_ARTIFACT_INVALID");
  }
  return source.originalBytes as Uint8Array;
};

/** Applies only the recorded orientation and re-encodes to metadata-free WebP of the same oriented geometry. */
const orientedWebp = async (input: Buffer): Promise<Readonly<{ webpBytes: Buffer; width: number; height: number }>> => {
  const originalMetadata = await sharp(input, { failOn: "error", limitInputPixels: false }).metadata();
  if (!Number.isSafeInteger(originalMetadata.autoOrient.width)
    || !Number.isSafeInteger(originalMetadata.autoOrient.height)) {
    fail("SEO_IMAGE_ARTIFACT_INVALID");
  }
  const width = originalMetadata.autoOrient.width;
  const height = originalMetadata.autoOrient.height;
  const webpBytes = await sharp(input, { failOn: "error", limitInputPixels: false })
    .rotate().webp({ quality: 90, effort: 6 }).toBuffer();
  const outputMetadata = await sharp(webpBytes, { failOn: "error", limitInputPixels: false }).metadata();
  if (outputMetadata.format !== "webp" || outputMetadata.width !== width || outputMetadata.height !== height
    || outputMetadata.exif || outputMetadata.icc || outputMetadata.iptc || outputMetadata.xmp) {
    fail("SEO_IMAGE_ARTIFACT_INVALID");
  }
  return { webpBytes, width, height };
};

const renderImageArtifact = async (value: unknown): Promise<GeneratedImageArtifact> => {
  const input = Buffer.from(originalImageBytes(value));
  try {
    const { webpBytes, width, height } = await orientedWebp(input);
    const imageHash = sha256(webpBytes);
    return imageArtifact({ artifactId: `airesult_${imageHash.slice(7, 39)}`,
      webpBytes: new Uint8Array(webpBytes), sha256: imageHash, bytes: webpBytes.byteLength,
      mediaType: "image/webp", width, height });
  } catch (error) {
    if (error instanceof Error && error.message === "SEO_IMAGE_ARTIFACT_INVALID") throw error;
    fail("SEO_IMAGE_ARTIFACT_INVALID");
  }
};

const checkpointSubmittedImage = async (
  input: ImageTurnInput,
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
        canonicalConversationUrl,
        probeBudgetMs: SEO_PROVIDER_PROBE_BUDGET_MS, userTurnId, turnMarker: input.marker,
      },
    } as const;
    const checkpoint = await input.flow.execute(checkpointCall);
    const artifactRefs = checkpoint.artifactRefs;
    if (artifactRefs.length !== 1 || !artifactRefs[0]) {
      fail("SEO_IMAGE_ARTIFACT_RECEIPT_INVALID");
    }
    const value = objectValue(checkpoint.value, "SEO_IMAGE_ARTIFACT_INVALID");
    const mediaHash = hashValue(value.mediaHash, "SEO_IMAGE_ARTIFACT_INVALID");
    const originalMediaType = textValue(value.originalMediaType, "SEO_IMAGE_ARTIFACT_INVALID");
    if (!originalMediaType.startsWith("image/")) fail("SEO_IMAGE_ARTIFACT_INVALID");
  return Object.freeze({
      canonicalConversationUrl, mediaHash, generated: await renderImageArtifact(value),
  });
};

export const generateImage = async (input: ImageTurnInput): Promise<GeneratedImageArtifact> => {
  const prompt = imagePrompt(input.task, input.marker, input.article);
  const promptHash = textHash(prompt);
  const confirmed = await prepareImageSubmit(input, prompt, promptHash);
  return (await checkpointSubmittedImage(input, confirmed)).generated;
};
