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

const safeProjection = (
  proof: GptChildCapabilityProof,
  exactCallIdentityHash: `sha256:${string}`,
): Readonly<Record<string, unknown>> => Object.freeze({
  schema_version: "agent-gpt-evidence-safe.v1",
  exact_call_identity_hash: exactCallIdentityHash,
  child_capability_id: proof.childCapabilityId,
  plugin_version: proof.pluginVersion,
  action_ordinal: proof.actionOrdinal,
  execution_identity_hash: hash(proof.executionId),
  candidate_count: proof.candidateCount,
  committed_mutation: proof.committedMutation,
  postcondition_result: proof.postconditionResult,
  started_at: proof.startedAt,
  ended_at: proof.endedAt,
  source_evidence_hash: proof.evidenceHash,
});

const generatedImageArtifacts = async (value: unknown): Promise<EvidenceArtifact[]> => {
  if (!value || typeof value !== "object") throw executionFailure("failed", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  const originalLocalPath = Reflect.get(value, "originalLocalPath");
  const localPath = Reflect.get(value, "localPath");
  if (typeof originalLocalPath !== "string" || typeof localPath !== "string") {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  }
  return [
    { suffix: "original", artifactType: "other", mimeType: "application/octet-stream",
      content: new Uint8Array(await readFile(originalLocalPath)) },
    { suffix: "webp", artifactType: "other", mimeType: "image/webp",
      content: new Uint8Array(await readFile(localPath)) },
  ];
};

const evidenceArtifacts = async (
  result: GptChildCapabilityResult,
  intent: Parameters<GptAbilityGroup["execute"]>[0],
): Promise<EvidenceArtifact[]> => {
  if (result.status !== "success") return [];
  if (intent.childCapabilityId === "checkpoint_gpt_generated_image") return generatedImageArtifacts(result.value);
  return [];
};

const appendVerifiedArtifact = async (input: Readonly<{
  artifact: EvidenceArtifact;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  jobId: string;
  attemptId: string;
  executionId: string;
  exactCallIdentityHash: `sha256:${string}`;
}>): Promise<string> => {
  const appended = await input.evidenceStore.appendArtifact({
    missionId: input.jobId, runId: input.attemptId, correlationId: input.executionId,
    artifactType: input.artifact.artifactType, mimeType: input.artifact.mimeType, content: input.artifact.content,
    idempotencyKey: `gpt-call-artifact:v1:${input.exactCallIdentityHash}:${input.artifact.suffix}`,
  });
  if (appended.status !== "success" || !appended.artifactRef) {
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_APPEND_FAILED");
  }
  const readback = await input.evidenceStore.readArtifactRef({
    childCapabilityId: "read-artifact-ref", artifactRef: appended.artifactRef,
  });
  const expected = createHash("sha256").update(input.artifact.content).digest("hex");
  const actual = readback.artifact?.content
    ? createHash("sha256").update(readback.artifact.content).digest("hex") : null;
  if (readback.status !== "success" || actual !== expected) {
    throw executionFailure("failed", "EVIDENCE_ARTIFACT_READBACK_FAILED");
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
  exactCallIdentityHash: `sha256:${string}`;
}>): Promise<string> => {
  const artifactRefs: string[] = [];
  for (const artifact of await evidenceArtifacts(input.result, input.intent)) {
    artifactRefs.push(await appendVerifiedArtifact({
      artifact, evidenceStore: input.evidenceStore, jobId: input.jobId, attemptId: input.attemptId,
      executionId: input.intent.executionId, exactCallIdentityHash: input.exactCallIdentityHash,
    }));
  }
  const projection = safeProjection(input.result.proof, input.exactCallIdentityHash);
  const appended = await input.evidenceStore.appendRecord({
    missionId: input.jobId, runId: input.attemptId, stepId: input.stepId, sourceCapabilityId: "gpt",
    sourceChildCapabilityId: input.result.proof.childCapabilityId,
    recordType: input.result.proof.committedMutation === "dispatched" ? "failure" : "evidence",
    recordPayload: projection, ...(artifactRefs.length ? { artifactRefs } : {}),
    idempotencyKey: `gpt-call-evidence:v1:${input.exactCallIdentityHash}`,
    correlationId: input.intent.executionId,
    createdAt: input.result.proof.endedAt,
  });
  if (appended.status !== "success" || !appended.recordRef) throw executionFailure("failed", "EVIDENCE_APPEND_FAILED");
  const readback = await input.evidenceStore.readRecordRef({
    childCapabilityId: "read-record-ref", recordRef: appended.recordRef,
  });
  if (readback.status !== "success" || !readback.record
    || stableJsonHash(readback.record.payload) !== stableJsonHash(projection)) {
    throw executionFailure("failed", "EVIDENCE_READBACK_FAILED");
  }
  persistedEvidenceRefs.set(input.result, appended.recordRef);
  return appended.recordRef;
};
