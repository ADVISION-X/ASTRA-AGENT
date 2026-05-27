import { Node, SyntaxKind, type CallExpression, type Expression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const requiredSectionIds = [
  "summary-answer",
  "forensics-process",
  "business-conclusion",
  "n-stage-questions-and-answers",
] as const;

const requiredPromptMarkers = [
  "full-process case report",
  "forensics-process section",
  "n-stage-questions-and-answers",
  "raw-preserved parse failures",
] as const;

const stringLiteralValue = (node: Node): string | null => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return null;
};

const collectStringLiterals = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }
  return [
    ...node.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
    ...node.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
  ];
};

const findVariableInitializer = (sourceFile: SourceFile | undefined, variableName: string): Expression | undefined =>
  sourceFile?.getVariableDeclaration(variableName)?.getInitializer();

const findFunctionLikeBody = (sourceFile: SourceFile | undefined, functionName: string): Node | undefined => {
  const functionDeclaration = sourceFile?.getFunction(functionName);
  if (functionDeclaration) {
    return functionDeclaration.getBody();
  }
  const initializer = findVariableInitializer(sourceFile, functionName);
  if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
    return initializer.getBody();
  }
  return initializer;
};

const hasLiteralContaining = (node: Node | undefined, value: string): boolean =>
  collectStringLiterals(node).some((literal) => literal.includes(value));

const collectArrayLiteralValues = (initializer: Expression | undefined): string[] => {
  if (!Node.isArrayLiteralExpression(initializer)) {
    return [];
  }
  return initializer.getElements().map(stringLiteralValue).filter((value): value is string => value !== null);
};

const getCallExpressionName = (callExpression: CallExpression): string | null => {
  const expression = callExpression.getExpression();
  if (Node.isIdentifier(expression)) {
    return expression.getText();
  }
  if (Node.isPropertyAccessExpression(expression)) {
    return expression.getName();
  }
  return null;
};

const hasDirectCall = (node: Node | undefined, functionName: string): boolean =>
  Boolean(node?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) =>
    getCallExpressionName(callExpression) === functionName,
  ));

const hasIdentifier = (node: Node | undefined, identifierName: string): boolean =>
  Boolean(node?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
    if (identifier.getText() === identifierName) {
      return true;
    }
    const symbol = identifier.getSymbol();
    const checker = identifier.getProject().getTypeChecker();
    return (symbol ? checker.getAliasedSymbol(symbol)?.getName() ?? symbol.getName() : null) === identifierName;
  }));

const hasRegularExpressionLiteral = (sourceFile: SourceFile | undefined): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).length);

const pushFinding = (input: {
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
  checkId: string;
  message: string;
}): void => {
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

const inspectPromptShell = (input: {
  sourceFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const filePath = "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts";
  const htmlShellBody = findFunctionLikeBody(input.sourceFile, "buildHtmlReportFormatShell");
  for (const sectionId of requiredSectionIds) {
    if (hasLiteralContaining(htmlShellBody, sectionId)) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/prompt-section-ast",
      message: `HTML prompt shell must require section id ${sectionId}.`,
    });
  }
  for (const marker of requiredPromptMarkers) {
    if (hasLiteralContaining(htmlShellBody, marker)) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/prompt-marker-ast",
      message: `HTML prompt shell is missing full-process review marker ${marker}.`,
    });
  }
};

const inspectHtmlArtifactValidation = (input: {
  sourceFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const filePath = "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts";
  const sectionInitializer = findVariableInitializer(input.sourceFile, "DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS");
  const actualSectionIds = collectArrayLiteralValues(sectionInitializer);
  for (const sectionId of requiredSectionIds) {
    if (actualSectionIds.includes(sectionId)) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/export-section-ast",
      message: `HTML artifact parser must validate section id ${sectionId}.`,
    });
  }

  const validatorBody = findFunctionLikeBody(input.sourceFile, "hasRequiredBusinessHtmlReviewSections");
  if (!hasIdentifier(validatorBody, "DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/section-list-symbol",
      message: "HTML full-process validator must iterate the exported required section id list.",
    });
  }
  if (!hasDirectCall(validatorBody, "findHtmlSectionIdIndex")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/order-validation-symbol",
      message: "HTML full-process validator must call the section order index helper.",
    });
  }

  const htmlArtifactBody = findFunctionLikeBody(input.sourceFile, "isBusinessHtmlArtifactText");
  if (!hasDirectCall(htmlArtifactBody, "hasRequiredBusinessHtmlReviewSections")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/parser-call-symbol",
      message: "Business HTML artifact parser must call the full-process section validator.",
    });
  }
};

const inspectAcceptanceAndCiWiring = (input: {
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const acceptancePath = "scripts/acceptance/deep-research-html-full-process-report.acceptance.ts";
  for (const marker of [
    "business_html_document_missing",
    "One-voice HTML must not persist as a business report.",
    "Full-process HTML must persist.",
  ]) {
    if (hasLiteralContaining(input.acceptanceFile, marker)) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: acceptancePath,
      checkId: "deep-research/business-html-full-process/acceptance-ast",
      message: `Full-process HTML acceptance must assert ${marker}.`,
    });
  }

  if (!hasLiteralContaining(input.ciFullFile, "acceptance:deep-research-html-full-process-report")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      checkId: "deep-research/business-html-full-process/ci-wiring-ast",
      message: "ci:full must execute the full-process HTML acceptance.",
    });
  }
};

const inspectAntiEvasion = (input: {
  sourceFiles: readonly (SourceFile | undefined)[];
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    if (!sourceFile || !hasRegularExpressionLiteral(sourceFile)) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      checkId: "deep-research/business-html-full-process/no-regex-audit",
      message: "Full-process HTML owner audit coverage must not use regular expression literals.",
    });
  }
};

export const inspectBusinessHtmlFullProcessReviewability = (input: {
  promptBundleShellFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [
    input.promptBundleShellFile,
    input.htmlReportStageFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  inspectPromptShell({
    sourceFile: input.promptBundleShellFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectHtmlArtifactValidation({
    sourceFile: input.htmlReportStageFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectAcceptanceAndCiWiring({
    acceptanceFile: input.acceptanceFile,
    ciFullFile: input.ciFullFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectAntiEvasion({
    sourceFiles: [
      input.promptBundleShellFile,
      input.htmlReportStageFile,
      input.acceptanceFile,
      input.ciFullFile,
    ],
    findings: input.findings,
    lawId: input.lawId,
  });
};
