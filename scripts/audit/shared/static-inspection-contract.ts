import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorFinding, InspectorLawRequirement, InspectorOutput, StaticCheckReceipt,
} from "./inspector-contracts.js";
import { inspectTargetObjects } from "./static-target-object-inspector.js";
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
export const staticImplementationDigest = (implementation: (...args: never[]) => unknown): string =>
  sha256(implementation.toString());

export const staticForbiddenClauses = (...forbiddenIndexes: number[]): string[] =>
  ordered(forbiddenIndexes.map((index) => `forbidden:${index}`));
export const staticClauses = (...forbiddenIndexes: number[]): string[] =>
  ordered([...staticForbiddenClauses(...forbiddenIndexes), "summary"]);

export const recordStaticCheck = <T>(input: {
  check: string;
  findings: InspectorFinding[];
  implementation: (...args: never[]) => unknown;
  lawIds: readonly string[];
  receipts: StaticCheckReceipt[];
  run: () => T;
}): T => {
  const callbackSource = input.run.toString();
  if (input.implementation.name !== input.check || !callbackSource.includes(`${input.check}(`)
    || /\b(?:if|switch|while|for)\s*\(|\?[^:]+:/u.test(callbackSource)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${input.check}:direct-execution`);
  }
  const before = new Map(input.lawIds.map((lawId) => [lawId,
    input.findings.filter((finding) => finding.lawId === lawId).length]));
  const result = input.run();
  for (const lawId of input.lawIds) input.receipts.push({
    check: input.check,
    implementationDigest: staticImplementationDigest(input.implementation),
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
const evidenceLocatorPaths = (requirement: InspectorLawRequirement): string[] =>
  requirement.targetPaths.filter((path) => !/[#@:%]/u.test(path));
const targetSetObjectDigest = (context: InspectorContext, requirement: InspectorLawRequirement): string =>
  sha256(requirement.targetPaths.map((path) => {
    try { return `${path}\0${sha256(readFileSync(resolve(context.sealedRoot, path)))}`; }
    catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${requirement.lawId}:${path}:object-digest`); }
  }).join("\0"));

const staticEvidenceKind = (lawId: string, evidenceMode: string): string => ({
  "static.ast": "ast", "static.config": "config", "static.contract": "config",
  "static.dependency": "dependency", "static.filesystem": "file", "static.json": "json",
  "static.migration": "file", "static.sql": "sql", "static.text": "text",
  "static.types": "test", "static.yaml": "yaml",
} as Readonly<Record<string, string>>)[evidenceMode]
  ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:evidence-kind`);

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
  const observedPaths: string[] = [];
  const implementationSignatures: string[] = [];
  const expectedTargetSetDigest = targetSetObjectDigest(context, requirement);
  const invalid = nativeRefs.some((reference) => {
    const fragment = reference.indexOf("#");
    const objectPath = fragment > evidenceKind.length + 1
      ? reference.slice(evidenceKind.length + 1, fragment) : "";
    observedPaths.push(objectPath);
    let binding: URLSearchParams;
    try { binding = new URLSearchParams(decodeURIComponent(reference.slice(fragment + 1)).replaceAll(";", "&")); }
    catch { return true; }
    const checks = binding.get("semanticChecks")?.split(",") ?? [];
    const implementations = binding.get("checkImplementations")?.split(",") ?? [];
    implementationSignatures.push(binding.get("checkImplementations") ?? "");
    const implementationNames = implementations.map((entry) => entry.split(":", 1)[0]);
    let objectDigest = "";
    try { objectDigest = sha256(readFileSync(resolve(context.sealedRoot, objectPath))); } catch { return true; }
    return !reference.startsWith(`${evidenceKind}:`) || !requirement.targetPaths.includes(objectPath)
      || binding.get("lawId") !== lawId || binding.get("mode") !== mode
      || binding.get("clauses") !== assertion.clauses.join(",")
      || binding.get("executionResult") !== (assertion.passed ? "passed" : "failed")
      || binding.get("objectDigest") !== objectDigest
      || binding.get("targetSetDigest") !== expectedTargetSetDigest
      || !checks.length || JSON.stringify(implementationNames) !== JSON.stringify(checks)
      || implementations.some((entry) => !/^[A-Za-z_$][A-Za-z0-9_$]*:[a-f0-9]{64}$/u.test(entry));
  });
  return invalid || new Set(implementationSignatures).size !== 1
    || JSON.stringify(ordered(observedPaths)) !== JSON.stringify(ordered(locatorPaths));
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
  const semanticBinding = encodeURIComponent(`semanticChecks=${checks.join(",")}`);
  const lawModeBinding = encodeURIComponent(`lawId=${lawId};mode=${evidenceMode};`);
  const clauseBinding = encodeURIComponent(`clauses=${clauses.join(",")}`);
  const executionBinding = encodeURIComponent(`executionResult=${producerModePassed(receipts, lawId, checks) ? "passed" : "failed"}`);
  const implementationBinding = encodeURIComponent(`checkImplementations=${matchingReceipts
    .map((receipt) => `${receipt.check}:${receipt.implementationDigest}`).join(",")}`);
  const targetSetBinding = encodeURIComponent(`targetSetDigest=${targetSetObjectDigest(context, requirement)};`);
  const nativeRefs = locatorPaths.map((path) => {
    let objectDigest: string;
    try { objectDigest = sha256(readFileSync(resolve(context.sealedRoot, path))); }
    catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${lawId}:${evidenceMode}:${path}:object-digest`); }
    return `${evidenceKind}:${path}#${lawModeBinding}${semanticBinding}%3B${executionBinding}%3B${implementationBinding}%3B${encodeURIComponent(`objectDigest=${objectDigest};`)}${targetSetBinding}${clauseBinding}`;
  });
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
