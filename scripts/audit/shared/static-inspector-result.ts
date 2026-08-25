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
export type StaticInspectorExecutor = (context: InspectorContext) => InspectorEvaluation | Promise<InspectorEvaluation>;

export const staticLawCoverage = (
  lawId: string, forbiddenCount: number, evidenceModes: readonly string[], primaryForbiddenIndexes: readonly number[],
): { lawId: string; clausesByMode: Record<string, string[]> } => {
  const primary = evidenceModes.includes("static.ast") ? "static.ast" : evidenceModes[0];
  if (!primary || primaryForbiddenIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= forbiddenCount)
    || primaryForbiddenIndexes.length !== new Set(primaryForbiddenIndexes).size) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:owner-clause-coverage`);
  }
  return {
    lawId,
    clausesByMode: Object.fromEntries(ordered(evidenceModes).map((mode) => [mode, ordered([
      ...(mode === primary ? primaryForbiddenIndexes.map((index) => `forbidden:${index}`) : []), "summary",
    ])])),
  };
};

const validateStaticCoverage = (context: InspectorContext, evaluation: InspectorEvaluation): string[] => {
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  const coverageIds = evaluation.coverage.map((entry) => entry.lawId);
  if (JSON.stringify(coverageIds) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:clause-coverage`);
  }
  for (const requirement of context.lawRequirements) {
    const coverage = evaluation.coverage.find((entry) => entry.lawId === requirement.lawId);
    if (!coverage) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${requirement.lawId}:clause-coverage`);
    const verifiedCoverage = coverage as NonNullable<typeof coverage>;
    if (JSON.stringify(verifiedCoverage.clausesByMode) !== JSON.stringify(requirement.clausesByMode)) {
      fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${requirement.lawId}:clause-coverage`);
    }
    const requiredClauses = ordered(Object.values(verifiedCoverage.clausesByMode).flat());
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
  requirement: InspectorLawRequirement, evidenceMode: string,
): string[] => ordered([
  ...requirement.targetPaths.filter((path) => !/[#@]/u.test(path)).map((path) =>
    `${evidenceKind[evidenceMode] ?? "file"}:${path}#entire-governed-object`),
  requirement.targetSet.queryRef,
]);

const resultForRequirement = (
  evaluation: InspectorEvaluation, requirement: InspectorLawRequirement,
): InspectorLawResult => {
  const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
  const coverage = evaluation.coverage.find((entry) => entry.lawId === requirement.lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${requirement.lawId}:clause-coverage`);
  return {
    lawId: requirement.lawId,
    assertions: Object.entries(coverage.clausesByMode).map(([evidenceMode, clauses]) => ({
      clauses: ordered(clauses),
      evidenceMode,
      passed: findings.length === 0,
      refs: targetRefs(requirement, evidenceMode),
    })),
    findings,
  };
};

export const finalizeStaticInspection = async (
  context: InspectorContext, execute: StaticInspectorExecutor,
): Promise<InspectorOutput> => {
  const requiredTargets = ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths));
  let evaluation: InspectorEvaluation;
  try { evaluation = await execute(context); }
  catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", context.planEntry.capabilityDomain); }
  const requiredIds = validateStaticCoverage(context, evaluation);
  validateStaticEvaluation(context, evaluation, requiredIds, requiredTargets);
  return {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: requiredIds,
    lawResults: context.lawRequirements.map((requirement) => resultForRequirement(evaluation, requirement)),
    inspectedFiles: evaluation.inspectedFiles,
  };
};
