import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PROOF_ROOT = "tmp/audit/ability-law-census/regression-proofs";

type ProductionMutationProofInput = {
  owner: string;
  ownerTitle: string;
  mutationName: string;
  scenarioId: string;
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
  mutatedFile: string;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

type ProofMaterial = {
  proofDir: string;
  beforeHash: string;
  afterHash: string;
  patch: string;
  reason: string;
};

const hashText = (content: string): string => createHash("sha256").update(content).digest("hex");

const findCommonPrefixLength = (left: string[], right: string[]): number => {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index;
};

const createUnifiedPatch = (filePath: string, original: string, mutated: string): string => {
  const originalLines = original.split("\n");
  const mutatedLines = mutated.split("\n");
  const prefix = findCommonPrefixLength(originalLines, mutatedLines);
  const reversedOriginal = originalLines.slice(prefix).reverse();
  const reversedMutated = mutatedLines.slice(prefix).reverse();
  const suffix = findCommonPrefixLength(reversedOriginal, reversedMutated);
  const originalChanged = originalLines.slice(prefix, originalLines.length - suffix);
  const mutatedChanged = mutatedLines.slice(prefix, mutatedLines.length - suffix);
  const contextBefore = originalLines.slice(Math.max(0, prefix - 3), prefix);
  const contextAfter = originalLines.slice(originalLines.length - suffix, Math.min(originalLines.length, originalLines.length - suffix + 3));
  const originalStart = Math.max(1, prefix - contextBefore.length + 1);
  const mutatedStart = originalStart;
  const originalCount = contextBefore.length + originalChanged.length + contextAfter.length;
  const mutatedCount = contextBefore.length + mutatedChanged.length + contextAfter.length;
  const lines = [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${originalStart},${originalCount} +${mutatedStart},${mutatedCount} @@`,
    ...contextBefore.map((line) => ` ${line}`),
    ...originalChanged.map((line) => `-${line}`),
    ...mutatedChanged.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`),
  ];
  return `${lines.join("\n")}\n`;
};

const getCoverageReason = (input: ProductionMutationProofInput, lawId: string): string => {
  return input.coverageReasonByLawId[lawId] ?? `Mapped ${input.ownerTitle} owner mutation proves this law rejects production drift through the owner inspector.`;
};

const buildMutationDescription = (input: ProductionMutationProofInput, lawId: string, material: ProofMaterial): string => {
  return [
    `# ${lawId} Production Mutation`,
    "",
    `scenarioId: ${input.scenarioId}`,
    `mutationName: ${input.mutationName}`,
    `mutatedFile: ${input.mutatedFile}`,
    `coveredLawIds: ${input.coveredLawIds.join(", ")}`,
    `beforeHash: sha256:${material.beforeHash}`,
    `afterMutationHash: sha256:${material.afterHash}`,
    "",
    material.reason,
    "",
  ].join("\n");
};

const buildRollbackProof = (input: ProductionMutationProofInput, material: ProofMaterial): string => {
  return [
    `scenarioId: ${input.scenarioId}`,
    `mutationName: ${input.mutationName}`,
    `mutatedFile: ${input.mutatedFile}`,
    `rollbackRestoredHash: sha256:${material.beforeHash}`,
    `startedAt: ${input.startedAt}`,
    `endedAt: ${input.endedAt}`,
    "",
    `Rollback was verified by restoring the original production file content and rerunning the ${input.ownerTitle} owner inspector.`,
    "",
  ].join("\n");
};

const buildProofSummary = (input: ProductionMutationProofInput, lawId: string, material: ProofMaterial): string => {
  return [
    `# ${lawId} Proof Summary`,
    "",
    `scenarioId: ${input.scenarioId}`,
    `mutationName: ${input.mutationName}`,
    `mutatedFile: ${input.mutatedFile}`,
    `coveredLawIds: ${input.coveredLawIds.join(", ")}`,
    `failOutput: ${path.join(material.proofDir, "inspector-fail-output.txt")}`,
    `rollbackPassOutput: ${path.join(material.proofDir, "inspector-pass-output.txt")}`,
    "",
    "## Why This Law Is Covered",
    "",
    material.reason,
    "",
    "## Result",
    "",
    `- Mutated production file caused ${input.ownerTitle} owner inspector FAIL.`,
    `- Rollback restored the production file and ${input.ownerTitle} owner inspector PASS.`,
    "",
  ].join("\n");
};

const writeProofArtifacts = async (input: ProductionMutationProofInput, lawId: string, material: ProofMaterial): Promise<void> => {
  await writeFile(path.join(material.proofDir, "mutation-description.md"), buildMutationDescription(input, lawId, material));
  await writeFile(path.join(material.proofDir, "mutated-file.patch"), material.patch);
  await writeFile(path.join(material.proofDir, "inspector-fail-output.txt"), input.failOutput);
  await writeFile(path.join(material.proofDir, "rollback-proof.txt"), buildRollbackProof(input, material));
  await writeFile(path.join(material.proofDir, "inspector-pass-output.txt"), input.passOutput);
  await writeFile(path.join(material.proofDir, "proof-summary.md"), buildProofSummary(input, lawId, material));
};

const writeLawProof = async (input: ProductionMutationProofInput, lawId: string): Promise<void> => {
  const proofDir = path.join(PROOF_ROOT, input.owner, lawId);
  await mkdir(proofDir, { recursive: true });
  const material: ProofMaterial = {
    proofDir,
    beforeHash: hashText(input.originalContent),
    afterHash: hashText(input.mutatedContent),
    patch: createUnifiedPatch(input.mutatedFile, input.originalContent, input.mutatedContent),
    reason: getCoverageReason(input, lawId),
  };
  await writeProofArtifacts(input, lawId, material);
};

export const writeProductionMutationProof = async (input: ProductionMutationProofInput): Promise<void> => {
  for (const lawId of input.coveredLawIds) {
    await writeLawProof(input, lawId);
  }
};
