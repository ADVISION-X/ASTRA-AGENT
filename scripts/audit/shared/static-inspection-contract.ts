import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorFinding, InspectorLawRequirement, InspectorOutput,
} from "./inspector-contracts.js";
import { collectStaticModeEvidenceRefs, inspectTargetObjects } from "./static-target-object-inspector.js";
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));

export const staticClauses = (...forbiddenIndexes: number[]): string[] => ordered([
  ...forbiddenIndexes.map((index) => `forbidden:${index}`), "summary",
]);

export const producerModePassed = (findings: readonly InspectorFinding[], evidenceMode: string): boolean =>
  findings.every((finding) => finding.evidenceMode !== evidenceMode);

const requirementFor = (context: InspectorContext, lawId: string): InspectorLawRequirement =>
  context.lawRequirements.find((requirement) => requirement.lawId === lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:requirement`);

export const staticEvidenceRefs = (
  context: InspectorContext, lawId: string, evidenceMode: string, clauses: readonly string[],
): string[] => {
  const requirement = requirementFor(context, lawId);
  return ordered([
    ...collectStaticModeEvidenceRefs(context, requirement, evidenceMode, clauses),
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
  if (!assertion.refs.includes(requirement.targetSet.queryRef)
    || !assertion.refs.some((reference) => reference.includes(observationBinding)
      && reference.includes(clauseBinding))) {
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
    if (assertion.passed !== producerModePassed(result.findings, mode)) {
      fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}:finding-verdict`);
    }
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
