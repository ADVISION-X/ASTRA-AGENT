import { createHash } from "node:crypto";

import type { ForensicsPersistenceAbilityGroup } from "../forensics-persistence/index.js";
import { executionFailure } from "../../lib/execution-failure.js";

export type GeneratedImageCheckpointArtifacts = Readonly<{
  assistantTurnId: string;
  semanticMediaId: "gpt-generated-image-main";
  mediaHash: `sha256:${string}`;
  authorityTargetHash: `sha256:${string}`;
  authorityDocumentHash: `sha256:${string}`;
  canonicalConversationUrl: string;
  promptHash: `sha256:${string}`;
  turnMarker: string;
  originalBytes: Uint8Array;
  originalSha256: `sha256:${string}`;
  originalSizeBytes: number;
  originalMediaType: `image/${string}`;
  originalWidth: number;
  originalHeight: number;
  webpBytes: Uint8Array;
  sha256: `sha256:${string}`;
  bytes: number;
  mediaType: "image/webp";
  width: 1200;
  height: 630;
}>;

const hashBytes = (content: Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;
const hashValue = (value: unknown): value is `sha256:${string}` =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);

const receiptOriginValid = (
  receipt: Readonly<Record<string, unknown>>,
  original: Uint8Array,
  originalHash: string,
): boolean => receipt.schemaVersion === "agent-generated-image-receipt.v1"
  && typeof receipt.assistantTurnId === "string" && receipt.assistantTurnId.length > 0
  && receipt.semanticMediaId === "gpt-generated-image-main"
  && receipt.mediaHash === originalHash && receipt.originalSha256 === originalHash
  && receipt.originalBytes === original.byteLength
  && typeof receipt.originalMediaType === "string"
  && /^image\/[a-z0-9.+-]+$/u.test(receipt.originalMediaType);

const receiptDimensionsValid = (receipt: Readonly<Record<string, unknown>>): boolean =>
  Number.isSafeInteger(receipt.originalWidth) && Number(receipt.originalWidth) > 0
  && Number.isSafeInteger(receipt.originalHeight) && Number(receipt.originalHeight) > 0
  && receipt.width === 1200 && receipt.height === 630;

const receiptAuthorityValid = (receipt: Readonly<Record<string, unknown>>): boolean =>
  hashValue(receipt.authorityTargetHash) && hashValue(receipt.authorityDocumentHash)
  && typeof receipt.canonicalConversationUrl === "string" && receipt.canonicalConversationUrl.length > 0
  && hashValue(receipt.promptHash)
  && typeof receipt.turnMarker === "string" && receipt.turnMarker.length > 0;

const receiptWebpValid = (
  receipt: Readonly<Record<string, unknown>>,
  webp: Uint8Array,
  webpHash: string,
): boolean => receipt.webpSha256 === webpHash
  && receipt.webpBytes === webp.byteLength
  && receipt.mediaType === "image/webp";

export const readGeneratedImageArtifacts = async (input: Readonly<{
  evidenceStore: ForensicsPersistenceAbilityGroup;
  artifactRefs: readonly [string, string, string];
  receipt: Readonly<Record<string, unknown>>;
}>): Promise<GeneratedImageCheckpointArtifacts> => {
  const [originalReadback, webpReadback] = await Promise.all([
    input.evidenceStore.readArtifactRef({ childCapabilityId: "read-artifact-ref", artifactRef: input.artifactRefs[0] }),
    input.evidenceStore.readArtifactRef({ childCapabilityId: "read-artifact-ref", artifactRef: input.artifactRefs[1] }),
  ]);
  const original = originalReadback.artifact?.content;
  const webp = webpReadback.artifact?.content;
  if (originalReadback.status !== "success" || !original
    || originalReadback.artifact?.mimeType !== "application/octet-stream"
    || webpReadback.status !== "success" || !webp
    || webpReadback.artifact?.mimeType !== "image/webp") {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_RECEIPT_INVALID");
  }
  const originalHash = hashBytes(original);
  const webpHash = hashBytes(webp);
  if (!receiptOriginValid(input.receipt, original, originalHash)
    || !receiptDimensionsValid(input.receipt)
    || !receiptAuthorityValid(input.receipt)
    || !receiptWebpValid(input.receipt, webp, webpHash)) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_RECEIPT_INVALID");
  }
  return Object.freeze({
    assistantTurnId: input.receipt.assistantTurnId as string,
    semanticMediaId: "gpt-generated-image-main",
    mediaHash: originalHash,
    authorityTargetHash: input.receipt.authorityTargetHash as `sha256:${string}`,
    authorityDocumentHash: input.receipt.authorityDocumentHash as `sha256:${string}`,
    canonicalConversationUrl: input.receipt.canonicalConversationUrl as string,
    promptHash: input.receipt.promptHash as `sha256:${string}`,
    turnMarker: input.receipt.turnMarker as string,
    originalBytes: original,
    originalSha256: originalHash,
    originalSizeBytes: original.byteLength,
    originalMediaType: input.receipt.originalMediaType as `image/${string}`,
    originalWidth: Number(input.receipt.originalWidth),
    originalHeight: Number(input.receipt.originalHeight),
    webpBytes: webp,
    sha256: webpHash,
    bytes: webp.byteLength,
    mediaType: "image/webp",
    width: 1200,
    height: 630,
  });
};
