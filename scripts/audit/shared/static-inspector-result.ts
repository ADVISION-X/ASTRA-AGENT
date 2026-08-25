import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorEvaluation, InspectorLawRequirement, InspectorOutput,
} from "./inspector-contracts.js";

const evidenceKind: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const proofTarget = (requirement: InspectorLawRequirement, inspected: ReadonlySet<string>, owner: string): string =>
  requirement.targetPaths.find((path) => inspected.has(path)) ?? owner;

export const finalizeStaticInspection = (
  context: InspectorContext,
  evaluation: InspectorEvaluation,
  supportedLawIds: readonly string[],
): InspectorOutput => {
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  if (JSON.stringify(ordered(supportedLawIds)) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_ROUTE_MISSING", context.planEntry.capabilityDomain);
  }
  const inspected = new Set(evaluation.inspectedFiles);
  const lawResults = context.lawRequirements.map((requirement) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
    const checkId = `${context.planEntry.capabilityDomain}/${requirement.lawId.toLowerCase()}`;
    const target = proofTarget(requirement, inspected, context.planEntry.ownerInspectorPath);
    return {
      lawId: requirement.lawId,
      assertions: Object.entries(requirement.clausesByMode).map(([mode, clauses]) => ({
        clauses,
        evidenceMode: mode,
        passed: findings.length === 0,
        refs: ordered([
          `${evidenceKind[mode] ?? "file"}:${context.planEntry.ownerInspectorPath}#${encodeURIComponent(`checkId=${checkId};mode=${mode};target=${target}`)}`,
          requirement.targetSet.queryRef,
        ]),
      })),
      findings,
    };
  });
  return {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: requiredIds,
    lawResults,
    inspectedFiles: ordered(evaluation.inspectedFiles),
  };
};
