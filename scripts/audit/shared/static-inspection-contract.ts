import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorFinding, InspectorLawRequirement, InspectorOutput, StaticCheckReceipt,
} from "./inspector-contracts.js";
import { inspectTargetObjects } from "./static-target-object-inspector.js";
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));

export const staticClauses = (...forbiddenIndexes: number[]): string[] => ordered([
  ...forbiddenIndexes.map((index) => `forbidden:${index}`), "summary",
]);

export const recordStaticCheck = <T>(input: {
  check: string;
  findings: InspectorFinding[];
  lawIds: readonly string[];
  receipts: StaticCheckReceipt[];
  run: () => T;
}): T => {
  const callbackSource = input.run.toString();
  if (!callbackSource.includes(`${input.check}(`)
    || /\b(?:if|switch|while|for)\s*\(|\?[^:]+:/u.test(callbackSource)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${input.check}:direct-execution`);
  }
  const before = new Map(input.lawIds.map((lawId) => [lawId,
    input.findings.filter((finding) => finding.lawId === lawId).length]));
  const result = input.run();
  for (const lawId of input.lawIds) input.receipts.push({
    check: input.check,
    lawId,
    passed: input.findings.filter((finding) => finding.lawId === lawId).length === before.get(lawId),
  });
  return result;
};

export const producerModePassed = (
  receipts: readonly StaticCheckReceipt[], lawId: string, semanticChecks: readonly string[],
): boolean => semanticChecks.every((check) => {
  const matching = receipts.filter((receipt) => receipt.lawId === lawId && receipt.check === check);
  if (matching.length !== 1) return false;
  return matching[0]!.passed;
});

const requirementFor = (context: InspectorContext, lawId: string): InspectorLawRequirement =>
  context.lawRequirements.find((requirement) => requirement.lawId === lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:requirement`);

const staticEvidenceKind = (lawId: string, evidenceMode: string): string => ({
  "static.ast": "ast", "static.config": "config", "static.contract": "config",
  "static.dependency": "dependency", "static.filesystem": "file", "static.json": "json",
  "static.migration": "file", "static.sql": "sql", "static.text": "text",
  "static.types": "test", "static.yaml": "yaml",
} as Readonly<Record<string, string>>)[evidenceMode]
  ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:evidence-kind`);

export const staticEvidenceRefs = (
  context: InspectorContext, lawId: string, evidenceMode: string, clauses: readonly string[],
  receipts: readonly StaticCheckReceipt[],
  semanticChecks: readonly string[],
  nativeRefs: readonly string[] | "scope-only",
): string[] => {
  const requirement = requirementFor(context, lawId);
  const checks = ordered(semanticChecks);
  if (!checks.length || checks.some((check) => !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(check))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:semantic-check`);
  }
  for (const check of checks) {
    const matching = receipts.filter((receipt) => receipt.lawId === lawId && receipt.check === check);
    if (matching.length !== 1) fail("LAW_CHECK_EXECUTION_INCOMPLETE",
      `${lawId}:${evidenceMode}:${check}:execution-receipt`);
  }
  const evidenceKind = staticEvidenceKind(lawId, evidenceMode);
  if (nativeRefs === "scope-only") {
    if (requirement.targetSet.count !== 0 || requirement.targetPaths.length !== 0)
      fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:scope-only`);
    return [requirement.targetSet.queryRef];
  }
  const semanticBinding = encodeURIComponent(`semanticChecks=${checks.join(",")}`);
  const lawModeBinding = encodeURIComponent(`lawId=${lawId};mode=${evidenceMode};`);
  const clauseBinding = encodeURIComponent(`clauses=${clauses.join(",")}`);
  const executionBinding = encodeURIComponent(`executionResult=${producerModePassed(receipts, lawId, checks) ? "passed" : "failed"}`);
  if (!nativeRefs.length || nativeRefs.some((reference) => {
    const fragment = reference.indexOf("#");
    const objectPath = fragment > evidenceKind.length + 1
      ? reference.slice(evidenceKind.length + 1, fragment) : "";
    return !reference.startsWith(`${evidenceKind}:`) || !requirement.targetPaths.includes(objectPath)
      || !reference.includes(lawModeBinding) || !reference.includes(semanticBinding)
      || !reference.includes(executionBinding) || !reference.includes(clauseBinding);
  })) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:native-object`);
  }
  return ordered([
    ...nativeRefs,
    requirement.targetSet.queryRef,
  ]);
};

