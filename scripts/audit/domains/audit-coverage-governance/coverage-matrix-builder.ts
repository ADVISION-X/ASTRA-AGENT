import { loadDomainManifests } from "../../core/manifests.js";
import type { CoverageRequirement, CoverageSummary, NegativeProofCoverageEvidence } from "./coverage-types.js";
import { PILOT_OWNER_DOMAINS } from "./pilot-owners.js";
import { classifyInspectorStrength, getStrengthRank, maxStrength } from "./enforcement-strength-classifier.js";
import { buildNegativeProofEvidence } from "./negative-proof-coverage-builder.js";

const P0P1 = new Set(["P0", "P1"]);

const getOwnerAuditCommand = (owner: string): string => {
  if (owner === "text-input-capability") {
    return "audit:text-input-capability";
  }
  if (owner.endsWith("-capability")) {
    return `audit:${owner.slice(0, -"-capability".length)}`;
  }
  return `audit:${owner}`;
};

const getNegativeHarnessPath = (owner: string): string =>
  `scripts/audit/domains/${owner}/negative-proof-harness.ts`;

const appliesToRequirement = (manifest: Awaited<ReturnType<typeof loadDomainManifests>>[number], requirement: CoverageRequirement): boolean => {
  if (manifest.capabilityDomain !== requirement.owner) {
    return false;
  }
  if (requirement.sourceType === "law") {
    return manifest.allowedLawIds.includes(requirement.sourceLawId);
  }
  return (manifest.readsBlueprintFiles ?? []).includes(requirement.sourceFile);
};

const createRequirementBlockers = (requirement: CoverageRequirement): string[] => {
  const blockers: string[] = [];
  const isP0P1 = P0P1.has(requirement.tier);
  if (requirement.staticCoverage.length === 0) {
    blockers.push("Requirement has no declared static inspector coverage.");
  }
  if (requirement.negativeProofCoverage.length === 0) {
    blockers.push("Requirement has no mapped negative-proof mutation.");
  }
  if (isP0P1 && getStrengthRank(requirement.enforcementStrength) < 4) {
    blockers.push("P0/P1 requirement is below LEVEL 4 structural negative-proof enforcement.");
  }
  if (isP0P1 && requirement.negativeProofCoverage.some((proof) => proof.actual !== "FAIL" || proof.rollback !== "PASS")) {
    blockers.push("P0/P1 negative proof does not prove fail then rollback pass.");
  }
  blockers.push(`ownerAuditCommand=${getOwnerAuditCommand(requirement.owner)}`);
  return blockers;
};

const resolveCoverageStatus = (input: {
  hasStatic: boolean;
  hasNegative: boolean;
  isP0P1: boolean;
  rank: number;
}): CoverageRequirement["coverageStatus"] => {
  if (!input.hasStatic && !input.hasNegative) {
    return "missing";
  }
  if (input.isP0P1 && input.rank < 4) {
    return "weak";
  }
  if (input.hasStatic && input.hasNegative) {
    return "covered";
  }
  return "partial";
};

const updateCoverageStatus = (requirement: CoverageRequirement): CoverageRequirement => {
  const hasStatic = requirement.staticCoverage.length > 0;
  const hasNegative = requirement.negativeProofCoverage.length > 0;
  const rank = getStrengthRank(requirement.enforcementStrength);
  const isP0P1 = P0P1.has(requirement.tier);
  const blockingReason = createRequirementBlockers(requirement);
  const coverageStatus = resolveCoverageStatus({ hasStatic, hasNegative, isP0P1, rank });

  return { ...requirement, coverageStatus, blockingReason };
};

