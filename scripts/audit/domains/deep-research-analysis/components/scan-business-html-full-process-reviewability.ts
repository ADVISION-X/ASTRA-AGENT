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
  "raw response hash",
  "80 percent",
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

const unwrapExpression = (expression: Expression | undefined): Expression | undefined => {
  let current = expression;
  while (current && (Node.isAsExpression(current) || Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current))) {
    current = current.getExpression();
  }
  return current;
};

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
  const unwrapped = unwrapExpression(initializer);
  if (!Node.isArrayLiteralExpression(unwrapped)) {
    return [];
  }
  return unwrapped.getElements().map(stringLiteralValue).filter((value): value is string => value !== null);
};

const readNumericLiteralValue = (initializer: Expression | undefined): number | null => {
  const unwrapped = unwrapExpression(initializer);
  if (!Node.isNumericLiteral(unwrapped)) {
    return null;
  }
  return Number(unwrapped.getLiteralText());
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
  contractFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const filePath = "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts";
  const contractPath = "src/plugins/deep-research-analysis/deep-research-analysis.html-report-contract.ts";
  const sectionInitializer = findVariableInitializer(input.contractFile, "DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS");
  const actualSectionIds = collectArrayLiteralValues(sectionInitializer);
  for (const sectionId of requiredSectionIds) {
    if (actualSectionIds.includes(sectionId)) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: contractPath,
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
  const parseBody = findFunctionLikeBody(input.sourceFile, "parseAndPersistBusinessHtmlReport");
  if (!hasDirectCall(parseBody, "readBusinessHtmlCaseFileFailure")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath,
      checkId: "deep-research/business-html-full-process/case-file-binding-symbol",
      message: "Business HTML parser must validate case-file binding, N-stage citations, and retention before persistence.",
    });
  }
  const retentionFloor = readNumericLiteralValue(findVariableInitializer(input.contractFile, "DEEP_RESEARCH_BUSINESS_HTML_N_STAGE_RETENTION_FLOOR"));
  if (retentionFloor !== 0.8) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: contractPath,
      checkId: "deep-research/business-html-full-process/retention-floor-symbol",
      message: "Business HTML parser must keep the N-stage retention floor at 0.8.",
    });
  }
};

const inspectAcceptanceAndCiWiring = (input: {
  acceptanceFile: SourceFile | undefined;
  ciAcceptanceBindingsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const acceptancePath = "scripts/acceptance/deep-research-html-full-process-report.acceptance.ts";
  for (const marker of [
    "business_html_document_missing",
    "business_html_case_file_job_id_missing",
    "business_html_n_stage_citation_missing",
    "business_html_n_stage_retention_below_80",
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

  if (!hasLiteralContaining(input.ciAcceptanceBindingsFile, acceptancePath)) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "scripts/audit/ci-acceptance-law-bindings.ts",
      checkId: "deep-research/business-html-full-process/ci-wiring-ast",
      message: "ci:full must bind the full-process HTML physical acceptance leaf.",
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
  htmlReportContractFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciAcceptanceBindingsFile: SourceFile | undefined;
  ownerComponentFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [
    input.promptBundleShellFile,
    input.htmlReportStageFile,
    input.htmlReportContractFile,
    input.acceptanceFile,
    input.ciAcceptanceBindingsFile,
    input.ownerComponentFile,
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
    contractFile: input.htmlReportContractFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectAcceptanceAndCiWiring({
    acceptanceFile: input.acceptanceFile,
    ciAcceptanceBindingsFile: input.ciAcceptanceBindingsFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectAntiEvasion({
    sourceFiles: [
      input.ownerComponentFile,
    ],
    findings: input.findings,
    lawId: input.lawId,
  });
};