const validateAssertion = (input: {
  assertion: InspectorOutput["lawResults"][number]["assertions"][number];
  lawId: string;
  mode: string;
  requirement: InspectorLawRequirement;
}): void => {
  const { assertion, lawId, mode, requirement } = input;
  const clauseInvalid = !assertion.clauses.length
    || (assertion.clauses.length === 1 && assertion.clauses[0] === "summary")
    || assertion.clauses.some((clause) => clause !== "summary"
      && !/^forbidden:(?:0|[1-9][0-9]*)$/u.test(clause))
    || assertion.clauses.some((clause) => clause.startsWith("forbidden:")
      && Number(clause.slice("forbidden:".length)) >= requirement.forbiddenCount);
  const refsInvalid = !assertion.refs.length
    || assertion.refs.length !== new Set(assertion.refs).size
    || JSON.stringify(assertion.refs) !== JSON.stringify(ordered(assertion.refs));
  if (clauseInvalid || refsInvalid) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}:assertion`);
  }
  const observationBinding = encodeURIComponent(`lawId=${lawId};mode=${mode};`);
  const clauseBinding = encodeURIComponent(`clauses=${assertion.clauses.join(",")}`);
  const semanticBinding = encodeURIComponent("semanticChecks=");
  const executionBinding = encodeURIComponent(`executionResult=${assertion.passed ? "passed" : "failed"}`);
  const evidenceKind = staticEvidenceKind(lawId, mode);
  const nativeRefs = assertion.refs.filter((reference) => reference !== requirement.targetSet.queryRef);
  const scopeOnly = requirement.targetSet.count === 0 && requirement.targetPaths.length === 0
    && assertion.refs.length === 1 && assertion.refs[0] === requirement.targetSet.queryRef;
  if (!assertion.refs.includes(requirement.targetSet.queryRef)
    || (!scopeOnly && (!nativeRefs.length || nativeRefs.some((reference) => {
      const fragment = reference.indexOf("#");
      const objectPath = fragment > evidenceKind.length + 1
        ? reference.slice(evidenceKind.length + 1, fragment) : "";
      return !reference.startsWith(`${evidenceKind}:`) || !requirement.targetPaths.includes(objectPath)
        || !reference.includes(observationBinding) || !reference.includes(clauseBinding)
        || !reference.includes(semanticBinding) || !reference.includes(executionBinding);
    })))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}:native-observation`);
  }
};

const validateLawResult = (context: InspectorContext, output: InspectorOutput, lawId: string): void => {
  const requirement = requirementFor(context, lawId);
  const result = output.lawResults.find((entry) => entry.lawId === lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:result`);
  const assertionsByMode = new Map(result.assertions.map((assertion) => [assertion.evidenceMode, assertion]));
  const requiredModes = ordered(requirement.requiredStaticModes);
  if (assertionsByMode.size !== result.assertions.length
    || JSON.stringify(ordered([...assertionsByMode.keys()])) !== JSON.stringify(requiredModes)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:evidence-mode`);
  }
  for (const mode of requiredModes) {
    const assertion = assertionsByMode.get(mode)
      ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}`);
    validateAssertion({ assertion, lawId, mode, requirement });
  }
  if (result.findings.some((finding) => finding.lawId !== lawId
    || !requiredModes.includes(finding.evidenceMode))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:finding-evidence-mode`);
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
