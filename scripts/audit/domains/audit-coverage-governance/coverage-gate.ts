import { writeJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { CoverageRequirement, CoverageSummary } from "./coverage-types.js";

const generatedPath = (fileName: string): string => pathFromRepoRoot(`scripts/audit/generated/${fileName}`);

const toCensusRecord = (requirement: CoverageRequirement) => ({
  ...requirement,
  staticCoverage: [],
});

const toStaticMatrixRecord = (requirement: CoverageRequirement) => ({
  requirementId: requirement.requirementId,
  owner: requirement.owner,
  sourceType: requirement.sourceType,
  tier: requirement.tier,
  staticCoverage: requirement.staticCoverage,
  coverageStatus: requirement.coverageStatus,
  blockingReason: requirement.blockingReason,
});

const toUncoveredRecord = (requirement: CoverageRequirement) => ({
  requirementId: requirement.requirementId,
  owner: requirement.owner,
  sourceType: requirement.sourceType,
  sourceFile: requirement.sourceFile,
  sourceLawId: requirement.sourceLawId,
  tier: requirement.tier,
  enforcementStrength: requirement.enforcementStrength,
  coverageStatus: requirement.coverageStatus,
  blockingReason: requirement.blockingReason,
});

export const writeCoverageArtifacts = async (input: {
  generatedAt: string;
  requirements: CoverageRequirement[];
  summary: CoverageSummary;
}): Promise<void> => {
  const enforcementStrength = input.requirements.map((requirement) => ({
    requirementId: requirement.requirementId,
    owner: requirement.owner,
    tier: requirement.tier,
    enforcementStrength: requirement.enforcementStrength,
    coverageStatus: requirement.coverageStatus,
  }));
  const uncovered = input.requirements.filter((requirement) => requirement.coverageStatus !== "covered");

  await Promise.all([
    writeJsonFile(generatedPath("law-blueprint-requirement-census.generated.json"), {
      generatedAt: input.generatedAt,
      requirements: input.requirements.map(toCensusRecord),
    }),
    writeJsonFile(generatedPath("inspector-coverage-matrix.generated.json"), {
      generatedAt: input.generatedAt,
      requirements: input.requirements.map(toStaticMatrixRecord),
    }),
    writeJsonFile(generatedPath("enforcement-strength.generated.json"), {
      generatedAt: input.generatedAt,
      requirements: enforcementStrength,
    }),
    writeJsonFile(generatedPath("uncovered-requirements.generated.json"), {
      generatedAt: input.generatedAt,
      requirements: uncovered.map(toUncoveredRecord),
    }),
    writeJsonFile(generatedPath("audit-coverage-summary.generated.json"), input.summary),
  ]);
};

export const assertCoverageGate = (summary: CoverageSummary): void => {
  if (summary.finalVerdict === "PASS") {
    return;
  }

  const detail = [
    `coverage gate mode: ${summary.coverageMode}`,
    `FINAL VERDICT: ${summary.finalVerdict}`,
    `total requirements: ${summary.totalRequirements}`,
    `weak coverage: ${summary.weakCoverage}`,
    `missing coverage: ${summary.missingCoverage}`,
    `manual-only: ${summary.manualOnly}`,
    `warning-only P0: ${summary.warningOnlyP0}`,
  ].join("\n");
  throw new Error(detail);
};
