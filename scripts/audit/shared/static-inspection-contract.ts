import { createHash } from "node:crypto";

import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorFinding, InspectorLawRequirement, InspectorOutput, StaticCheckReceipt,
} from "./inspector-contracts.js";
import { inspectTargetObjects, observeStaticMode } from "./static-target-object-inspector.js";
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
export const staticImplementationDigest = (implementation: (...args: never[]) => unknown): string =>
  sha256(implementation.toString());

export const staticForbiddenClauses = (...forbiddenIndexes: number[]): string[] =>
  ordered(forbiddenIndexes.map((index) => `forbidden:${index}`));
export const staticClauses = (...forbiddenIndexes: number[]): string[] =>
  ordered([...staticForbiddenClauses(...forbiddenIndexes), "summary"]);

const substantiveSemanticImplementation = (check: string, implementation: (...args: never[]) => unknown): boolean => {
  const source = implementation.toString();
  const arrow = source.indexOf("=>");
  const block = source.indexOf("{", arrow < 0 ? 0 : arrow + 2);
  const header = source.slice(0, arrow < 0 ? block : arrow);
  const body = block < 0 ? source.slice(arrow + 2) : source.slice(block + 1, source.lastIndexOf("}"));
  const parameterTokens = (header.match(/[A-Za-z_$][A-Za-z0-9_$]*/gu) ?? [])
    .filter((token) => !["async", "function", check].includes(token));
  return implementation.length > 0 && body.trim().length > 0
    && parameterTokens.some((token) => new RegExp(`\\b${token}\\b`, "u").test(body))
    && /\b(?:if|for|switch|throw|while)\b|(?:\b|\.)[A-Za-z_$][A-Za-z0-9_$]*\s*\(/u.test(body);
};

export const recordStaticCheck = <T>(input: {
  check: string;
  findings: InspectorFinding[];
  implementation: (...args: never[]) => unknown;
  lawIds: readonly string[];
  observe?: (result: T) => string;
  receipts: StaticCheckReceipt[];
  run: () => T;
}): T => {
  const callbackSource = input.run.toString();
  if (input.implementation.name !== input.check || !callbackSource.includes(`${input.check}(`)
    || /\b(?:if|switch|while|for)\s*\(|\?[^:]+:/u.test(callbackSource)
    || !substantiveSemanticImplementation(input.check, input.implementation)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${input.check}:direct-execution`);
  }
  const before = new Map(input.lawIds.map((lawId) => [lawId,
    input.findings.filter((finding) => finding.lawId === lawId).length]));
  const result = input.run();
  const nativeObservation = input.observe?.(result);
  if (nativeObservation !== undefined && !/^typechecker:[a-f0-9]{64}$/u.test(nativeObservation)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${input.check}:native-observation`);
  }
  for (const lawId of input.lawIds) input.receipts.push({
    check: input.check,
    implementationDigest: staticImplementationDigest(input.implementation),
    lawId,
    ...(nativeObservation === undefined ? {} : { nativeObservation }),
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
const evidenceLocatorPaths = (requirement: InspectorLawRequirement): string[] =>
  requirement.targetPaths.filter((path) => !/[#@:%]/u.test(path));

const staticEvidenceKind = (lawId: string, evidenceMode: string): string => ({
  "static.ast": "ast", "static.config": "config", "static.contract": "config",
  "static.dependency": "dependency", "static.filesystem": "file", "static.json": "json",
  "static.migration": "file", "static.sql": "sql", "static.text": "text",
  "static.types": "test", "static.yaml": "yaml",
} as Readonly<Record<string, string>>)[evidenceMode]
  ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:evidence-kind`);

type NativeRefObservation = Readonly<{
  implementationSignature: string; invalid: boolean; nativeObservationSignature: string; objectPath: string;
}>;
const observeNativeRef = (input: {
  assertion: InspectorOutput["lawResults"][number]["assertions"][number];
  context: InspectorContext;
  evidenceKind: string;
  lawId: string;
  mode: string;
  reference: string;
  requirement: InspectorLawRequirement;
}): NativeRefObservation => {
  const { assertion, context, evidenceKind, lawId, mode, reference, requirement } = input;
  const fragment = reference.indexOf("#");
  const objectPath = fragment > evidenceKind.length + 1 ? reference.slice(evidenceKind.length + 1, fragment) : "";
  let binding: URLSearchParams;
  try { binding = new URLSearchParams(decodeURIComponent(reference.slice(fragment + 1)).replaceAll(";", "&")); }
  catch { return { implementationSignature: "", invalid: true, nativeObservationSignature: "", objectPath }; }
  const checks = binding.get("semanticChecks")?.split(",") ?? [];
  const implementations = binding.get("checkImplementations")?.split(",") ?? [];
  const implementationSignature = binding.get("checkImplementations") ?? "";
  const implementationNames = implementations.map((entry) => entry.split(":", 1)[0]);
  const nativeObservationSignature = binding.get("modeNativeObservation") ?? "";
  const bindingKeys = ["checkImplementations", "clauses", "executionResult", "lawId", "mode",
    "modeNativeObservation", "semanticChecks"];
  const expectedNativeObservation = observeStaticMode(context, mode);
  const nativeObservationInvalid = nativeObservationSignature !== expectedNativeObservation;
  const invalid = [
    !reference.startsWith(`${evidenceKind}:`), !requirement.targetPaths.includes(objectPath),
    binding.get("lawId") !== lawId, binding.get("mode") !== mode,
    binding.get("clauses") !== assertion.clauses.join(","),
    binding.get("executionResult") !== (assertion.passed ? "passed" : "failed"),
    JSON.stringify([...binding.keys()].sort()) !== JSON.stringify(bindingKeys),
    !checks.length, JSON.stringify(implementationNames) !== JSON.stringify(checks),
    implementations.some((entry) => !/^[A-Za-z_$][A-Za-z0-9_$]*:[a-f0-9]{64}$/u.test(entry)),
    nativeObservationInvalid,
  ].includes(true);
  return { implementationSignature, invalid, nativeObservationSignature, objectPath };
};

const nativeObservationInvalid = (input: {
  assertion: InspectorOutput["lawResults"][number]["assertions"][number];
  context: InspectorContext;
  evidenceKind: string;
  lawId: string;
  mode: string;
  requirement: InspectorLawRequirement;
}): boolean => {
  const { assertion, context, evidenceKind, lawId, mode, requirement } = input;
  const scopeOnly = requirement.targetSet.count === 0 && requirement.targetPaths.length === 0
    && assertion.refs.length === 1 && assertion.refs[0] === requirement.targetSet.queryRef;
  if (scopeOnly) return false;
  const nativeRefs = assertion.refs.filter((reference) => reference !== requirement.targetSet.queryRef);
  const locatorPaths = evidenceLocatorPaths(requirement);
  if (nativeRefs.length !== locatorPaths.length) return true;
  const observations = nativeRefs.map((reference) => observeNativeRef({
    assertion, context, evidenceKind, lawId, mode, reference, requirement,
  }));
  return observations.some((observation) => observation.invalid)
    || new Set(observations.map((observation) => observation.implementationSignature)).size !== 1
    || new Set(observations.map((observation) => observation.nativeObservationSignature)).size !== 1
    || JSON.stringify(ordered(observations.map((observation) => observation.objectPath)))
      !== JSON.stringify(ordered(locatorPaths));
};

export const staticEvidenceRefs = (
  context: InspectorContext, lawId: string, evidenceMode: string, clauses: readonly string[],
  receipts: readonly StaticCheckReceipt[],
  semanticChecks: readonly string[],
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
  if (requirement.targetSet.count === 0 && requirement.targetPaths.length === 0) {
    return [requirement.targetSet.queryRef];
  }
  const locatorPaths = evidenceLocatorPaths(requirement);
  if (!locatorPaths.length) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:native-object`);
  const matchingReceipts = checks.map((check) => receipts.find((receipt) =>
    receipt.lawId === lawId && receipt.check === check)!);
  if (matchingReceipts.some((receipt) => !/^[a-f0-9]{64}$/u.test(receipt.implementationDigest))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:implementation-digest`);
  }
  const expectedNativeObservation = observeStaticMode(context, evidenceMode);
  const semanticBinding = encodeURIComponent(`semanticChecks=${checks.join(",")}`);
  const lawModeBinding = encodeURIComponent(`lawId=${lawId};mode=${evidenceMode};`);
  const clauseBinding = encodeURIComponent(`clauses=${clauses.join(",")}`);
  const executionBinding = encodeURIComponent(`executionResult=${producerModePassed(receipts, lawId, checks) ? "passed" : "failed"}`);
  const implementationBinding = encodeURIComponent(`checkImplementations=${matchingReceipts
    .map((receipt) => `${receipt.check}:${receipt.implementationDigest}`).join(",")}`);
  const nativeObservationBinding = `%3B${encodeURIComponent(
    `modeNativeObservation=${expectedNativeObservation}`,
  )}`;
  const nativeRefs = locatorPaths.map((path) =>
    `${evidenceKind}:${path}#${lawModeBinding}${semanticBinding}%3B${executionBinding}%3B${implementationBinding}${nativeObservationBinding}%3B${clauseBinding}`);
  return ordered([
    ...nativeRefs,
    requirement.targetSet.queryRef,
  ]);
};

const validateAssertion = (input: {
  assertion: InspectorOutput["lawResults"][number]["assertions"][number];
  context: InspectorContext;
  lawId: string;
  mode: string;
  requirement: InspectorLawRequirement;
}): void => {
  const { assertion, context, lawId, mode, requirement } = input;
  const clauseInvalid = !assertion.clauses.length
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
  const evidenceKind = staticEvidenceKind(lawId, mode);
  if (!assertion.refs.includes(requirement.targetSet.queryRef)
    || nativeObservationInvalid({ assertion, context, evidenceKind, lawId, mode, requirement })) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}:native-observation`);
  }
};

const semanticCheckSignature = (lawId: string, mode: string,
  assertion: InspectorOutput["lawResults"][number]["assertions"][number]): string => {
  if (assertion.refs.length === 1 && assertion.refs[0]?.startsWith("scope:")) return `scope-only:${mode}`;
  const signatures = assertion.refs.filter((reference) => !reference.startsWith("scope:"))
    .map((reference) => {
      try { return /(?:^|;)semanticChecks=([^;]+)/u.exec(decodeURIComponent(reference.slice(reference.indexOf("#") + 1)))?.[1] ?? ""; }
      catch { return ""; }
    });
  if (!signatures.length || signatures.some((signature) => !signature)
    || new Set(signatures).size !== 1) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}:semantic-check-binding`);
  return signatures[0]!;
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
    validateAssertion({ assertion, context, lawId, mode, requirement });
  }
  const semanticCheckOwners = new Map<string, string>();
  for (const mode of requiredModes) {
    const signature = semanticCheckSignature(lawId, mode,
      assertionsByMode.get(mode) ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${mode}`));
    if (signature.startsWith("scope-only:")) continue;
    for (const check of signature.split(",")) {
      const currentOwner = semanticCheckOwners.get(check);
      if (currentOwner && currentOwner !== mode) {
        fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:evidence-mode-semantic-substitution`);
      }
      semanticCheckOwners.set(check, mode);
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
