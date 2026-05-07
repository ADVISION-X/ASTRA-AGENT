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
  const planOwnerFromGeneratedPlan = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) =>
    declaration.getName() === "planOwner"
    && declaration.getInitializer()?.getText() === "artifacts.auditPlan.owners[i]"
  );
  const loadsInspectorFromIndexedPlanOwner = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "loadInspector") {
      return false;
    }

    const entryArgument = callExpression.getArguments()[0];
    const entryPath = getExpressionPath(entryArgument && Node.isExpression(entryArgument) ? entryArgument : undefined);
    return entryPath.length === 2 && entryPath[0] === "planOwner" && entryPath[1] === "entry";
  });

  if ((!planLoop || !loadsInspectorFromPlan) && !(planOwnerFromGeneratedPlan && loadsInspectorFromIndexedPlanOwner)) {
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

export const hasDefaultNegativeProofPolicyGate = (sourceFile: AuditSourceFile): boolean => {
  const envDeclaration = sourceFile.getVariableDeclaration("RUN_NEGATIVE_PROOF_ENV");
  const skipDeclaration = sourceFile.getVariableDeclaration("DEFAULT_AUDIT_HEAVY_PROOF_SKIP_ENV");
  const applyPolicy = sourceFile.getFunction("applyDefaultNegativeProofPolicy")
    ?? sourceFile.getVariableDeclaration("applyDefaultNegativeProofPolicy");
  const skipInitializer = skipDeclaration?.getInitializer();
  const skipArray = Node.isArrayLiteralExpression(skipInitializer)
    ? skipInitializer
    : Node.isAsExpression(skipInitializer)
      ? skipInitializer.getExpression().asKind(SyntaxKind.ArrayLiteralExpression)
      : undefined;
  const skipValues = skipArray?.getElements()
    .filter(Node.isStringLiteral)
    .map((literal) => literal.getLiteralText()) ?? [];
  const requiredSkipValues = [
    "GRASSEYE_SKIP_AI_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY",
    "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_INDEX_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_KERNEL_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_MAP_PLUGIN_ORCH_INTEGRATION_NEGATIVE_PROOF",
    "GRASSEYE_SKIP_STRUCTURED_LOGGING_NEGATIVE_PROOF",
  ];
  const sourceText = sourceFile.getFullText();
  const policyCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "applyDefaultNegativeProofPolicy";
  });
  const buildCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "buildAuditArtifacts";
  });

  return envDeclaration?.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralText() === "GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF"
    && sourceText.includes("production mutation negative proof is permanently disabled")
    && requiredSkipValues.every((value) => skipValues.includes(value))
    && Boolean(applyPolicy)
    && Boolean(policyCall && buildCall && policyCall.getStart() < buildCall.getStart());
};
