import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
  GptAbilityGroup,
  GptChildCapabilityProof,
  GptChildCapabilityResult,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { executionFailure } from "../../typed-failure.js";
import { stableJsonHash } from "../../storage/hash.js";

type EvidenceArtifact = Readonly<{
  suffix: string;
  artifactType: "ai_raw_output" | "ai_json_output" | "other";
  mimeType: string;
  content: Uint8Array<ArrayBuffer>;
}>;

export const childFailureEventIds = new WeakMap<object, string>();
export const persistedEvidenceRefs = new WeakMap<object, string>();

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const safeProjection = (proof: GptChildCapabilityProof): Readonly<Record<string, unknown>> => Object.freeze({
  schema_version: "agent-gpt-evidence-safe.v1",
  child_capability_id: proof.childCapabilityId,
  execution_identity_hash: hash(proof.executionId),
  candidate_count: proof.candidateCount,
  committed_mutation: proof.committedMutation,
  postcondition_result: proof.postconditionResult,
  started_at: proof.startedAt,
  ended_at: proof.endedAt,
  source_evidence_hash: proof.evidenceHash,
});

const generatedImageArtifacts = async (value: unknown): Promise<EvidenceArtifact[]> => {
  if (!value || typeof value !== "object") throw executionFailure("review_required", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  const originalLocalPath = Reflect.get(value, "originalLocalPath");
  const localPath = Reflect.get(value, "localPath");
  if (typeof originalLocalPath !== "string" || typeof localPath !== "string") {
    throw executionFailure("review_required", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  }
  return [
    { suffix: "original", artifactType: "other", mimeType: "application/octet-stream",
      content: new Uint8Array(await readFile(originalLocalPath)) },
    { suffix: "webp", artifactType: "other", mimeType: "image/webp",
      content: new Uint8Array(await readFile(localPath)) },
  ];
};

const responseArtifact = (intent: Parameters<GptAbilityGroup["execute"]>[0]): EvidenceArtifact[] => {
  const raw = intent.input.rawText;
  const mime = intent.input.mediaType;
  if (typeof raw !== "string" || (mime !== "application/json" && mime !== "text/html")) return [];
  return [{
    suffix: "response",
    artifactType: mime === "application/json" ? "ai_json_output" : "ai_raw_output",
    mimeType: mime,
    content: new Uint8Array(Buffer.from(raw, "utf8")),
  }];
};

const evidenceArtifacts = async (
  result: GptChildCapabilityResult,
  intent: Parameters<GptAbilityGroup["execute"]>[0],
): Promise<EvidenceArtifact[]> => {
  if (result.status !== "success") return [];
  if (intent.childCapabilityId === "checkpoint_gpt_generated_image") return generatedImageArtifacts(result.value);
  return intent.childCapabilityId === "capture_gpt_response_artifact" ? responseArtifact(intent) : [];
};

const appendVerifiedArtifact = async (input: Readonly<{
  artifact: EvidenceArtifact;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  jobId: string;
  attemptId: string;
  executionId: string;
  evidenceHash: string;
}>): Promise<string> => {
  const appended = await input.evidenceStore.appendArtifact({
    missionId: input.jobId, runId: input.attemptId, correlationId: input.executionId,
    artifactType: input.artifact.artifactType, mimeType: input.artifact.mimeType, content: input.artifact.content,
    idempotencyKey: `${input.evidenceHash}:${input.artifact.suffix}`,
  });
  if (appended.status !== "success" || !appended.artifactRef) {
    throw executionFailure("review_required", "EVIDENCE_ARTIFACT_APPEND_FAILED");
  }
  const readback = await input.evidenceStore.readArtifactRef({
    childCapabilityId: "read-artifact-ref", artifactRef: appended.artifactRef,
  });
  const expected = createHash("sha256").update(input.artifact.content).digest("hex");
  const actual = readback.artifact?.content
    ? createHash("sha256").update(readback.artifact.content).digest("hex") : null;
  if (readback.status !== "success" || actual !== expected) {
    throw executionFailure("review_required", "EVIDENCE_ARTIFACT_READBACK_FAILED");
  }
  return appended.artifactRef;
};

export const persistGptChildEvidence = async (input: Readonly<{
  result: GptChildCapabilityResult;
  intent: Parameters<GptAbilityGroup["execute"]>[0];
  evidenceStore: ForensicsPersistenceAbilityGroup;
  jobId: string;
  attemptId: string;
  stepId: string;
}>): Promise<string> => {
  const artifactRefs: string[] = [];
  for (const artifact of await evidenceArtifacts(input.result, input.intent)) {
    artifactRefs.push(await appendVerifiedArtifact({
      artifact, evidenceStore: input.evidenceStore, jobId: input.jobId, attemptId: input.attemptId,
      executionId: input.intent.executionId, evidenceHash: input.result.proof.evidenceHash,
    }));
  }
  const projection = safeProjection(input.result.proof);
  const appended = await input.evidenceStore.appendRecord({
    missionId: input.jobId, runId: input.attemptId, stepId: input.stepId, sourceCapabilityId: "gpt",
    sourceChildCapabilityId: input.result.proof.childCapabilityId,
    recordType: input.result.proof.committedMutation === "dispatched" ? "review_required" : "evidence",
    recordPayload: projection, ...(artifactRefs.length ? { artifactRefs } : {}),
    idempotencyKey: input.result.proof.evidenceHash, correlationId: input.intent.executionId,
    createdAt: input.result.proof.endedAt,
  });
  if (appended.status !== "success" || !appended.recordRef) throw executionFailure("review_required", "EVIDENCE_APPEND_FAILED");
  const readback = await input.evidenceStore.readRecordRef({
    childCapabilityId: "read-record-ref", recordRef: appended.recordRef,
  });
  if (readback.status !== "success" || !readback.record
    || stableJsonHash(readback.record.payload) !== stableJsonHash(projection)) {
    throw executionFailure("review_required", "EVIDENCE_READBACK_FAILED");
  }
  persistedEvidenceRefs.set(input.result, appended.recordRef);
  return appended.recordRef;
};