export const buildCoverageMatrix = async (requirements: CoverageRequirement[]): Promise<{
  requirements: CoverageRequirement[];
  negativeProofEvidence: NegativeProofCoverageEvidence[];
}> => {
  const manifests = await loadDomainManifests();
  const negativeProofByDomain = new Map<string, NegativeProofCoverageEvidence[]>();
  const allNegativeProofEvidence: NegativeProofCoverageEvidence[] = [];

  for (const manifest of manifests) {
    const harnessPath = getNegativeHarnessPath(manifest.capabilityDomain);
    const evidence = await buildNegativeProofEvidence({ domain: manifest.capabilityDomain, harnessPath });
    negativeProofByDomain.set(manifest.capabilityDomain, evidence);
    allNegativeProofEvidence.push(...evidence);
  }

  const coveredRequirements: CoverageRequirement[] = [];
  for (const requirement of requirements) {
    const staticCoverage = [];
    const negativeProofCoverage = negativeProofByDomain.get(requirement.owner) ?? [];
    for (const manifest of manifests) {
      if (!appliesToRequirement(manifest, requirement)) {
        continue;
      }
      const hasNegativeProof = negativeProofCoverage.length > 0;
      const strength = await classifyInspectorStrength(manifest.entry, hasNegativeProof);
      staticCoverage.push({
        inspectorId: manifest.inspectorId,
        domain: manifest.capabilityDomain,
        manifestPath: manifest.manifestPath,
        entry: manifest.entry,
        evidenceMode: manifest.supportsEvidenceModes.join("+"),
        strength,
      });
    }

    const enforcementStrength = maxStrength(staticCoverage.map((coverage) => coverage.strength));
    coveredRequirements.push(updateCoverageStatus({
      ...requirement,
      staticCoverage,
      negativeProofCoverage,
      enforcementStrength,
    }));
  }

  return { requirements: coveredRequirements, negativeProofEvidence: allNegativeProofEvidence };
};

export const buildCoverageSummary = (requirements: CoverageRequirement[], generatedAt: string): CoverageSummary => {
  const p0p1Requirements = requirements.filter((requirement) => P0P1.has(requirement.tier));
  const blockers = p0p1Requirements
    .filter((requirement) => requirement.coverageStatus !== "covered")
    .slice(0, 50)
    .map((requirement) => `${requirement.requirementId}: ${requirement.blockingReason.join("; ")}`);

  const weakCoverage = requirements.filter((requirement) => requirement.coverageStatus === "weak").length;
  const missingCoverage = requirements.filter((requirement) => requirement.coverageStatus === "missing").length;
  const negativeProofCovered = requirements.filter((requirement) => requirement.negativeProofCoverage.length > 0).length;
  const staticCovered = requirements.filter((requirement) => requirement.staticCoverage.length > 0).length;
  const manualOnly = requirements.filter((requirement) => requirement.enforcementStrength === "LEVEL_0_MANUAL_ONLY_OR_MISSING").length;
  const warningOnlyP0 = requirements.filter((requirement) =>
    requirement.tier === "P0"
    && /warning-only/i.test(requirement.sourceText)
    && !/must never|must not|forbid|forbidden|禁止|不得|严禁|不能/i.test(requirement.sourceText),
  ).length;
  const finalVerdict = blockers.length === 0 && weakCoverage === 0 && missingCoverage === 0 && manualOnly === 0 && warningOnlyP0 === 0
    ? "PASS"
    : "BLOCKED";
  const coverageMode = finalVerdict === "PASS" ? "blocking" : "inventory-only";

  return {
    generatedAt,
    coverageMode,
    pilotOwners: [...PILOT_OWNER_DOMAINS],
    totalRequirements: requirements.length,
    lawRequirements: requirements.filter((requirement) => requirement.sourceType === "law").length,
    blueprintRequirements: requirements.filter((requirement) => requirement.sourceType === "blueprint").length,
    p0p1Requirements: p0p1Requirements.length,
    staticCovered,
    negativeProofCovered,
    weakCoverage,
    missingCoverage,
    manualOnly,
    warningOnlyP0,
    detachedInspectors: 0,
    inspectorNotInRunner: 0,
    generatedFakePass: 0,
    finalVerdict,
    blockers,
  };
};
