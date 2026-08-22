import { Node, SyntaxKind, type ArrowFunction, type Node as MorphNode, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const ciFullPath = "scripts/audit/ci-full.ts";
const requiredGeneratedFiles = new Set([
  "scripts/audit/generated/law-registry.generated.json",
  "scripts/audit/generated/audit-plan.generated.json",
  "scripts/audit/generated/enforcement-matrix.generated.json",
  "scripts/audit/generated/static-clause-coverage.generated.json",
]);

const flattenConjunction = (node: MorphNode): MorphNode[] => {
  if (Node.isBinaryExpression(node)
    && node.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken) {
    return [...flattenConjunction(node.getLeft()), ...flattenConjunction(node.getRight())];
  }
  return [node];
};

const isExactEquality = (node: MorphNode, leftPath: string, rightPath: string): boolean =>
  Node.isBinaryExpression(node)
  && node.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
  && astExpressionPath(node.getLeft()) === leftPath
  && astExpressionPath(node.getRight()) === rightPath;

const isExactNumber = (node: MorphNode, leftPath: string, value: number): boolean => {
  if (!Node.isBinaryExpression(node)
    || node.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken
    || astExpressionPath(node.getLeft()) !== leftPath) return false;
  const right = node.getRight();
  return Node.isNumericLiteral(right) && Number(right.getLiteralValue()) === value;
};

const verifierCoverageIsComplete = (verifier: ArrowFunction): boolean => {
  const returnCondition = verifier.getDescendantsOfKind(SyntaxKind.ConditionalExpression)
    .map((expression) => expression.getCondition())
    .find((condition) => flattenConjunction(condition).some((item) =>
      isExactEquality(item, "summary.machineFacetClauseCount", "summary.executedMachineFacetClauseCount")));
  if (!returnCondition) return false;
  const predicates = flattenConjunction(returnCondition);
  return predicates.some((item) => isExactEquality(item, "summary.activeClauseCount", "summary.boundClauseCount"))
    && predicates.some((item) => isExactEquality(item, "summary.machineFacetClauseCount", "summary.executedMachineFacetClauseCount"))
    && predicates.some((item) => isExactNumber(item, "summary.uncoveredMachineFacetClauseIds.length", 0))
    && predicates.some((item) => isExactEquality(item, "summary.deferredRealChromeFacetCount", "summary.realChromeFacetClauseIds.length"))
    && predicates.some((item) => isExactEquality(item, "summary.deferredRealProviderFacetCount", "summary.realProviderFacetClauseIds.length"))
    && predicates.some((item) => isExactNumber(item, "summary.coveragePercent", 100));
};

const verifierChecksGeneratedSet = (verifier: ArrowFunction): boolean => {
  const declaration = verifier.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "requiredGeneratedFiles");
  const rawInitializer = declaration?.getInitializer();
  const initializer = Node.isArrayLiteralExpression(rawInitializer)
    ? rawInitializer
    : Node.isAsExpression(rawInitializer) || Node.isSatisfiesExpression(rawInitializer)
      ? rawInitializer.getExpression().asKind(SyntaxKind.ArrayLiteralExpression)
      : undefined;
  const paths = new Set(initializer?.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralText()] : []) ?? []);
  const usesFileGate = verifier.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    Node.isIdentifier(call.getExpression()) && astIdentifierName(call.getExpression()) === "fileHasContent");
  return usesFileGate && [...requiredGeneratedFiles].every((path) => paths.has(path));
};

const resolvesToDeclaration = (node: MorphNode, declaration: MorphNode): boolean => {
  const symbol = node.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false);
};

const artifactLawBindingUsesPhasePlan = (source: SourceFile): boolean => {
  const declaration = source.getVariableDeclaration("generatedArtifactTruthLawId");
  const initializer = declaration?.getInitializer();
  if (!initializer) return false;
  const findCall = initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "find"
      && Node.isIdentifier(callee.getExpression())
      && astIdentifierName(callee.getExpression()) === "preArtifactPlannedSteps";
  });
  const predicate = findCall?.getArguments()[0];
  const phaseLiteral = predicate?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .find((literal) => literal.getLiteralValue() === "generated-artifact-truth");
  const lawIndex = initializer.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
    .map((access) => access.getArgumentExpression())
    .find((argument) => Node.isNumericLiteral(argument) && argument.getLiteralValue() === 4);
  return findCall !== undefined && phaseLiteral !== undefined && lawIndex !== undefined;
};

const callHasArtifactLaw = (
  source: SourceFile,
  verifier: ArrowFunction,
  calleeName: string,
): boolean => {
  const lawBinding = source.getVariableDeclaration("generatedArtifactTruthLawId");
  if (!lawBinding) return false;
  return artifactLawBindingUsesPhasePlan(source) &&
  verifier.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    if (!Node.isIdentifier(call.getExpression()) || astIdentifierName(call.getExpression()) !== calleeName) return false;
    const argument = call.getArguments()[0];
    if (!Node.isObjectLiteralExpression(argument)) return false;
    const lawProperty = argument.getProperty("lawId");
    const lawInitializer = Node.isPropertyAssignment(lawProperty) ? lawProperty.getInitializer() : undefined;
    return lawInitializer !== undefined && resolvesToDeclaration(lawInitializer, lawBinding);
  });
};

const callPosition = (main: ArrowFunction, name: string): number | undefined =>
  main.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression()) && astIdentifierName(call.getExpression()) === name)?.getStart();

const ciOrderClosesGeneratedTruth = (source: SourceFile): boolean => {
  const main = source.getVariableDeclaration("main")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  if (!main) return false;
  const build = callPosition(main, "runBuildAuditArtifactsOrFail");
  const ownerPlan = callPosition(main, "runAuditPlanStep");
  const generatedTruth = callPosition(main, "runGeneratedArtifactTruthOrFail");
  return build !== undefined && ownerPlan !== undefined && generatedTruth !== undefined
    && build < ownerPlan && ownerPlan < generatedTruth;
};

export const inspectGeneratedArtifactTruthContract = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const source = context.project.getSourceFile(resolveFromRepo(ciFullPath));
  const verifier = source?.getVariableDeclaration("verifyGeneratedArtifactTruthStep")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const closed = Boolean(source && verifier
    && verifierChecksGeneratedSet(verifier)
    && verifierCoverageIsComplete(verifier)
    && callHasArtifactLaw(source, verifier, "createStepResult")
    && callHasArtifactLaw(source, verifier, "createFirstFailure")
    && ciOrderClosesGeneratedTruth(source));
  return {
    inspectedFiles: [ciFullPath],
    findings: closed ? [] : [createFinding({
      checkId: "audit-system/generated-artifact-truth",
      lawId,
      filePath: ciFullPath,
      message: "CI-FULL must rebuild generated truth, run every owner, then fail closed on the complete 100% owner machine-facet coverage contract with APEX-AUDIT-004 receipt identity.",
    })],
  };
};
