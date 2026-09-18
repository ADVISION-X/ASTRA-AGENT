import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Project } from "ts-morph";

import { persistGptEvidenceArtifacts } from "../evidence-artifacts.js";
import type { GptEvidenceStorePort } from "../production-ports.js";
import { inspectGeneratedImageRawBoundary } from
  "../../../../scripts/audit/domains/gpt/gpt-provider-contract-inspection.js";
import { conversationUrl } from "./gpt-conversation-fixture.js";

const original = new Uint8Array([1, 2, 3, 4, 5]);
const originalHash = `sha256:${createHash("sha256").update(original).digest("hex")}` as const;
const resultValue = {
  assistantTurnId: "conversation-turn-6", semanticMediaId: "gpt-generated-image-main",
  mediaHash: originalHash, authorityTargetHash: `sha256:${"1".repeat(64)}`,
  authorityDocumentHash: `sha256:${"2".repeat(64)}`,
  canonicalConversationUrl: conversationUrl, turnMarker: "image-turn",
  originalBytes: original, originalSha256: originalHash,
  originalSizeBytes: original.byteLength, originalMediaType: "image/png",
};
const intent = { executionId: "execution-image", childCapabilityId: "checkpoint_gpt_generated_image" } as never;

const persistWith = (evidenceStore: GptEvidenceStorePort, suffix: string, value: unknown = resultValue) =>
  persistGptEvidenceArtifacts({
    result: { status: "success", value } as never, intent, evidenceStore,
    jobId: "job-image", attemptId: "attempt-image",
    exactCallIdentityHash: `sha256:${suffix.repeat(64)}` as `sha256:${string}`,
  });

const verifyOriginalPersistence = async (): Promise<void> => {
  const appended: Array<Readonly<{ artifactType: string; mimeType?: string; content?: string | Uint8Array }>> = [];
  const store: GptEvidenceStorePort = {
    appendArtifact: async (input) => {
      appended.push(input);
      return { status: "success", artifactRef: "artifact:image-original" };
    },
    readArtifact: async () => ({ status: "success", artifactRef: "artifact:image-original",
      artifact: { content: original, mimeType: "image/png", integrityHash: originalHash } }),
  };
  assert.deepEqual(await persistWith(store, "3"), ["artifact:image-original"]);
  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.artifactType, "ai_raw_output");
  assert.equal(appended[0]?.mimeType, "image/png");
  assert.deepEqual(appended[0]?.content, original);
  await assert.rejects(() => persistWith(store, "4", { ...resultValue, originalBytes: new Uint8Array([9]) }),
    /GPT_GENERATED_IMAGE_TASK_ARTIFACT_INVALID/u);
  assert.equal(appended.length, 1, "tampered original bytes must fail before a second artifact append");
  await assert.rejects(() => persistWith({
    appendArtifact: async () => ({ status: "failed", failureReason: "FORENSICS_WRITE_FAILED" }),
    readArtifact: async () => ({ status: "failed", failureReason: "FORENSICS_ARTIFACT_NOT_FOUND" }),
  }, "5"), /EVIDENCE_ARTIFACT_APPEND_FAILED/u);
  await assert.rejects(() => persistWith({
    appendArtifact: async () => ({ status: "success", artifactRef: "artifact:image-read-failure" }),
    readArtifact: async () => ({ status: "failed", failureReason: "FORENSICS_READ_FAILED" }),
  }, "6"), /EVIDENCE_ARTIFACT_READBACK_FAILED/u);
  for (const [suffix, mimeType, integrityHash] of [
    ["7", "image/jpeg", originalHash],
    ["8", "image/png", "invalid-integrity-hash"],
  ] as const) await assert.rejects(() => persistWith({
    appendArtifact: async () => ({ status: "success", artifactRef: `artifact:image-${suffix}` }),
    readArtifact: async () => ({ status: "success", artifactRef: `artifact:image-${suffix}`,
      artifact: { content: original, mimeType, integrityHash } }),
  }, suffix), /EVIDENCE_ARTIFACT_READBACK_FAILED/u);
};

const rawOnlyFindingCount = (mutate: (project: Project) => void): number => {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  mutate(project);
  const findings: Parameters<typeof inspectGeneratedImageRawBoundary>[1] = [];
  inspectGeneratedImageRawBoundary({ project, sealedRoot: process.cwd() } as never, findings,
    ((checkId: string, filePath: string, message: string) => ({ checkId, filePath, message })) as never);
  return findings.filter((finding) => finding.checkId === "gpt/generated-image-raw-only").length;
};

/** One authenticated original-byte raw artifact is persisted and the AST boundary rejects settlement drift. */
export const verifyGeneratedImageEvidenceBoundary = async (): Promise<void> => {
  await verifyOriginalPersistence();
  assert.equal(rawOnlyFindingCount(() => undefined), 0,
    "the current GPT original-image boundary must pass before mutation checks run");
  assert.ok(rawOnlyFindingCount((project) => {
    const settlement = project.getSourceFileOrThrow(resolve("src/capabilities/gpt/production-child-result.ts"));
    settlement.replaceWithText(settlement.getFullText().replace("row.originalSha256", "row.sha256"));
  }) > 0, "the GPT AST inspector must reject settlement against the retired sha256 field");
};
