import type { Project } from "ts-morph";

import type {
  InspectorCheckBodyResult,
  InspectorContext,
  InspectorFinding,
} from "../../audit/shared/inspector-contracts.js";

export const createInspectorContextFixture = (
  project: Project,
  capabilityDomain: string,
  lawIds: string[],
): InspectorContext => {
  let findings: readonly InspectorFinding[] = [];
  const planEntry: InspectorContext["planEntry"] = {
    capabilityDomain,
    manifestPath: `scripts/audit/domains/${capabilityDomain}/manifest.json`,
    ownerInspectorPath: `scripts/audit/domains/${capabilityDomain}/inspector.ts`,
    executionGroup: "foundation",
    lawIds,
    bindings: [],
    blueprintRefs: [],
  };
  const runBody = async (
    body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>,
  ): Promise<InspectorCheckBodyResult> => {
    const result = await body();
    findings = result.findings;
    return result;
  };
  return {
    project,
    selectedLawId: lawIds[0] ?? "LAW-FIXTURE-001-V1",
    sealedRoot: process.cwd(),
    targetSet: { queryRef: "scope:fixture#fixture:" + "0".repeat(64), count: 0, sha256: "0".repeat(64) },
    targetPaths: [],
    planEntry,
    generatedPlan: [],
    checks: {
      run: async (_checkId, body) => runBody(body),
      runAll: runBody,
      output: () => ({
        capabilityDomain,
        reportedLawIds: lawIds,
        checkRuns: [],
        lawResults: lawIds.map((lawId) => ({ lawId, assertions: [], findings: findings.filter((finding) => finding.lawId === lawId) })),
        inspectedFiles: [],
      }),
    },
  };
};
