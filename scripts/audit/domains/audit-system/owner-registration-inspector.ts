import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type ParameterDeclaration,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { loadManifests } from "../../build/load-manifests.js";
import { ownerEvaluationExecutesAssertions } from "./owner-evaluation-integrity-inspector.js";

const resolvesToDeclaration = (node: Node, declaration: Node): boolean => {
  const symbol = node.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return target?.getDeclarations().includes(declaration) ?? false;
};

const isContextChecksCall = (
  call: CallExpression,
  method: "output" | "run" | "runAll",
  contextParameter: ParameterDeclaration,
): boolean => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== method) return false;
  const checks = callee.getExpression();
  return Node.isPropertyAccessExpression(checks)
    && checks.getName() === "checks"
    && resolvesToDeclaration(checks.getExpression(), contextParameter);
};

const callResolvesToDeclaration = (call: CallExpression, declaration: Node): boolean => {
  const symbol = call.getExpression().getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return target?.getDeclarations().includes(declaration) ?? false;
};

const returnedFindingsCarryOwnerWork = (
  callback: ArrowFunction,
  ownerCalls: readonly CallExpression[],
): boolean => {
  const body = callback.getBody();
  const unwrapped = Node.isParenthesizedExpression(body) ? body.getExpression() : body;
  const directReturns = callback.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(Node.isFunctionLikeDeclaration) === callback);
  const returned = Node.isObjectLiteralExpression(unwrapped)
    ? unwrapped
    : directReturns.length === 1
      ? directReturns.map((statement) => statement.getExpression()).find(Node.isObjectLiteralExpression)
      : undefined;
  const property = returned?.getProperty("findings");
  const findings = Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : Node.isShorthandPropertyAssignment(property) ? property.getNameNode() : undefined;
  if (!findings) return false;
  const identifiers = [
    ...(Node.isIdentifier(findings) ? [findings] : []),
    ...findings.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return ownerCalls.some((call) => {
    const declaration = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!declaration) return call.getFirstAncestor((ancestor) => ancestor === findings) === findings;
    return identifiers.some((identifier) =>
      identifier.getSymbol()?.getDeclarations().includes(declaration) ?? false);
  });
};

const evaluationCallsForWindow = (
  sourceFile: SourceFile,
  inspectDomain: FunctionDeclaration | ArrowFunction,
) => {
  const calls = inspectDomain.getDescendantsOfKind(SyntaxKind.CallExpression);
  const contextParameter = inspectDomain.getParameters()[0];
  const runCalls = contextParameter
    ? calls.filter((call) => isContextChecksCall(call, "runAll", contextParameter)
      && call.getFirstAncestor(Node.isFunctionLikeDeclaration) === inspectDomain
      && Node.isAwaitExpression(call.getParent()))
    : [];
  const callback = runCalls[0]?.getArguments()[0];
  const declaration = sourceFile.getFunction("inspectDomainEvaluation")
    ?? sourceFile.getVariableDeclaration("inspectDomainEvaluation");
  const evaluationFunction = Node.isFunctionDeclaration(declaration)
    ? declaration
    : declaration?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const evaluationCalls = declaration
    ? calls.filter((call) => callResolvesToDeclaration(call, declaration))
    : [];
  const obsoleteRunCount = calls.filter((call) => {
    const callee = call.getExpression();
    const owner = Node.isPropertyAccessExpression(callee) ? callee.getExpression() : undefined;
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "run"
      && Node.isPropertyAccessExpression(owner) && owner.getName() === "checks";
  }).length;
  return { callback, evaluationCalls, evaluationFunction, obsoleteRunCount, runCount: runCalls.length };
};

