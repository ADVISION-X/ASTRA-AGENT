import { createHash } from "node:crypto";
import sharp from "sharp";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptTextCheckpointInput } from "../../contract.js";
import {
  declaredFacts,
  recordInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { assistantTurnForPrompt, ensureResponseConversation } from "./page-observation.js";
import { isGptTurnId, responseHashInput } from "./response-support.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TEXT_CHECKPOINT_KEYS = [
  "artifactRef", "assistantTurnId", "canonicalConversationUrl", "checkpointKind", "evidenceHash",
  "evidenceRef", "promptHash", "rawDomHash", "semanticTextHash", "sourceAttemptId", "turnMarker",
] as const;

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const predecessorInput = (
  intent: Parameters<GptChildHandler<"checkpoint_gpt_generated_image">>[0],
): GptTextCheckpointInput => {
  const checkpoint = recordInput(intent, "predecessorTextCheckpoint");
  if (Object.keys(checkpoint).sort().join("|") !== [...TEXT_CHECKPOINT_KEYS].sort().join("|")
    || checkpoint.checkpointKind !== "text"
    || typeof checkpoint.assistantTurnId !== "string" || !isGptTurnId(checkpoint.assistantTurnId)
    || typeof checkpoint.canonicalConversationUrl !== "string"
    || typeof checkpoint.sourceAttemptId !== "string" || checkpoint.sourceAttemptId.length === 0
    || typeof checkpoint.artifactRef !== "string" || checkpoint.artifactRef.length === 0
    || typeof checkpoint.evidenceRef !== "string" || checkpoint.evidenceRef.length === 0
    || typeof checkpoint.turnMarker !== "string" || checkpoint.turnMarker.length === 0
    || [checkpoint.evidenceHash, checkpoint.promptHash, checkpoint.rawDomHash, checkpoint.semanticTextHash]
      .some((value) => typeof value !== "string" || !HASH.test(value))) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:predecessorTextCheckpoint`);
  }
  canonicalGptConversationUrl(checkpoint.canonicalConversationUrl);
  return checkpoint as GptTextCheckpointInput;
};

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
  requireExactInputKeys(intent, ["assistantTurnId", "canonicalConversationUrl", "expectedMediaHash",
    "expectedPromptHash", "predecessorTextCheckpoint", "turnMarker"]);
  const assistantTurnId = stringInput(intent, "assistantTurnId");
  if (!isGptTurnId(assistantTurnId)) {
    throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_generated_image:assistantTurnId");
  }
  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
  const expectedMediaHash = responseHashInput(intent, "expectedMediaHash");
  const turnMarker = stringInput(intent, "turnMarker");
  const predecessorTextCheckpoint = predecessorInput(intent);
  const browser = requireBrowser(context);
  const observed = await ensureResponseConversation(browser, conversationUrl);
  if (assistantTurnForPrompt(observed, expectedPromptHash) !== assistantTurnId || observed.generatingRaw !== 0) {
    throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
  }
  const media = await browser.downloadAuthenticatedMedia({
    assistantTurnId, semanticMediaId: "gpt-generated-image-main",
  });
  if (!observed.facts.authorityRefHashes.includes(media.authorityTargetHash)
    || !observed.facts.authorityRefHashes.includes(media.authorityDocumentHash)) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_DOCUMENT_MISMATCH");
  }
  const original = Buffer.from(media.bytesBase64, "base64");
  if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
  }
  if (media.sha256 !== expectedMediaHash) throw executionFailure("failed", "GPT_GENERATED_IMAGE_IDENTITY_DRIFT");
  const webp = await renderGeneratedImage(original);
  const imageHash = hash(webp);
  return success({
    value: { assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256,
      authorityTargetHash: media.authorityTargetHash, authorityDocumentHash: media.authorityDocumentHash,
      canonicalConversationUrl: conversationUrl, promptHash: expectedPromptHash, turnMarker,
      artifactId: `airesult_${imageHash.slice(7, 39)}`,
      originalBytes: new Uint8Array(original), webpBytes: new Uint8Array(webp), sha256: imageHash,
      originalSha256: media.sha256, originalSizeBytes: original.byteLength,
      originalMediaType: media.mediaType, originalWidth: media.width, originalHeight: media.height,
      bytes: webp.byteLength, mediaType: "image/webp", width: 1200, height: 630,
      predecessorTextCheckpoint },
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: null }),
  });
};
