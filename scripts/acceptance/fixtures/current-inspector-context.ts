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
    planEntry,
    generatedPlan: [],
    completedReports: {},
    checks: {
      run: async (_checkId, body) => runBody(body),
      runAll: runBody,
      output: (meta = {}) => ({
        capabilityDomain,
        reportedLawIds: lawIds,
        checkRuns: [],
        executedChecks: [],
        findings,
        inspectedFiles: [],
        ...meta,
      }),
    },
  };
};
