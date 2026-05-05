import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { NegativeProofCoverageEvidence } from "./coverage-types.js";

const MUTATION_NAME_PATTERN = /name:\s*["`]([^"`]+)["`]/g;
const REQUIRED_MUTATION_PATTERN = /"([^"]+)"/g;

const extractMutationNames = (source: string): string[] => {
  const names = new Set<string>();
  for (const match of source.matchAll(MUTATION_NAME_PATTERN)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  const requiredBlock = source.match(/REQUIRED_MUTATION_NAMES[\s\S]+?as const/s)?.[0] ?? "";
  for (const match of requiredBlock.matchAll(REQUIRED_MUTATION_PATTERN)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
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
  const mutationNames = extractMutationNames(source);
  if (mutationNames.length === 0) {
    return [{
      negativeProofId: `${input.domain.toUpperCase()}-NEGATIVE-PROOF-HARNESS`,
      domain: input.domain,
      harnessPath: input.harnessPath,
      mutation: "harness present but no static mutation names were discovered",
      expected: "FAIL",
      actual: "UNKNOWN",
      rollback: "UNKNOWN",
    }];
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
