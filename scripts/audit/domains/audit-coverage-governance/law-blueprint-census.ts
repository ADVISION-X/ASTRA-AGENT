import path from "node:path";

import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { GeneratedLawRegistry } from "../../core/schema-generated-artifacts.js";
import type { ResolvedDomainManifest } from "../../core/schema-manifests.js";
import type { CoverageRequirement, RequirementTier } from "./coverage-types.js";

const BLUEPRINT_REQUIREMENT_LIMIT_PER_FILE = 12;
const BLUEPRINT_HEADING_PATTERN = /^(#{2,4})\s+(.+)$/;
const BULLET_PATTERN = /^\s*(?:[-*]|\d+[.)])\s+(.+)$/;

const toRequirementTier = (tier: string | undefined): RequirementTier => {
  if (tier === "P0" || tier === "P1" || tier === "P2" || tier === "P3") {
    return tier;
  }
  return "UNKNOWN";
};

const createLawRequirement = (law: GeneratedLawRegistry["laws"][number]): CoverageRequirement => ({
  requirementId: `${law.lawId}#REQ-001`,
  sourceType: "law",
  owner: law.capabilityDomain,
  sourceFile: law.relativeFilePath,
  sourceLawId: law.lawId,
  sourceSection: `Law ${law.lawId}`,
  sourceText: law.summary,
  tier: toRequirementTier(law.tier),
  requiredEvidence: ["inspector"],
  staticCoverage: [],
  enforcementStrength: "LEVEL_0_MANUAL_ONLY_OR_MISSING",
  coverageStatus: "missing",
  blockingReason: [],
});

const normalizeBlueprintLine = (line: string): string => line.trim().replace(/\s+/g, " ");

const isRequirementCandidate = (line: string): boolean => {
  const normalized = normalizeBlueprintLine(line);
  if (normalized.length < 12) {
    return false;
  }
  return /必须|禁止|required|must|shall|不得|不能|严禁|唯一|不得|fail|FAIL|P0|P1/i.test(normalized);
};

const createBlueprintRequirementId = (owner: string, filePath: string, index: number): string => {
  const baseName = path.basename(filePath).replace(/\.[^.]+$/, "");
  const slug = baseName
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 48) || "BLUEPRINT";
  return `${owner.toUpperCase()}-${slug}#REQ-${String(index).padStart(3, "0")}`;
};

const parseBlueprintFile = async (owner: string, blueprintFile: string): Promise<CoverageRequirement[]> => {
  const absolutePath = pathFromRepoRoot(blueprintFile);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const content = await readTextFile(absolutePath);
  const requirements: CoverageRequirement[] = [];
  let section = path.basename(blueprintFile);

  for (const [lineIndex, rawLine] of content.split("\n").entries()) {
    const headingMatch = rawLine.match(BLUEPRINT_HEADING_PATTERN);
    if (headingMatch?.[2]) {
      section = normalizeBlueprintLine(headingMatch[2]);
      continue;
    }

    const bulletMatch = rawLine.match(BULLET_PATTERN);
    const candidate = normalizeBlueprintLine(bulletMatch?.[1] ?? rawLine);
    if (!isRequirementCandidate(candidate)) {
      continue;
    }

    const tier = /P0|最高|死命令|不得|禁止|严禁|必须/.test(candidate) ? "P0" : "P1";
    const sourceFile = toRepoRelativePath(absolutePath);
    requirements.push({
      requirementId: createBlueprintRequirementId(owner, sourceFile, requirements.length + 1),
      sourceType: "blueprint",
      owner,
      sourceFile,
      sourceLawId: `${owner}#blueprint`,
      sourceSection: `${section}:${lineIndex + 1}`,
      sourceText: candidate,
      tier,
      requiredEvidence: ["inspector"],
      staticCoverage: [],
      enforcementStrength: "LEVEL_0_MANUAL_ONLY_OR_MISSING",
      coverageStatus: "missing",
      blockingReason: [],
    });

    if (requirements.length >= BLUEPRINT_REQUIREMENT_LIMIT_PER_FILE) {
      break;
    }
  }

  return requirements;
};

export const buildLawBlueprintCensus = async (input: {
  lawRegistry: GeneratedLawRegistry;
  manifests: ResolvedDomainManifest[];
}): Promise<CoverageRequirement[]> => {
  const lawRequirements = input.lawRegistry.laws.map(createLawRequirement);
  const blueprintRequirements: CoverageRequirement[] = [];

  for (const manifest of input.manifests) {
    for (const blueprintFile of manifest.readsBlueprintFiles ?? []) {
      blueprintRequirements.push(...await parseBlueprintFile(manifest.capabilityDomain, blueprintFile));
    }
  }

  return [...lawRequirements, ...blueprintRequirements].sort((left, right) =>
    left.owner.localeCompare(right.owner) || left.requirementId.localeCompare(right.requirementId),
  );
};
