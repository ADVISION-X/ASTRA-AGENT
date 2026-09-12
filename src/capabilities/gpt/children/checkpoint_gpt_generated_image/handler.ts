import { createHash } from "node:crypto";
import sharp from "sharp";
import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const renderGeneratedImage = async (original: Buffer) => {
  const originalMetadata = await sharp(original, { failOn: "error", limitInputPixels: 100_000_000 }).metadata();
  if (!Number.isSafeInteger(originalMetadata.width) || !Number.isSafeInteger(originalMetadata.height)
    || (originalMetadata.width ?? 0) < 1 || (originalMetadata.height ?? 0) < 1) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_MECHANICAL_IDENTITY_INVALID");
  }
  const webp = await sharp(original, { failOn: "error", limitInputPixels: 100_000_000 })
    .rotate().resize(1200, 630, { fit: "cover", position: "centre" })
    .webp({ quality: 90, effort: 6 }).toBuffer();
  const metadata = await sharp(webp, { failOn: "error", limitInputPixels: false }).metadata();
  if (metadata.format !== "webp" || metadata.width !== 1200 || metadata.height !== 630
    || metadata.exif || metadata.icc || metadata.iptc || metadata.xmp) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_MECHANICAL_IDENTITY_INVALID");
  }
  return { webp, originalWidth: originalMetadata.width!, originalHeight: originalMetadata.height! };
};

export const checkpointGptGeneratedImageHandler:
GptChildHandler<"checkpoint_gpt_generated_image"> = async (intent, context) => {
  requireExactInputKeys(intent, ["canonicalConversationUrl", "probeBudgetMs", "turnMarker", "userTurnId"]);
  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  const turnMarker = stringInput(intent, "turnMarker");
  const userTurnId = stringInput(intent, "userTurnId");
  const probeBudgetMs = numberInput(intent, "probeBudgetMs");
  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) {
    throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
  }
  const browser = requireBrowser(context);
  const deadline = Date.now() + probeBudgetMs;
  let media: Awaited<ReturnType<typeof browser.readAuthenticatedMedia>>;
  for (;;) {
    if (Date.now() >= deadline) throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    try {
      media = await browser.readAuthenticatedMedia({ canonicalConversationUrl: conversationUrl, userTurnId,
        semanticMediaId: "gpt-generated-image-main" });
      break;
    } catch (error) {
      const code = failureCode(error);
      if (code !== "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT"
        && code !== "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT") throw error;
    }
    if (!context.waitForProviderObservation) {
      throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_GATE_REQUIRED");
    }
    if (await context.waitForProviderObservation(deadline) === "deadline") {
      throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    }
  }
  const original = Buffer.from(media.bytesBase64, "base64");
  if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
  }
  let rendered: Awaited<ReturnType<typeof renderGeneratedImage>>;
  try {
    rendered = await renderGeneratedImage(original);
  } catch (error) {
    if (failureCode(error) !== "UNKNOWN_FAILURE") throw error;
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_DECODE_INVALID", { cause: error });
  }
  const { webp } = rendered;
  const imageHash = hash(webp);
  return success({
    value: { assistantTurnId: media.assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256,
      authorityTargetHash: media.authorityTargetHash, authorityDocumentHash: media.authorityDocumentHash,
      canonicalConversationUrl: conversationUrl, turnMarker,
      artifactId: `airesult_${imageHash.slice(7, 39)}`,
      originalBytes: new Uint8Array(original), webpBytes: new Uint8Array(webp), sha256: imageHash,
      originalSha256: media.sha256, originalSizeBytes: original.byteLength,
      originalMediaType: media.mediaType, originalWidth: rendered.originalWidth,
      originalHeight: rendered.originalHeight,
      bytes: webp.byteLength, mediaType: "image/webp", width: 1200, height: 630,
      },
    ...declaredFacts({ decision: "DONE", factResultIds: Object.freeze([media.sha256]),
      candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
      authorityRefHashes: Object.freeze([media.authorityTargetHash, media.authorityDocumentHash]),
      observationRevisionHash: null,
      mutationOutcome: "no", browserFact: null, nativeFailureCode: null }),
  });
};
