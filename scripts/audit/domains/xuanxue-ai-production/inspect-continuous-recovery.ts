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

export const workerEnforcesTenBusinessSlots = (sourceFile: SourceFile | null): boolean => {
  if (!sourceFile) return false;
  const available = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "available")
    ?.getInitializerIfKind(SyntaxKind.CallExpression);
  const capacityArguments = available?.getArguments() ?? [];
  const hasTenSeatRemainder = capacityArguments.some((argument) => {
    if (!Node.isBinaryExpression(argument)) return false;
    const left = argument.getLeft();
    return argument.getOperatorToken().getKind() === SyntaxKind.MinusToken
      && Node.isNumericLiteral(left)
      && left.getLiteralValue() === 10
      && astExpressionPath(argument.getRight()) === "state.active.size";
  });
  const hasCoordinatorCapacity = capacityArguments.some((argument) =>
    Node.isCallExpression(argument)
      && astExpressionPath(argument.getExpression()) === "state.execution.availableCapacity");
  const collapsesToOne = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => astExpressionPath(call.getExpression()) === "Math.min"
      && call.getArguments().some((argument) =>
        Node.isNumericLiteral(argument) && argument.getLiteralValue() === 1));
  return astExpressionPath(available?.getExpression()) === "Math.min"
    && hasTenSeatRemainder
    && hasCoordinatorCapacity
    && !collapsesToOne;
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
