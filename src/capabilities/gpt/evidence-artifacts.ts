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
type TextResponse = Extract<GptChildCapabilityResult<"checkpoint_gpt_text_response">,
  { status: "success" }>["value"];

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

const imageBytes = (row: Readonly<Record<string, unknown>>): Uint8Array<ArrayBuffer> => {
  if (!(row.originalBytes instanceof Uint8Array)) invalidImage();
  const original = row.originalBytes as Uint8Array<ArrayBuffer>;
  if (hash(original) !== row.originalSha256
    || original.byteLength !== row.originalSizeBytes) invalidImage();
  return original;
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
    || typeof row.authorityDocumentHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.authorityDocumentHash)) invalidImage();
};

const assertImageFormat = (row: Readonly<Record<string, unknown>>): void => {
  if (typeof row.originalMediaType !== "string" || !/^image\/[a-z0-9.+-]+$/u.test(row.originalMediaType)) invalidImage();
};

const generatedImageArtifacts = (value: unknown): EvidenceArtifact[] => {
  const row = imageRecord(value);
  const original = imageBytes(row);
  assertImageIdentity(row);
  assertImageAuthority(row);
  assertImageFormat(row);
  return [
    { suffix: "original", artifactType: "ai_raw_output", mimeType: row.originalMediaType as string,
      content: new Uint8Array(original) },
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

const artifactKey = (exactCallIdentityHash: `sha256:${string}`, suffix: string): string =>
  `gpt-call-artifact:v1:${exactCallIdentityHash}:${suffix}`;

export const readPersistedGptTextResponse = async (input: Readonly<{
  evidenceStore: GptEvidenceStorePort;
  jobId: string;
  attemptId: string;
  exactCallIdentityHash: `sha256:${string}`;
}>): Promise<Readonly<{ artifactRef: string; integrityHash: `sha256:${string}`;
  value: TextResponse }> | null> => {
  const read = await input.evidenceStore.readArtifact({ missionId: input.jobId,
    runId: input.attemptId, idempotencyKey: artifactKey(input.exactCallIdentityHash, "observed-response") });
  if (read.status !== "success") {
    if (read.failureReason === "FORENSICS_ARTIFACT_NOT_FOUND") return null;
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_READBACK_FAILED");
  }
  if (!read.artifactRef || read.artifact?.mimeType !== "application/json"
    || !/^sha256:[a-f0-9]{64}$/u.test(read.artifact.integrityHash)) {
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_READBACK_FAILED");
  }
  let row: unknown;
  try { row = JSON.parse(new TextDecoder().decode(read.artifact.content)); }
  catch { throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_INVALID"); }
  if (!row || typeof row !== "object" || Array.isArray(row)
    || Object.keys(row).sort().join("|") !== "assistantTurnId|rawDomHash|rawDomHtml|schemaVersion|semanticText|semanticTextHash"
    || (row as Record<string, unknown>).schemaVersion !== "agent-observed-response-artifact.v1") {
    throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_INVALID");
  }
  observedResponseArtifact(row);
  const { schemaVersion: _schemaVersion, ...response } = row as Record<string, unknown>;
  return Object.freeze({ artifactRef: read.artifactRef,
    integrityHash: read.artifact.integrityHash as `sha256:${string}`,
    value: Object.freeze(response) as TextResponse });
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
    idempotencyKey: artifactKey(input.exactCallIdentityHash, input.artifact.suffix),
  });
  if (appended.status !== "success" || !appended.artifactRef) {
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_APPEND_FAILED");
  }
  const readback = await input.evidenceStore.readArtifact({ missionId: input.jobId,
    runId: input.attemptId, idempotencyKey: artifactKey(input.exactCallIdentityHash, input.artifact.suffix) });
  const expectedHash = hash(input.artifact.content);
  if (readback.status !== "success"
    || readback.artifactRef !== appended.artifactRef
    || readback.artifact.mimeType !== input.artifact.mimeType
    || !/^sha256:[a-f0-9]{64}$/u.test(readback.artifact.integrityHash)
    || hash(readback.artifact.content) !== expectedHash) {
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
