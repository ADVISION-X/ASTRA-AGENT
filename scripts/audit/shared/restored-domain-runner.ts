import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { createAuditProject } from "./project.js";
import type {
  InspectorCheckBodyResult,
  InspectorContext,
  InspectorFinding,
  SessionInspectorOutput,
} from "./inspector-contracts.js";

type CurrentManifest = { capabilityDomain: string; lawIds: string[] };
type DomainInspector = (context: InspectorContext) => Promise<SessionInspectorOutput>;

const loadPlans = (root: string): InspectorContext["generatedPlan"] => readdirSync(resolve(root, "scripts/audit/domains"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const manifestPath = `scripts/audit/domains/${entry.name}/manifest.json`;
    try {
      const manifest = JSON.parse(readFileSync(resolve(root, manifestPath), "utf8")) as CurrentManifest;
      return [{
        capabilityDomain: manifest.capabilityDomain,
        manifestPath,
        ownerInspectorPath: `scripts/audit/domains/${manifest.capabilityDomain}/inspector.ts`,
        executionGroup: manifest.capabilityDomain === "audit-system" || manifest.capabilityDomain === "audit-truth" ? "meta" as const : "foundation" as const,
        lawIds: manifest.lawIds,
        bindings: manifest.lawIds.map((lawId) => ({
          lawId,
          clauseId: `${lawId.toLowerCase()}-requirement`,
          checkIds: [`${manifest.capabilityDomain}/owner-assertion-set`],
          evidenceMode: "static" as const,
          sourceEvidence: [{ filePath: `scripts/audit/domains/${manifest.capabilityDomain}/inspector.ts`, symbolName: "inspectDomain" }],
        })),
        blueprintRefs: [],
      }];
    } catch { return []; }
  })
  .sort((left, right) => left.capabilityDomain.localeCompare(right.capabilityDomain));

export async function runRestoredDomain(domain: string, inspector: DomainInspector, root = process.cwd()): Promise<InspectorFinding[]> {
  const plans = loadPlans(root);
  const planEntry = plans.find((entry) => entry.capabilityDomain === domain);
  if (!planEntry) throw new Error(`Missing current manifest for ${domain}.`);
  let findings: readonly InspectorFinding[] = [];
  const checks: InspectorContext["checks"] = {
    run: async (_checkId: string, body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>) => body(),
    runAll: async (body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>) => {
      const result = await body(); findings = result.findings; return result;
    },
    output: (meta: Record<string, unknown> = {}) => ({
      capabilityDomain: domain, reportedLawIds: planEntry.lawIds, checkRuns: [], executedChecks: [], findings,
      inspectedFiles: [], ...meta,
    }),
  };
  const context: InspectorContext = {
    project: createAuditProject(), planEntry, generatedPlan: plans, completedReports: {}, checks,
  };
  const output = await inspector(context);
  return [...output.findings];
}
