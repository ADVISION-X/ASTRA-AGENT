import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const requiredShells = [
  "buildResearchPlanFormatShell",
  "buildSubQuestionAnalysisFormatShell",
  "buildFinalAdjudicationFormatShell",
  "buildHtmlReportFormatShell",
] as const;

const forbiddenBusinessShellFields = [
  "confidence",
  "finalVerdict",
  "rankedConclusions",
  "directAnswer",
  "investmentThesis",
  "trainingFramework",
] as const;

const hasFunction = (sourceFile: SourceFile, functionName: string): boolean =>
  sourceFile.getFunctions().some((fn) => fn.getName() === functionName)
  || sourceFile.getVariableDeclarations().some((decl) => decl.getName() === functionName);

const stringLiterals = (sourceFile: SourceFile): string[] =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText());

const identifiers = (sourceFile: SourceFile): string[] =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());

export const inspectFormatShellBoundary = (input: {
  promptBundleShellFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sourceFile = input.promptBundleShellFile;
  if (!sourceFile) return;
  input.inspectedFiles.add(getRepoSourcePath(sourceFile));

  for (const shellName of requiredShells) {
    if (hasFunction(sourceFile, shellName)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/format-shell-boundary/missing-shell",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      message: `Runtime format shell must expose ${shellName}.`,
    }));
  }

  const literalList = stringLiterals(sourceFile);
  const identifierList = identifiers(sourceFile);
  const tokens = [...literalList, ...identifierList].join("\n");
  for (const field of forbiddenBusinessShellFields) {
    if (!tokens.includes(field)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/format-shell-boundary/business-field",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      message: `Runtime format shell must not define business field ${field}.`,
    }));
  }

  for (const required of ["answerText", "indexNotes", "rawFinalAnswerText", "<!DOCTYPE html>"]) {
    if (tokens.includes(required)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/format-shell-boundary/required-format-marker",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      message: `Runtime format shell is missing ${required}.`,
    }));
  }
};
