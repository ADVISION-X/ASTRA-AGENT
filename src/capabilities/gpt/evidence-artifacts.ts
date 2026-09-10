import { createHash } from "node:crypto";

import type { GptAbilityGroup, GptChildCapabilityResult } from "./contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { GptEvidenceStorePort } from "./production-ports.js";

type EvidenceArtifact = Readonly<{
  suffix: string;
  artifactType: "ai_raw_output" | "other";
  mimeType: string;
  content: Uint8Array<ArrayBuffer>;
}>;

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const invalidImage = (): never => {
  throw executionFailure("failed", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_INVALID");
};

const imageRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  }
  return value as Readonly<Record<string, unknown>>;
};

const imageBytes = (row: Readonly<Record<string, unknown>>): Readonly<{
  original: Uint8Array<ArrayBuffer>;
  webp: Uint8Array<ArrayBuffer>;
}> => {
  if (!(row.originalBytes instanceof Uint8Array) || !(row.webpBytes instanceof Uint8Array)) invalidImage();
  const original = row.originalBytes as Uint8Array<ArrayBuffer>;
  const webp = row.webpBytes as Uint8Array<ArrayBuffer>;
  if (hash(original) !== row.originalSha256 || hash(webp) !== row.sha256
    || original.byteLength !== row.originalSizeBytes || webp.byteLength !== row.bytes) invalidImage();
  return { original, webp };
};

const assertImageIdentity = (row: Readonly<Record<string, unknown>>): void => {
  if (typeof row.assistantTurnId !== "string" || row.assistantTurnId.length === 0
    || row.semanticMediaId !== "gpt-generated-image-main"
    || typeof row.mediaHash !== "string" || row.mediaHash !== row.originalSha256
    || typeof row.canonicalConversationUrl !== "string" || row.canonicalConversationUrl.length === 0
    || typeof row.turnMarker !== "string" || row.turnMarker.length === 0) invalidImage();
};

const assertImageAuthority = (row: Readonly<Record<string, unknown>>): void => {
  if (typeof row.authorityTargetHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.authorityTargetHash)
    || typeof row.authorityDocumentHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.authorityDocumentHash)
    || typeof row.promptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.promptHash)) invalidImage();
};

const assertImageFormat = (row: Readonly<Record<string, unknown>>): void => {
  if (typeof row.originalMediaType !== "string" || !/^image\/[a-z0-9.+-]+$/u.test(row.originalMediaType)
    || !Number.isSafeInteger(row.originalWidth) || Number(row.originalWidth) < 1
    || !Number.isSafeInteger(row.originalHeight) || Number(row.originalHeight) < 1
    || row.mediaType !== "image/webp" || row.width !== 1200 || row.height !== 630) invalidImage();
};

const generatedImageArtifacts = (value: unknown): EvidenceArtifact[] => {
  const row = imageRecord(value);
  const bytes = imageBytes(row);
  assertImageIdentity(row);
  assertImageAuthority(row);
  assertImageFormat(row);
  const receipt = new TextEncoder().encode(JSON.stringify({
    schemaVersion: "agent-generated-image-receipt.v1",
    assistantTurnId: row.assistantTurnId,
    semanticMediaId: row.semanticMediaId,
    mediaHash: row.mediaHash,
    authorityTargetHash: row.authorityTargetHash,
    authorityDocumentHash: row.authorityDocumentHash,
    canonicalConversationUrl: row.canonicalConversationUrl,
    promptHash: row.promptHash,
    turnMarker: row.turnMarker,
    originalSha256: row.originalSha256,
    originalBytes: row.originalSizeBytes,
    originalMediaType: row.originalMediaType,
    originalWidth: row.originalWidth,
    originalHeight: row.originalHeight,
    webpSha256: row.sha256,
    webpBytes: row.bytes,
    mediaType: "image/webp",
    width: 1200,
    height: 630,
  }));
  return [
    { suffix: "original", artifactType: "other", mimeType: "application/octet-stream",
      content: new Uint8Array(bytes.original) },
    { suffix: "webp", artifactType: "other", mimeType: "image/webp",
      content: new Uint8Array(bytes.webp) },
    { suffix: "generated-image-receipt", artifactType: "other", mimeType: "application/json",
      content: receipt },
  ];
};

const observedResponseArtifact = (value: unknown): EvidenceArtifact => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_MISSING");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.assistantTurnId !== "string" || !row.assistantTurnId
    || typeof row.rawDomHtml !== "string" || !row.rawDomHtml
    || typeof row.rawDomHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.rawDomHash)
    || typeof row.semanticText !== "string" || !row.semanticText.trim()
    || typeof row.semanticTextHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.semanticTextHash)
    || hash(row.rawDomHtml) !== row.rawDomHash || hash(row.semanticText) !== row.semanticTextHash) {
    throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_INVALID");
  }
  return {
    suffix: "observed-response", artifactType: "ai_raw_output", mimeType: "application/json",
    content: new TextEncoder().encode(JSON.stringify({
      schemaVersion: "agent-observed-response-artifact.v1",
      assistantTurnId: row.assistantTurnId,
      rawDomHtml: row.rawDomHtml,
      rawDomHash: row.rawDomHash,
      semanticText: row.semanticText,
      semanticTextHash: row.semanticTextHash,
    })),
  };
};

const artifactsFor = (
  result: GptChildCapabilityResult,
  intent: Parameters<GptAbilityGroup["execute"]>[0],
): EvidenceArtifact[] => {
  if (result.status !== "success") return [];
  if (intent.childCapabilityId === "checkpoint_gpt_generated_image") return generatedImageArtifacts(result.value);
  if (intent.childCapabilityId === "checkpoint_gpt_text_response") return [observedResponseArtifact(result.value)];
  return [];
};

const appendArtifact = async (input: Readonly<{
  artifact: EvidenceArtifact;
  evidenceStore: GptEvidenceStorePort;
  jobId: string;
  attemptId: string;
  executionId: string;
  exactCallIdentityHash: `sha256:${string}`;
}>): Promise<string> => {
  const appended = await input.evidenceStore.appendArtifact({
    missionId: input.jobId, runId: input.attemptId, correlationId: input.executionId,
    artifactType: input.artifact.artifactType, mimeType: input.artifact.mimeType,
    content: input.artifact.content,
    idempotencyKey: `gpt-call-artifact:v1:${input.exactCallIdentityHash}:${input.artifact.suffix}`,
  });
  if (appended.status !== "success" || !appended.artifactRef) {
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_APPEND_FAILED");
  }
  const readback = await input.evidenceStore.readArtifactRef({
    artifactRef: appended.artifactRef,
  });
  const actual = readback.artifact?.content ? hash(readback.artifact.content) : null;
  if (readback.status !== "success" || actual !== hash(input.artifact.content)) {
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_READBACK_FAILED");
  }
  return appended.artifactRef;
};

export const persistGptEvidenceArtifacts = async (input: Readonly<{
  result: GptChildCapabilityResult;
  intent: Parameters<GptAbilityGroup["execute"]>[0];
  evidenceStore: GptEvidenceStorePort;
  jobId: string;
  attemptId: string;
  exactCallIdentityHash: `sha256:${string}`;
}>): Promise<readonly string[]> => {
  const refs: string[] = [];
  for (const artifact of artifactsFor(input.result, input.intent)) {
    refs.push(await appendArtifact({ ...input, artifact, executionId: input.intent.executionId }));
  }
  return Object.freeze(refs);
};
