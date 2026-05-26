import { Node, SyntaxKind, type CallExpression, type FunctionDeclaration, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { addInspectedFile, requireFunctionDeclaration } from "./deep-research-ui-ast.js";

const clientBootPath = "src/app/workbench-deep-research-client-boot.ts";

const pushFinding = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: SourceFile | undefined;
  checkId: string;
  message: string;
}): void => {
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : clientBootPath,
    message: input.message,
  }));
};

const getFunction = (
  sourceFile: SourceFile | undefined,
  functionName: string,
): FunctionDeclaration | undefined =>
  sourceFile?.getFunctions().find((declaration) => declaration.getName() === functionName);

const isNamedCall = (call: CallExpression, name: string): boolean => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) {
    return expression.getText() === name;
  }
  return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
};

const objectLiteralHasTrueProperty = (call: CallExpression, propertyName: string): boolean => {
  const objectArg = call.getArguments().find(Node.isObjectLiteralExpression);
  return Boolean(objectArg?.getProperties().some((property) => {
    if (!Node.isPropertyAssignment(property)) {
      return false;
    }
    const nameNode = property.getNameNode();
    const initializer = property.getInitializer();
    return Node.isIdentifier(nameNode)
      && nameNode.getText() === propertyName
      && initializer?.getKind() === SyntaxKind.TrueKeyword;
  }));
};

const hasStateFormCloseAssignment = (declaration: FunctionDeclaration | undefined): boolean =>
  Boolean(declaration?.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      return false;
    }
    const left = expression.getLeft();
    const right = expression.getRight();
    return Node.isPropertyAccessExpression(left)
      && Node.isIdentifier(left.getExpression())
      && left.getExpression().getText() === "state"
      && left.getName() === "formOpen"
      && right.getKind() === SyntaxKind.FalseKeyword;
  }));

const hasActiveFormGuard = (declaration: FunctionDeclaration | undefined): boolean => {
  const ifStatements = declaration?.getDescendantsOfKind(SyntaxKind.IfStatement) ?? [];
  return ifStatements.some((statement) => {
    const conditionCallsActiveGuard = statement.getExpression()
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => isNamedCall(call, "isDeepResearchFormActive"));
    const closesForm = statement.getThenStatement()
      .getDescendantsOfKind(SyntaxKind.BinaryExpression)
      .some((expression) => {
        if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
          return false;
        }
        const left = expression.getLeft();
        return Node.isPropertyAccessExpression(left) && left.getName() === "formOpen";
      });
    return conditionCallsActiveGuard && closesForm;
  });
};

const hasFormActivitySignals = (declaration: FunctionDeclaration | undefined): boolean => {
  const propertyAccesses = declaration?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression) ?? [];
  const hasActiveElement = propertyAccesses.some((access) =>
    access.getName() === "activeElement"
    && Node.isIdentifier(access.getExpression())
    && access.getExpression().getText() === "document",
  );
  const hasContainsCheck = propertyAccesses.some((access) => access.getName() === "contains");
  const namedItemArguments = (declaration?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .filter((call) => isNamedCall(call, "namedItem"))
    .flatMap((call) => call.getArguments())
    .filter(Node.isStringLiteral)
    .map((literal) => literal.getLiteralValue());
  return hasActiveElement
    && hasContainsCheck
    && namedItemArguments.includes("userQuestion")
    && namedItemArguments.includes("analysisGoal");
};

const hasPollingPreserveOption = (declaration: FunctionDeclaration | undefined): boolean =>
  Boolean(declaration?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => isNamedCall(call, "setInterval"))
    .some((setIntervalCall) => {
      const callback = setIntervalCall.getArguments()[0];
      if (!callback || !(Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))) {
        return false;
      }
      return callback.getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => isNamedCall(call, "loadSelectedReport"))
        .some((call) => objectLiteralHasTrueProperty(call, "preserveFormOpen"));
    }));

export const inspectDeepResearchFormPollingUi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sourceFile = input.context.project.getSourceFile(clientBootPath);
  addInspectedFile(input.inspectedFiles, sourceFile);
  for (const functionName of [
    "isDeepResearchFormActive",
    "closeDeepResearchFormUnlessActive",
    "loadSelectedReport",
  ]) {
    requireFunctionDeclaration({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-form-polling-function",
      functionName,
    });
  }

  const formActiveFunction = getFunction(sourceFile, "isDeepResearchFormActive");
  if (!hasFormActivitySignals(formActiveFunction)) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      sourceFile,
      checkId: "local-app-shell/deep-research-form-active-signal",
      message: "Deep Research form guard must inspect focus and draft fields before any automatic close.",
    });
  }

  const closeHelper = getFunction(sourceFile, "closeDeepResearchFormUnlessActive");
  if (!hasActiveFormGuard(closeHelper)) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      sourceFile,
      checkId: "local-app-shell/deep-research-form-close-guard",
      message: "Deep Research form close helper must guard state.formOpen=false behind isDeepResearchFormActive().",
    });
  }

  const loadSelectedReport = getFunction(sourceFile, "loadSelectedReport");
  if (hasStateFormCloseAssignment(loadSelectedReport)) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      sourceFile,
      checkId: "local-app-shell/deep-research-report-load-form-close",
      message: "loadSelectedReport must not directly close the New Research form; polling and report rendering must preserve active input.",
    });
  }
  if (!hasPollingPreserveOption(loadSelectedReport)) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      sourceFile,
      checkId: "local-app-shell/deep-research-poll-preserve-form",
      message: "Deep Research polling refresh must call loadSelectedReport with preserveFormOpen=true.",
    });
  }
};
