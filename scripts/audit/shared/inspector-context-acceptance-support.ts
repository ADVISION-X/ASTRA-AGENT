import type { Project } from "ts-morph";

import type { InspectorContext } from "./inspector-contracts.js";

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
  };
  return {
    project,
    selectedLawId: lawIds[0] ?? "LAW-FIXTURE-001-V1",
    sealedRoot: process.cwd(),
    targetSet: { queryRef: "scope:fixture#fixture", count: 0 },
    targetPaths: [],
    lawRequirements: lawIds.map((lawId) => ({
      lawId,
      forbiddenCount: 32,
      requiredStaticModes: ["static.ast"],
      targetPaths: [],
      targetSet: { queryRef: `scope:${lawId}#fixture`, count: 0 },
    })),
    planEntry,
    generatedPlan: [],
  };
};
