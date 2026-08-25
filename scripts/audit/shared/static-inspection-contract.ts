import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorLawRequirement, InspectorOutput,
} from "./inspector-contracts.js";
import { inspectTargetObjects } from "./static-target-object-inspector.js";

const evidenceKind: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));

export const staticClauses = (...forbiddenIndexes: number[]): string[] => ordered([
  ...forbiddenIndexes.map((index) => `forbidden:${index}`), "summary",
]);

const requirementFor = (context: InspectorContext, lawId: string): InspectorLawRequirement =>
  context.lawRequirements.find((requirement) => requirement.lawId === lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:requirement`);

export const staticEvidenceRefs = (context: InspectorContext, lawId: string, evidenceMode: string): string[] => {
  const requirement = requirementFor(context, lawId);
  return ordered([
    ...requirement.targetPaths.filter((path) => !/[#@]/u.test(path)).map((path) =>
      `${evidenceKind[evidenceMode] ?? "file"}:${path}#entire-governed-object`),
    requirement.targetSet.queryRef,
  ]);
};

const validateLawResult = (context: InspectorContext, output: InspectorOutput, lawId: string): void => {
  const requirement = requirementFor(context, lawId);
  const result = output.lawResults.find((entry) => entry.lawId === lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:result`);
  const assertionsByMode = new Map(result.assertions.map((assertion) => [assertion.evidenceMode, assertion]));
  const requiredModes = ordered(Object.keys(requirement.clausesByMode));
  if (assertionsByMode.size !== result.assertions.length
    || JSON.stringify(ordered([...assertionsByMode.keys()])) !== JSON.stringify(requiredModes)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:evidence-mode`);
  }
  for (const mode of requiredModes) {
    const assertion = assertionsByMode.get(mode)
      ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}`);
    if (JSON.stringify(assertion.clauses) !== JSON.stringify(requirement.clausesByMode[mode])
      || !assertion.refs.length || assertion.refs.length !== new Set(assertion.refs).size
      || JSON.stringify(assertion.refs) !== JSON.stringify(ordered(assertion.refs))) {
      fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}:assertion`);
    }
  }
  const expectedPassed = result.findings.length === 0;
  if (result.assertions.some((assertion) => assertion.passed !== expectedPassed)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:verdict-source`);
  }
};

export const validateStaticInspection = (context: InspectorContext, output: InspectorOutput): InspectorOutput => {
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  const requiredTargets = ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths));
  inspectTargetObjects(context, requiredTargets);
  if (output.capabilityDomain !== context.planEntry.capabilityDomain
    || JSON.stringify(output.reportedLawIds) !== JSON.stringify(requiredIds)
    || JSON.stringify(output.lawResults.map((result) => result.lawId)) !== JSON.stringify(requiredIds)
    || JSON.stringify(output.inspectedFiles) !== JSON.stringify(requiredTargets)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:denominator`);
  }
  for (const lawId of requiredIds) validateLawResult(context, output, lawId);
  return output;
};
