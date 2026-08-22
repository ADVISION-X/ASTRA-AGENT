import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath } from "../../shared/ast-node-identity.js";

export const arrowReturnsNumber = (
  sourceFile: SourceFile | null,
  declarationName: string,
  expected: number,
): boolean => {
  const body = sourceFile?.getVariableDeclaration(declarationName)
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction)?.getBody();
  return Node.isNumericLiteral(body) && Number(body.getLiteralValue()) === expected;
};

export const propertyUsesNumericLiteralCall = (
  sourceFile: SourceFile | null,
  propertyName: string,
  callName: string,
  expected: number,
): boolean => sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
  .some((property) => {
    const call = property.getInitializerIfKind(SyntaxKind.CallExpression);
    const argument = call?.getArguments()[0];
    const callee = call?.getExpression();
    return property.getName() === propertyName
      && Node.isPropertyAccessExpression(callee)
      && callee.getName() === callName
      && Node.isNumericLiteral(argument)
      && Number(argument.getLiteralValue()) === expected;
  }) ?? false;

export const workerEnforcesTenBusinessSlots = (sourceFile: SourceFile | null): boolean => {
  if (!sourceFile) return false;
  const maxInFlightCheck = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .some((expression) => {
      const right = expression.getRight();
      return expression.getOperatorToken().getKind()
        === SyntaxKind.ExclamationEqualsEqualsToken
        && astExpressionPath(expression.getLeft()) === "credential.max_in_flight"
        && Node.isNumericLiteral(right)
        && right.getLiteralValue() === 10;
    });
  const collapsesToOne = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => astExpressionPath(call.getExpression()) === "Math.min"
      && call.getArguments().some((argument) =>
        Node.isNumericLiteral(argument) && argument.getLiteralValue() === 1));
  return maxInFlightCheck && !collapsesToOne;
};

export const workerReconcilesChangedLocalVersions = (
  sourceFile: SourceFile | null,
): boolean => {
  if (!sourceFile) return false;
  const workerLoop = sourceFile.getVariableDeclaration("workerLoop")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const reconciler = sourceFile.getVariableDeclaration(
    "reconcileXuanxueAiProductionLocalNonterminalLedger",
  )?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const loopCallsReconciler = workerLoop?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => astExpressionPath(call.getExpression()) === "reconcileLocalNonterminalLedger") ?? false;
  const reconcilesDerivedInputs = reconciler?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => astExpressionPath(call.getExpression()) === "input.reconcileDerivedInputs") ?? false;
  const commitsVersionAfterReconcile = reconciler?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => astExpressionPath(call.getExpression()) === "input.reconciledVersions.set") ?? false;
  return loopCallsReconciler && reconcilesDerivedInputs && commitsVersionAfterReconcile;
};
