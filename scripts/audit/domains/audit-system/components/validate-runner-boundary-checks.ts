import { Node, SyntaxKind } from "ts-morph";

import { getExpressionPath, getNodeLine, getSourceFileOrThrow } from "./audit-system-ts-morph-support.js";

type AuditSourceFile = ReturnType<typeof getSourceFileOrThrow>;

export const hasBuildAuditImport = (sourceFile: AuditSourceFile): boolean => {
  return sourceFile.getImportDeclarations().some(
    (declaration) =>
      declaration.getModuleSpecifierValue() === "./build-audit-artifacts.js" &&
      declaration.getNamedImports().some((specifier) => specifier.getName() === "buildAuditArtifacts"),
  );
};

export const getBuildBeforeLoadViolationLine = (sourceFile: AuditSourceFile): number | undefined => {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const buildCall = callExpressions.find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "buildAuditArtifacts";
  });
  const loadArtifactsCall = callExpressions.find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "loadGeneratedArtifacts";
  });

  if (!buildCall || !loadArtifactsCall || buildCall.getStart() > loadArtifactsCall.getStart()) {
    return getNodeLine(buildCall ?? sourceFile);
  }

  return undefined;
};

export const getPlanDrivenInspectorViolationLine = (sourceFile: AuditSourceFile): number | undefined => {
  const planLoop = sourceFile.getDescendantsOfKind(SyntaxKind.ForOfStatement).find((statement) => {
    const expressionPath = getExpressionPath(statement.getExpression());
    return expressionPath.length === 3 && expressionPath[0] === "artifacts" && expressionPath[1] === "auditPlan" && expressionPath[2] === "owners";
  });
  const planLoopCalls = planLoop?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const loadsInspectorFromPlan = planLoopCalls.some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "loadInspector") {
      return false;
    }

    const entryArgument = callExpression.getArguments()[0];
    const entryPath = getExpressionPath(entryArgument && Node.isExpression(entryArgument) ? entryArgument : undefined);
    return entryPath.length === 2 && entryPath[0] === "planOwner" && entryPath[1] === "entry";
  });

  if (!planLoop || !loadsInspectorFromPlan) {
    return getNodeLine(planLoop ?? sourceFile);
  }

  return undefined;
};

export const getManualOwnerListViolationLine = (sourceFile: AuditSourceFile): number | undefined => {
  const manualOwnerList = sourceFile.getVariableDeclarations().find((declaration) => {
    if (declaration.getSourceFile() !== sourceFile) {
      return false;
    }

    const name = declaration.getName();
    if (name !== "inspectors" && name !== "owners" && name !== "lawIds") {
      return false;
    }

    return Node.isArrayLiteralExpression(declaration.getInitializer());
  });

  return manualOwnerList ? getNodeLine(manualOwnerList) : undefined;
};

export const hasFailureExitAssignment = (sourceFile: AuditSourceFile): boolean => {
  const hasExitCodeAssignment = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      return false;
    }

    const leftPath = getExpressionPath(expression.getLeft());
    const right = expression.getRight();
    return (
      leftPath.length === 2 &&
      leftPath[0] === "process" &&
      leftPath[1] === "exitCode" &&
      Node.isNumericLiteral(right) &&
      right.getLiteralText() === "1"
    );
  });

  const hasFailFastExitCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = getExpressionPath(callExpression.getExpression());
    const firstArgument = callExpression.getArguments()[0];
    return (
      expressionPath.length === 1 &&
      expressionPath[0] === "exitNow" &&
      firstArgument !== undefined &&
      Node.isNumericLiteral(firstArgument) &&
      firstArgument.getLiteralText() === "1"
    );
  });

  return hasExitCodeAssignment || hasFailFastExitCall;
};