const signedEvaluationWindowIsValid = (
  sourceFile: SourceFile,
  inspectDomain: FunctionDeclaration | ArrowFunction,
): boolean => {
  const window = evaluationCallsForWindow(sourceFile, inspectDomain);
  const { callback, evaluationCalls, evaluationFunction } = window;
  const callbackCalls = callback && Node.isArrowFunction(callback)
    ? evaluationCalls.filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === callback)
    : [];
  const unsignedCalls = evaluationCalls.filter((call) => !callbackCalls.includes(call));
  return Boolean(window.runCount === 1 && window.obsoleteRunCount === 0
    && evaluationFunction && ownerEvaluationExecutesAssertions(evaluationFunction)
    && callback && Node.isArrowFunction(callback) && callbackCalls.length === 1
    && unsignedCalls.length === 0 && returnedFindingsCarryOwnerWork(callback, callbackCalls));
};

const sessionOutputIsContextBound = (
  inspectDomain: FunctionDeclaration | ArrowFunction,
): boolean => {
  const contextParameter = inspectDomain.getParameters()[0];
  if (!contextParameter) return false;
  const calls = inspectDomain.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => isContextChecksCall(call, "output", contextParameter)
      && call.getFirstAncestor(Node.isFunctionLikeDeclaration) === inspectDomain);
  const directReturns = inspectDomain.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(Node.isFunctionLikeDeclaration) === inspectDomain);
  return calls.length === 1 && directReturns.length === 1
    && directReturns[0]?.getExpression() === calls[0];
};

export const ownerReceiptIdsAreCanonical = (
  capabilityDomain: string,
  physicalIds: readonly string[],
  manifestIds: ReadonlySet<string>,
): boolean => {
  const canonicalId = `${capabilityDomain}/owner-assertion-set`;
  return physicalIds.length === 1
    && physicalIds[0] === canonicalId
    && manifestIds.size === 1
    && manifestIds.has(canonicalId);
};

const physicalReceiptIdsMatchManifest = (
  entry: InspectorContext["planEntry"],
  physicalIds: readonly string[],
): boolean => {
  const manifest = loadManifests().manifests.find((candidate) => candidate.manifestPath === entry.manifestPath);
  if (!manifest) return false;
  const manifestIds = new Set(manifest.coverage.bindings.flatMap((binding) => binding.checkIds));
  return ownerReceiptIdsAreCanonical(entry.capabilityDomain, physicalIds, manifestIds);
};

const pushOwnerRegistrationFindings = (
  context: InspectorContext,
  findings: InspectorFinding[],
  entry: InspectorContext["planEntry"],
  lawId: string,
): void => {
  const source = context.project.getSourceFile(resolveFromRepo(entry.ownerInspectorPath));
  if (!source) return;
  const physicalIds = [...new Set(entry.bindings.flatMap((binding) => binding.checkIds))].sort();
  if (!physicalReceiptIdsMatchManifest(entry, physicalIds)) findings.push(createFinding({
    checkId: "audit-system/runner-source", lawId, filePath: entry.ownerInspectorPath,
    message: `${entry.capabilityDomain} must expose exactly one canonical ${entry.capabilityDomain}/owner-assertion-set physical receipt identity.`,
    evidence: JSON.stringify({ physicalCheckIds: physicalIds }),
  }));
  const inspectDomain = source.getFunction("inspectDomain")
    ?? source.getVariableDeclaration("inspectDomain")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  if (!inspectDomain || !sessionOutputIsContextBound(inspectDomain)) findings.push(createFinding({
    checkId: "audit-system/runner-law-truth", lawId, filePath: entry.ownerInspectorPath,
    message: `${entry.capabilityDomain} must return output signed by the InspectorContext parameter's checks.output().`,
  }));
  if (!inspectDomain || signedEvaluationWindowIsValid(source, inspectDomain)) return;
  findings.push(createFinding({
    checkId: "audit-system/runner-source", lawId, filePath: entry.ownerInspectorPath,
    message: `${entry.capabilityDomain} must execute its complete owner assertion set exactly once inside one runner-signed runAll callback; repeated work and post-hoc or hollow receipt paths are forbidden.`,
  }));
};

export const inspectOwnerRegistrations = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const entry of context.generatedPlan) {
    inspectedFiles.add(entry.ownerInspectorPath);
    pushOwnerRegistrationFindings(context, findings, entry, lawId);
  }
};
