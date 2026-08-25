import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorEvaluation, InspectorLawRequirement, InspectorLawResult, InspectorOutput,
} from "./inspector-contracts.js";
import { inspectTargetObjects } from "./static-target-object-inspector.js";

const evidenceKind: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
export type StaticLawRoute = Readonly<{ lawId: string }>;
export type StaticInspectorExecutor = (context: InspectorContext) => InspectorEvaluation | Promise<InspectorEvaluation>;

const validateStaticRoutes = (context: InspectorContext, routes: readonly StaticLawRoute[]): string[] => {
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  if (JSON.stringify(ordered(routes.map((route) => route.lawId))) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_ROUTE_MISSING", context.planEntry.capabilityDomain);
  }
  for (const requirement of context.lawRequirements) {
    const requiredClauses = ordered(Object.values(requirement.clausesByMode).flat());
    const availableClauses = ordered([
      ...Array.from({ length: requirement.forbiddenCount }, (_, index) => `forbidden:${index}`), "summary",
    ]);
    if (!Number.isInteger(requirement.forbiddenCount) || requirement.forbiddenCount < 1
      || !requiredClauses.includes("summary") || requiredClauses.some((clause) => !availableClauses.includes(clause))) {
      fail("LAW_CHECK_ROUTE_MISSING", `${requirement.lawId}:clause`);
    }
  }
  return requiredIds;
};

const validateStaticEvaluation = (
  context: InspectorContext, evaluation: InspectorEvaluation, requiredIds: readonly string[],
  requiredTargets: readonly string[],
): void => {
  inspectTargetObjects(context, requiredTargets);
  if (evaluation.capabilityDomain !== context.planEntry.capabilityDomain
    || JSON.stringify(evaluation.reportedLawIds) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:result`);
  }
  if (!Array.isArray(evaluation.findings)
    || evaluation.findings.some((finding) => !requiredIds.includes(finding.lawId))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:findings`);
  }
  const declaredInspected = new Set(evaluation.inspectedFiles);
  if (declaredInspected.size !== evaluation.inspectedFiles.length
    || JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(ordered(evaluation.inspectedFiles))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:inspection-order`);
  }
  if (JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(requiredTargets)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:target-denominator`);
  }
};

const targetRefs = (
  requirement: InspectorLawRequirement, evidenceMode: string, clauses: readonly string[],
): string[] => ordered([
  ...requirement.targetPaths.map((path) =>
    `${evidenceKind[evidenceMode] ?? "file"}:${path}#${encodeURIComponent(`lawId=${requirement.lawId};mode=${evidenceMode};clauses=${clauses.join(",")}`)}`),
  requirement.targetSet.queryRef,
]);

const resultForRequirement = (
  evaluation: InspectorEvaluation, requirement: InspectorLawRequirement,
): InspectorLawResult => {
  const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
  return {
    lawId: requirement.lawId,
    assertions: Object.entries(requirement.clausesByMode).map(([evidenceMode, clauses]) => ({
      clauses: ordered(clauses),
      evidenceMode,
      passed: findings.length === 0,
      refs: targetRefs(requirement, evidenceMode, clauses),
    })),
    findings,
  };
};

export const finalizeStaticInspection = async (
  context: InspectorContext, routes: readonly StaticLawRoute[], execute: StaticInspectorExecutor,
): Promise<InspectorOutput> => {
  const requiredIds = validateStaticRoutes(context, routes);
  const requiredTargets = ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths));
  let evaluation: InspectorEvaluation;
  try { evaluation = await execute(context); }
  catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", context.planEntry.capabilityDomain); }
  validateStaticEvaluation(context, evaluation, requiredIds, requiredTargets);
  return {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: requiredIds,
    lawResults: context.lawRequirements.map((requirement) => resultForRequirement(evaluation, requirement)),
    inspectedFiles: evaluation.inspectedFiles,
  };
};
