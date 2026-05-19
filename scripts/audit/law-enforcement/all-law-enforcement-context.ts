import { readFileSync } from "node:fs";
import { buildCiFullSteps } from "../core/ci-full-plan.js";
import { pathFromRepoRoot } from "../core/paths.js";
import { parseBlueprintClauses } from "./clause-parser.js";
import { loadOwnerInspectorVerdicts } from "./owner-verdicts.js";
import { discoverLawSources } from "./source-discovery.js";
import {
  buildGeneratedClauses,
  buildManifestClauses,
  collectLawClauses,
  collectOwnerAssignments,
} from "./all-law-enforcement-support.js";
import { buildGeneratedDrift } from "./all-law-enforcement-generated-drift.js";
import type { MatrixBuildInput } from "./all-law-enforcement-types.js";

export const prepareLawMatrixContext = async (input: MatrixBuildInput) => {
  const discovery = discoverLawSources(input.laws, input.manifests);
  const parsedLawClauses = collectLawClauses(input.laws);
  const blueprintClauses = discovery.sources
    .filter((source) => source.sourceKind === "blueprint")
    .flatMap((source) => parseBlueprintClauses(source.filePath, source.relatedLawIds));
  return {
    discovery,
    parsedLawClauses,
    blueprintClauses,
    parsedClauses: [
      ...parsedLawClauses.clauses,
      ...blueprintClauses,
      ...buildManifestClauses(input.manifests),
      ...buildGeneratedClauses(input.laws),
    ],
    ownerAssignments: collectOwnerAssignments(input.laws, input.manifests),
    generatedDrift: buildGeneratedDrift(input.laws, input.manifests),
    ownerVerdicts: await loadOwnerInspectorVerdicts(input.manifests),
    ciFullSteps: buildCiFullSteps(),
    ciFullIsUnique: readCiFullIsUnique(),
  };
};

const readCiFullIsUnique = (): boolean => {
  const packageJson = JSON.parse(readFileSync(pathFromRepoRoot("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.["ci:full"] === "node --import tsx scripts/audit/ci-full.ts";
};
