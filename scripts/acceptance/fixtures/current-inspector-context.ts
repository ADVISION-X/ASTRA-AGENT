import type { Project } from "ts-morph";

import type { InspectorContext } from "../../audit/shared/inspector-contracts.js";

export const createInspectorContextFixture = (
  project: Project,
  capabilityDomain: string,
  lawIds: string[],
): InspectorContext => {
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
    targetSet: { queryRef: "scope:fixture#fixture:" + "0".repeat(64), count: 0, sha256: "0".repeat(64) },
    targetPaths: [],
    lawRequirements: lawIds.map((lawId) => ({
      lawId,
      clausesByMode: { "static.ast": ["summary"] },
      targetPaths: [],
      targetSet: { queryRef: `scope:${lawId}#fixture`, count: 0, sha256: "0".repeat(64) },
    })),
    planEntry,
    generatedPlan: [],
  };
};
