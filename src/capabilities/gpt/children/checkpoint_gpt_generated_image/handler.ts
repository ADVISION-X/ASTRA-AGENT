import { createHash } from "node:crypto";
import sharp from "sharp";
import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  numberInput,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { assistantTurnForPrompt, ensureResponseConversation } from "./page-observation.js";
import { responseHashInput } from "./response-support.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const renderGeneratedImage = async (original: Buffer): Promise<Buffer> => {
  const webp = await sharp(original, { failOn: "error", limitInputPixels: 100_000_000 })
    .rotate().resize(1200, 630, { fit: "cover", position: "centre" })
    .webp({ quality: 90, effort: 6 }).toBuffer();
  const metadata = await sharp(webp, { failOn: "error", limitInputPixels: false }).metadata();
  if (metadata.format !== "webp" || metadata.width !== 1200 || metadata.height !== 630
    || metadata.exif || metadata.icc || metadata.iptc || metadata.xmp) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_MECHANICAL_IDENTITY_INVALID");
  }
  return webp;
};

export const checkpointGptGeneratedImageHandler:
GptChildHandler<"checkpoint_gpt_generated_image"> = async (intent, context) => {
  requireExactInputKeys(intent, ["canonicalConversationUrl", "expectedPromptHash", "probeBudgetMs", "turnMarker"]);
  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
  const turnMarker = stringInput(intent, "turnMarker");
  const probeBudgetMs = numberInput(intent, "probeBudgetMs");
  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) {
    throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
  }
  const browser = requireBrowser(context);
  const deadline = Date.now() + probeBudgetMs;
  let observed: Awaited<ReturnType<typeof ensureResponseConversation>>;
  let assistantTurnId: string;
  let media: Awaited<ReturnType<typeof browser.downloadAuthenticatedMedia>>;
  for (;;) {
    observed = await ensureResponseConversation({ browser, canonicalConversationUrl: conversationUrl, context, deadline });
    const candidate = assistantTurnForPrompt(observed, expectedPromptHash);
    if (candidate && observed.generatingRaw === 0) {
      try {
        media = await browser.downloadAuthenticatedMedia({ assistantTurnId: candidate,
          semanticMediaId: "gpt-generated-image-main", delivery: "visible-download" });
        assistantTurnId = candidate;
        break;
      } catch (error) {
        if (failureCode(error) !== "BROWSER_AUTHENTICATED_MEDIA_ABSENT") throw error;
      }
    }
    if (!context.yieldForProviderProbe) {
      throw executionFailure("failed", "GPT_PROVIDER_PROBE_GATE_REQUIRED");
    }
    if (await context.yieldForProviderProbe(conversationUrl, deadline) === "deadline") {
      throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    }
  }
  if (!observed.facts.authorityRefHashes.includes(media.authorityTargetHash)
    || !observed.facts.authorityRefHashes.includes(media.authorityDocumentHash)) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_DOCUMENT_MISMATCH");
  }
  const original = Buffer.from(media.bytesBase64, "base64");
  if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
  }
  const webp = await renderGeneratedImage(original);
  const imageHash = hash(webp);
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return success({
    value: { assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256,
      authorityTargetHash: media.authorityTargetHash, authorityDocumentHash: media.authorityDocumentHash,
      canonicalConversationUrl: conversationUrl, promptHash: expectedPromptHash, turnMarker,
      artifactId: `airesult_${imageHash.slice(7, 39)}`,
      originalBytes: new Uint8Array(original), webpBytes: new Uint8Array(webp), sha256: imageHash,
      originalSha256: media.sha256, originalSizeBytes: original.byteLength,
      originalMediaType: media.mediaType, originalWidth: media.width, originalHeight: media.height,
      bytes: webp.byteLength, mediaType: "image/webp", width: 1200, height: 630,
      },
    ...declaredFacts({ ...observed.facts, decision: "ACT",
      factResultIds: Object.freeze([...observed.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...observed.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: browserFact.mutationOutcome, browserFact, nativeFailureCode: null }),
  });
};
