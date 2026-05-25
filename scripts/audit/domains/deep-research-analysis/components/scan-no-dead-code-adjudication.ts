import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const forbiddenAdjudicationSymbols = [
  "decideImportance",
  "filterImportantAnswers",
  "compactForJudgment",
  "summarizeForFinalOnly",
  "downRankForFinal",
] as const;

const markInspected = (inspectedFiles: Set<string>, sourceFiles: readonly (SourceFile | undefined)[]): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

export const inspectNoDeadCodeAdjudication = (input: {
  sourceFiles: readonly SourceFile[];
  finalPackageFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  markInspected(input.inspectedFiles, [input.finalPackageFile, input.acceptanceFile, input.ciFullFile]);

  const finalPackageText = input.finalPackageFile?.getFullText() ?? "";
  if (!finalPackageText.includes("analysisAnswers.length === 0") || !finalPackageText.includes("rawAnalysisInteractionCount === 0")) {
    input.findings.push(createFinding({
      checkId: "deep-research/no-dead-code-final-package-validation",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts",
      message: "Final package validation must allow raw-only analysis coverage and forbid structured-only adjudication gating.",
    }));
  }

  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const strings = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());
    const matched = forbiddenAdjudicationSymbols.filter((symbolName) =>
      identifiers.includes(symbolName) || strings.includes(symbolName),
    );
    if (matched.length === 0) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/no-dead-code-symbol",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Runtime must not introduce dead-code adjudication surface: ${matched.join(", ")}.`,
    }));
  }

  const acceptanceText = input.acceptanceFile?.getFullText() ?? "";
  if (!acceptanceText.includes("fullCaseFileMarkdown") || !acceptanceText.includes("buildDeepResearchFullCaseFile")) {
    input.findings.push(createFinding({
      checkId: "deep-research/no-dead-code-acceptance",
      lawId: input.lawId,
      filePath: "scripts/acceptance/deep-research-final-adjudication-full-input.acceptance.ts",
      message: "Dead-code adjudication acceptance must assert the live full-case-file adjudication path.",
    }));
  }

  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-final-adjudication-full-input")) {
    input.findings.push(createFinding({
      checkId: "deep-research/no-dead-code-ci",
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-final-adjudication-full-input for no-dead-code adjudication coverage.",
    }));
  }
};