import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorEvaluation, InspectorExecutedCheck, InspectorLawRequirement, InspectorLawResult, InspectorOutput,
} from "./inspector-contracts.js";
import { inspectTargetObjects } from "./static-target-object-inspector.js";

const evidenceKind: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
export type StaticLawRoute = Readonly<{
  lawId: string;
}>;
export type StaticInspectorExecutor = (context: InspectorContext) => InspectorEvaluation | Promise<InspectorEvaluation>;

export const completedStaticChecks = (
  context: InspectorContext, checkId: string,
): InspectorExecutedCheck[] => context.lawRequirements.flatMap((requirement) =>
  Object.entries(requirement.clausesByMode).map(([evidenceMode, clauses]) => ({
    lawId: requirement.lawId,
    evidenceMode,
    clauses: ordered(clauses),
    checkId,
  })));

const validateStaticRoutes = (
  context: InspectorContext, routes: readonly StaticLawRoute[],
): string[] => {
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

const checkSignature = (check: InspectorExecutedCheck): string =>
  `${check.lawId}\0${check.evidenceMode}\0${JSON.stringify(ordered(check.clauses))}`;

const validateExecutedChecks = (context: InspectorContext, evaluation: InspectorEvaluation): void => {
  const expected = context.lawRequirements.flatMap((requirement) => Object.entries(requirement.clausesByMode)
    .map(([evidenceMode, clauses]) => `${requirement.lawId}\0${evidenceMode}\0${JSON.stringify(ordered(clauses))}`));
  if (!Array.isArray(evaluation.executedChecks)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:clause-execution`);
  }
  const actual = evaluation.executedChecks.map(checkSignature);
  if (evaluation.executedChecks.some((check) => !check || !Array.isArray(check.clauses)
    || typeof check.lawId !== "string" || typeof check.evidenceMode !== "string"
    || !/^[a-z0-9]+(?:[a-z0-9-]*)(?:\/[a-z0-9]+(?:[a-z0-9-]*))*$/u.test(check.checkId))
    || actual.length !== new Set(actual).size
    || JSON.stringify(ordered(actual)) !== JSON.stringify(ordered(expected))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:clause-execution`);
  }
};

const validateStaticEvaluation = (
  context: InspectorContext, evaluation: InspectorEvaluation, requiredIds: readonly string[],
  requiredTargets: readonly string[], executorName: string,
): void => {
  inspectTargetObjects(context, requiredTargets);
  if (evaluation.capabilityDomain !== context.planEntry.capabilityDomain
    || JSON.stringify(evaluation.reportedLawIds) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}:result`);
  }
  const declaredInspected = new Set(evaluation.inspectedFiles);
  if (declaredInspected.size !== evaluation.inspectedFiles.length
    || JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(ordered(evaluation.inspectedFiles))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:inspection-order`);
  }
  if (JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(requiredTargets)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}:target-denominator`);
  }
  validateExecutedChecks(context, evaluation);
};

const resultForRequirement = (
  context: InspectorContext, evaluation: InspectorEvaluation,
  requirement: InspectorLawRequirement, executionId: string,
): InspectorLawResult => {
  const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
  const checks = evaluation.executedChecks.filter((check) => check.lawId === requirement.lawId);
  return {
    lawId: requirement.lawId,
    assertions: checks.map((check) => ({
      clauses: check.clauses,
      evidenceMode: check.evidenceMode,
      passed: findings.length === 0,
      refs: ordered([
        ...check.clauses.map((clause) =>
          `${evidenceKind[check.evidenceMode] ?? "file"}:${context.planEntry.ownerInspectorPath}#${encodeURIComponent(`executionId=${executionId};checkId=${check.checkId};clause=${clause};mode=${check.evidenceMode};targetCount=${requirement.targetSet.count}`)}`),
        requirement.targetSet.queryRef,
      ]),
    })),
    findings,
  };
};

export const finalizeStaticInspection = async (
  context: InspectorContext,
  routes: readonly StaticLawRoute[],
  execute: StaticInspectorExecutor,
): Promise<InspectorOutput> => {
  const executorName = execute.name;
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(executorName)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:unnamed-executor`);
  }
  const requiredIds = validateStaticRoutes(context, routes);
  const requiredTargets = ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths));
  let evaluation: InspectorEvaluation;
  try { evaluation = await execute(context); }
  catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}`); }
  validateStaticEvaluation(context, evaluation, requiredIds, requiredTargets, executorName);
  const executionId = `${context.planEntry.capabilityDomain}/${executorName}`;
  const lawResults = context.lawRequirements.map((requirement) =>
    resultForRequirement(context, evaluation, requirement, executionId));
  return {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: requiredIds,
    lawResults,
    inspectedFiles: evaluation.inspectedFiles,
  };
};
