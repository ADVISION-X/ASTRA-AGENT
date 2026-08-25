import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

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
export type StaticLawRoute = Readonly<{
  lawId: string;
  forbiddenCount: number;
  checkIds: readonly string[];
}>;

const routedClauses = (route: StaticLawRoute): string[] => [
  ...Array.from({ length: route.forbiddenCount }, (_, index) => `forbidden:${index}`),
  "summary",
].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));

const consumeTargetSet = (context: InspectorContext, requirement: InspectorLawRequirement): string[] => {
  const root = resolve(context.sealedRoot);
  for (const path of requirement.targetPaths) {
    const absolute = resolve(root, path);
    const escaped = relative(root, absolute);
    if (escaped === ".." || escaped.startsWith("../")) fail("TARGET_OUTSIDE_DOMAIN_AUTHORITY", path);
    try { readFileSync(absolute); }
    catch { fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${requirement.lawId}:${path}`); }
  }
  return [...requirement.targetPaths];
};

export const finalizeStaticInspection = (
  context: InspectorContext,
  evaluation: InspectorEvaluation,
  routes: readonly StaticLawRoute[],
): InspectorOutput => {
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  if (JSON.stringify(ordered(routes.map((route) => route.lawId))) !== JSON.stringify(requiredIds)
    || routes.some((route) => !Number.isInteger(route.forbiddenCount) || route.forbiddenCount < 1
      || !route.checkIds.length || route.checkIds.some((checkId) => !/^[a-z0-9-]+\/[a-z0-9-]+$/u.test(checkId)))) {
    fail("LAW_CHECK_ROUTE_MISSING", context.planEntry.capabilityDomain);
  }
  const routesByLaw = new Map(routes.map((route) => [route.lawId, route]));
  const declaredInspected = new Set(evaluation.inspectedFiles);
  if (declaredInspected.size !== evaluation.inspectedFiles.length
    || JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(ordered(evaluation.inspectedFiles))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:inspection-order`);
  }
  const consumed = new Set<string>();
  const lawResults = context.lawRequirements.map((requirement) => {
    const route = routesByLaw.get(requirement.lawId) ?? fail("LAW_CHECK_ROUTE_MISSING", requirement.lawId);
    const requiredClauses = ordered(Object.values(requirement.clausesByMode).flat());
    if (JSON.stringify(routedClauses(route)) !== JSON.stringify(requiredClauses)) {
      fail("LAW_CHECK_ROUTE_MISSING", `${requirement.lawId}:clause`);
    }
    for (const path of consumeTargetSet(context, requirement)) consumed.add(path);
    const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
    return {
      lawId: requirement.lawId,
      assertions: Object.entries(requirement.clausesByMode).map(([mode, clauses]) => ({
        clauses,
        evidenceMode: mode,
        passed: findings.length === 0,
        refs: ordered([
          ...clauses.flatMap((clause) => route.checkIds.map((checkId) =>
            `${evidenceKind[mode] ?? "file"}:${context.planEntry.ownerInspectorPath}#${encodeURIComponent(`checkId=${checkId};clause=${clause};mode=${mode};targetCount=${requirement.targetSet.count};targetSetSha256=${requirement.targetSet.sha256}`)}`)),
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
    inspectedFiles: ordered([...evaluation.inspectedFiles, ...consumed]),
  };
};
