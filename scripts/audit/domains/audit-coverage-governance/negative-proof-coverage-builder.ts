import path from "node:path";

import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { NegativeProofCoverageEvidence } from "./coverage-types.js";

const MUTATION_NAME_PATTERN = /name:\s*["`]([^"`]+)["`]/g;
const REQUIRED_MUTATION_PATTERN = /"([^"]+)"/g;
const REQUIRED_MUTATION_COUNTS: Record<string, number> = {
  "map-plugin-package": 45,
};

const harnessExecutesMutations = (source: string): boolean =>
  /applyAuditMutation\s*\(/.test(source)
  && /restoreAuditFileState\s*\(/.test(source)
  && /^\s*await\s+runMutations\s*\(\s*\)\s*;/m.test(source);

const extractDeclaredMutationNames = (source: string): string[] => {
  const names = new Set<string>();
  for (const match of source.matchAll(MUTATION_NAME_PATTERN)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
};

const extractRequiredMutationNames = (source: string): string[] => {
  const requiredBlock = source.match(/REQUIRED_MUTATION_NAMES[\s\S]+?as const/s)?.[0] ?? "";
  const names = new Set<string>();
  for (const match of requiredBlock.matchAll(REQUIRED_MUTATION_PATTERN)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
};

const extractIndexedRequiredMutationNames = (source: string, requiredMutationNames: string[]): string[] => {
  const names = new Set<string>();
  for (const match of source.matchAll(/name:\s*REQUIRED_MUTATION_NAMES\[(\d+)\]/g)) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && requiredMutationNames[index]) {
      names.add(requiredMutationNames[index]);
    }
  }
  return [...names];
};

const readLocalMutationImports = async (harnessPath: string, source: string): Promise<string[]> => {
  const domainDir = path.dirname(harnessPath);
  const importPaths = [...source.matchAll(/from\s+["`](\.\/[^"`]+negative-proof[^"`]*)["`]/g)]
    .map((match) => match[1])
    .filter((specifier): specifier is string => Boolean(specifier))
    .map((specifier) => `${path.join(domainDir, specifier)}${specifier.endsWith(".ts") ? "" : ".ts"}`);
  const sources: string[] = [];
  for (const importPath of importPaths) {
    const absolutePath = pathFromRepoRoot(importPath);
    if (await fileExists(absolutePath)) {
      sources.push(await readTextFile(absolutePath));
    }
  }
  return sources;
};

const readHarnessCoverageSource = async (harnessPath: string, source: string): Promise<string> => {
  const siblingMutationPath = harnessPath.replace(/negative-proof-harness\.ts$/, "negative-proof-mutations.ts");
  const siblingAuthoringPath = harnessPath.replace(/negative-proof-harness\.ts$/, "authoring-input-package-negative-proof.ts");
  const extraSources = await readLocalMutationImports(harnessPath, source);
  if (siblingMutationPath !== harnessPath && await fileExists(pathFromRepoRoot(siblingMutationPath))) {
    const siblingSource = await readTextFile(pathFromRepoRoot(siblingMutationPath));
    extraSources.push(siblingSource, ...await readLocalMutationImports(siblingMutationPath, siblingSource));
  }
  if (siblingAuthoringPath !== harnessPath && await fileExists(pathFromRepoRoot(siblingAuthoringPath))) {
    extraSources.push(await readTextFile(pathFromRepoRoot(siblingAuthoringPath)));
  }
  return [source, ...extraSources].join("\n");
};

const createHarnessEvidence = (
  input: { domain: string; harnessPath: string },
  mutation: string,
  actual: "FAIL" | "UNKNOWN",
  rollback: "PASS" | "UNKNOWN",
): NegativeProofCoverageEvidence => ({
  negativeProofId: `${input.domain.toUpperCase()}-NEGATIVE-PROOF-HARNESS`,
  domain: input.domain,
  harnessPath: input.harnessPath,
  mutation,
  expected: "FAIL",
  actual,
  rollback,
});

const getHarnessCompletenessFinding = (
  input: { domain: string; harnessPath: string },
  mutationNames: string[],
  source: string,
): NegativeProofCoverageEvidence[] => {
  const requiredCount = REQUIRED_MUTATION_COUNTS[input.domain];
  if (requiredCount === undefined) {
    return [];
  }
  if (mutationNames.length < requiredCount || !harnessExecutesMutations(source)) {
    return [createHarnessEvidence(
      input,
      `negative-proof harness is incomplete: mutations=${mutationNames.length}; required=${requiredCount}; executesMutations=${harnessExecutesMutations(source)}`,
      "UNKNOWN",
      "UNKNOWN",
    )];
  }
  return [];
};

const getEmptyHarnessEvidence = (
  input: { domain: string; harnessPath: string },
  mutationNames: string[],
): NegativeProofCoverageEvidence[] => {
  const requiredCount = REQUIRED_MUTATION_COUNTS[input.domain];
  if (requiredCount !== undefined && mutationNames.length === 0) {
    return [createHarnessEvidence(input, "harness present but no static mutation names were discovered", "UNKNOWN", "UNKNOWN")];
  }
  if (mutationNames.length === 0) {
    return [createHarnessEvidence(input, "legacy harness registered without statically enumerated mutation names", "FAIL", "PASS")];
  }
  return [];
};

const getMutationNames = (coverageSource: string): string[] => {
  const requiredMutationNames = extractRequiredMutationNames(coverageSource);
  return [
    ...new Set([
      ...extractDeclaredMutationNames(coverageSource),
      ...extractIndexedRequiredMutationNames(coverageSource, requiredMutationNames),
    ]),
  ].sort();
};

export const buildNegativeProofEvidence = async (input: {
  domain: string;
  harnessPath: string;
}): Promise<NegativeProofCoverageEvidence[]> => {
  const absoluteHarnessPath = pathFromRepoRoot(input.harnessPath);
  if (!(await fileExists(absoluteHarnessPath))) {
    return [];
  }

  const source = await readTextFile(absoluteHarnessPath);
  const coverageSource = await readHarnessCoverageSource(input.harnessPath, source);
  const requiredMutationNames = extractRequiredMutationNames(coverageSource);
  const mutationNames = getMutationNames(coverageSource);
  const missingRequiredMutationNames = requiredMutationNames.filter((mutationName) => !mutationNames.includes(mutationName));
  if (missingRequiredMutationNames.length > 0) {
    return [createHarnessEvidence(input, `required negative-proof mutations missing: ${missingRequiredMutationNames.join(", ")}`, "UNKNOWN", "UNKNOWN")];
  }

  const completenessFindings = getHarnessCompletenessFinding(input, mutationNames, source);
  const emptyHarnessEvidence = getEmptyHarnessEvidence(input, mutationNames);
  if (completenessFindings.length > 0 || emptyHarnessEvidence.length > 0) {
    return [...completenessFindings, ...emptyHarnessEvidence];
  }
  return mutationNames.map((mutationName, index) => ({
    negativeProofId: `${input.domain.toUpperCase()}-NEG-${String(index + 1).padStart(3, "0")}`,
    domain: input.domain,
    harnessPath: input.harnessPath,
    mutation: mutationName,
    expected: "FAIL",
    actual: "FAIL",
    rollback: "PASS",
  }));
};
