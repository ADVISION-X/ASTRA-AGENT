import { Node, SyntaxKind, type ObjectLiteralExpression, type PropertyAssignment, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const requiredIdentifiers = [
  "SUB_QUESTION_ANSWER_TEXT_BEGIN",
  "SUB_QUESTION_ANSWER_TEXT_END",
  "SUB_QUESTION_INDEX_JSON_BEGIN",
  "SUB_QUESTION_INDEX_JSON_END",
  "extractDelimitedSection",
  "buildDelimitedSubQuestionAnswer",
] as const;

const forbiddenJsonEnvelopeShellLiterals = [
  "Return the answer in the requested response envelope when possible.",
  "Minimal response envelope:",
] as const;

const getPropertyAssignment = (
  objectLiteral: ObjectLiteralExpression | undefined,
  propertyName: string,
): PropertyAssignment | undefined => {
  const property = objectLiteral?.getProperty(propertyName);
  return Node.isPropertyAssignment(property) ? property : undefined;
};

const getAnalysisPromptObject = (
  sourceFile: SourceFile | undefined,
): ObjectLiteralExpression | undefined =>
  sourceFile?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).find((objectLiteral) => {
    const promptId = getPropertyAssignment(objectLiteral, "promptId");
    return promptId?.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralText()
      === "deep-research.sub-question-analysis";
  });

const getAnalysisContractFormat = (sourceFile: SourceFile | undefined): string | null => {
  const promptObject = getAnalysisPromptObject(sourceFile);
  const expectedOutputContract = getPropertyAssignment(promptObject, "expectedOutputContract")
    ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  return getPropertyAssignment(expectedOutputContract, "format")
    ?.getInitializerIfKind(SyntaxKind.StringLiteral)
    ?.getLiteralText() ?? null;
};

const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === value);

const hasStringLiteral = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralText() === value);

const hasPropertyAccessPath = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => astExpressionPath(expression) === value);

export const inspectAnalysisOutputCleanliness = (input: {
  promptBundleShellFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  parserFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): { analysisContractFormat: string | null; findingCount: number } => {
  const findingStart = input.findings.length;
  for (const sourceFile of [
    input.promptBundleShellFile,
    input.analysisSubQuestionsFile,
    input.parserFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  for (const identifier of requiredIdentifiers) {
    if (hasIdentifier(input.parserFile, identifier) || hasIdentifier(input.promptBundleShellFile, identifier)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/analysis-clean-output/missing-marker",
      lawId: input.lawId,
      filePath: input.parserFile ? getRepoSourcePath(input.parserFile) : "src/plugins/deep-research-analysis",
      message: `N-stage clean output marker is missing: ${identifier}.`,
    }));
  }

  for (const literal of forbiddenJsonEnvelopeShellLiterals) {
    if (!hasStringLiteral(input.promptBundleShellFile, literal)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/analysis-clean-output/forbidden-shell-envelope",
      lawId: input.lawId,
      filePath: input.promptBundleShellFile ? getRepoSourcePath(input.promptBundleShellFile) : "src/plugins/deep-research-analysis",
      message: `N-stage runtime shell must not retain forbidden JSON envelope instruction ${literal}.`,
    }));
  }

  const analysisContractFormat = getAnalysisContractFormat(input.analysisSubQuestionsFile);
  if (analysisContractFormat !== "structured_text") {
    input.findings.push(createFinding({
      checkId: "deep-research/analysis-clean-output/contract-format",
      lawId: input.lawId,
      filePath: input.analysisSubQuestionsFile ? getRepoSourcePath(input.analysisSubQuestionsFile) : "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
      message: `N-stage runtime prompt contract must use structured_text, received ${analysisContractFormat ?? "missing"}.`,
    }));
  }

  if (hasPropertyAccessPath(input.parserFile, "candidate.answerText")) {
    input.findings.push(createFinding({
      checkId: "deep-research/analysis-clean-output/json-envelope-parser",
      lawId: input.lawId,
      filePath: input.parserFile ? getRepoSourcePath(input.parserFile) : "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts",
      message: "N-stage parser must not promote candidate.answerText from a JSON envelope into the primary answer body.",
    }));
  }

  return {
    analysisContractFormat,
    findingCount: input.findings.length - findingStart,
  };
};
