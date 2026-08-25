import type { Project } from "ts-morph";

import { buildRegistry } from "../../audit/governance-authority.js";
import type { InspectorContext } from "../../audit/shared/inspector-contracts.js";
import { staticLawSemanticDigest } from "../../audit/shared/static-inspector-result.js";

export const createInspectorContextFixture = (
  project: Project,
  capabilityDomain: string,
  lawIds: string[],
): InspectorContext => {
  const laws = new Map(buildRegistry().laws.map((law) => [law.lawId, law]));
  const planEntry: InspectorContext["planEntry"] = {
    capabilityDomain,
    manifestPath: `scripts/audit/domains/${capabilityDomain}/manifest.json`,
    ownerInspectorPath: `scripts/audit/domains/${capabilityDomain}/inspector.ts`,
    executionGroup: "foundation",
    lawIds,
    bindings: [],
    blueprintRefs: [],
  };
  return {
    project,
    selectedLawId: lawIds[0] ?? "LAW-FIXTURE-001-V1",
    sealedRoot: process.cwd(),
    targetSet: { queryRef: "scope:fixture#fixture", count: 0 },
    targetPaths: [],
    lawRequirements: lawIds.map((lawId) => ({
      lawId,
      semanticDigest: staticLawSemanticDigest(laws.get(lawId)!.summary, laws.get(lawId)!.forbidden),
      forbiddenCount: laws.get(lawId)!.forbidden.length,
      clausesByMode: { "static.ast": ["summary"] },
      targetPaths: [],
      targetSet: { queryRef: `scope:${lawId}#fixture`, count: 0 },
    })),
    planEntry,
    generatedPlan: [],
  };
};
