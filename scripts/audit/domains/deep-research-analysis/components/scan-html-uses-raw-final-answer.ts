import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasPropertyAccessPath = (sourceFile: SourceFile | undefined, path: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === path);

const forbiddenFinalReportDependencies = [
  "finalReport" + ".summary",
  "finalReport" + ".confidence",
  "finalReport" + ".structuredPayload",
] as const;

export const inspectHtmlUsesRawFinalAnswer = (input: {
  htmlReportPromptFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  promptBundleRenderFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.htmlReportPromptFile, input.htmlReportStageFile, input.promptBundleRenderFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  if (!hasPropertyAccessPath(input.htmlReportPromptFile, "input.finalAdjudication.rawFinalAnswerText")) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-uses-raw-final-answer/raw-input",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      message: "HTML prompt must use finalAdjudication.rawFinalAnswerText.",
    }));
  }
  for (const sourceFile of [input.htmlReportPromptFile, input.htmlReportStageFile, input.promptBundleRenderFile]) {
    if (!sourceFile) continue;
    for (const forbidden of forbiddenFinalReportDependencies) {
      if (!hasPropertyAccessPath(sourceFile, forbidden)) continue;
      input.findings.push(createFinding({
        checkId: "deep-research/html-uses-raw-final-answer/final-report-dependency",
        lawId: input.lawId,
        filePath: getRepoSourcePath(sourceFile),
        message: `HTML report must not depend on ${forbidden}.`,
      }));
    }
  }
};
