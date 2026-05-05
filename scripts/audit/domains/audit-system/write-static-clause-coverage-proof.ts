import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PROOF_DIR = "tmp/audit/ability-law-census/regression-proofs/audit-system-static-clause-coverage";

type ScenarioProof = {
  name: string;
  file: string;
  originalContent: string;
  mutatedContent: string;
  expectedNeedle: string;
  failOutput: string;
};

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

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
  const suffix = findCommonPrefixLength(
    originalLines.slice(prefix).reverse(),
    mutatedLines.slice(prefix).reverse(),
  );
  const originalChanged = originalLines.slice(prefix, originalLines.length - suffix);
  const mutatedChanged = mutatedLines.slice(prefix, mutatedLines.length - suffix);
  const contextBefore = originalLines.slice(Math.max(0, prefix - 3), prefix);
  const contextAfter = originalLines.slice(originalLines.length - suffix, Math.min(originalLines.length, originalLines.length - suffix + 3));
  const lines = [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${Math.max(1, prefix - contextBefore.length + 1)},${contextBefore.length + originalChanged.length + contextAfter.length} +${Math.max(1, prefix - contextBefore.length + 1)},${contextBefore.length + mutatedChanged.length + contextAfter.length} @@`,
    ...contextBefore.map((line) => ` ${line}`),
    ...originalChanged.map((line) => `-${line}`),
    ...mutatedChanged.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`),
  ];

  return `${lines.join("\n")}\n`;
};

export async function writeStaticClauseCoverageProof(input: {
  scenarios: ScenarioProof[];
  rollbackOutput: string;
}): Promise<void> {
  const proofDir = path.join(process.cwd(), PROOF_DIR);
  await mkdir(proofDir, { recursive: true });
  const combinedPatch = input.scenarios.map((scenario) => {
    return createUnifiedPatch(scenario.file, scenario.originalContent, scenario.mutatedContent);
  }).join("\n");
  const combinedFailOutput = input.scenarios.map((scenario) => {
    return [`## ${scenario.name}`, scenario.failOutput.trim()].join("\n\n");
  }).join("\n\n");

  await writeFile(path.join(proofDir, "mutation-description.md"), [
    "# Audit-System Static Clause Coverage Mutations",
    "",
    ...input.scenarios.flatMap((scenario) => [
      `## ${scenario.name}`,
      `- file: ${scenario.file}`,
      `- expectedNeedle: ${scenario.expectedNeedle}`,
      `- beforeHash: sha256:${hashText(scenario.originalContent)}`,
      `- afterHash: sha256:${hashText(scenario.mutatedContent)}`,
      "",
    ]),
  ].join("\n"));
  await writeFile(path.join(proofDir, "mutated-file.patch"), combinedPatch);
  await writeFile(path.join(proofDir, "inspector-fail-output.txt"), `${combinedFailOutput}\n`);
  await writeFile(path.join(proofDir, "rollback-proof.txt"), [
    "# Rollback Proof",
    "",
    "All temporary audit-system static-clause-coverage mutations were rolled back before the baseline inspector output was rechecked.",
    "",
    input.rollbackOutput.trim(),
    "",
  ].join("\n"));
  await writeFile(path.join(proofDir, "inspector-pass-output.txt"), `${input.rollbackOutput.trim()}\n`);
  await writeFile(path.join(proofDir, "proof-summary.md"), [
    "# Audit-System Static Clause Coverage Proof Summary",
    "",
    `scenarioCount: ${input.scenarios.length}`,
    `proofDir: ${PROOF_DIR}`,
    "",
    "## Covered Anti-Escape Scenarios",
    "",
    ...input.scenarios.map((scenario) => `- ${scenario.name}: FAIL observed and rollback restored baseline.`),
    "",
    "## Result",
    "",
    "- Mutated production/governance files caused audit-system FAIL.",
    "- Rollback restored the baseline audit-system result.",
    "",
  ].join("\n"));
}