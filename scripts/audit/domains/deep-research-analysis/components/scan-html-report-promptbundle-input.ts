import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasPropertyAccessPath = (sourceFile: SourceFile | undefined, path: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === path);

export const inspectHtmlReportPromptBundleInput = (input: {
  htmlReportStageFile: SourceFile | undefined;
  htmlReportPromptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.htmlReportStageFile, input.htmlReportPromptFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  if (!hasPropertyAccessPath(input.htmlReportStageFile, "input.fullCaseFile.researchPlan.htmlReportPromptBundle")) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-promptbundle-input-runtime-path",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: "HTML report stage must consume input.fullCaseFile.researchPlan.htmlReportPromptBundle.",
    }));
  }

  const htmlStageText = input.htmlReportStageFile?.getFullText() ?? "";
  for (const marker of ["finalReport: input.finalReport", "fullCaseFileMarkdown: input.fullCaseFileMarkdown"]) {
    if (htmlStageText.includes(marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-promptbundle-input-runtime",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: `HTML report stage is missing required input marker: ${marker}.`,
    }));
  }

  const promptText = input.htmlReportPromptFile?.getFullText() ?? "";
  for (const marker of [
    "Runtime shell for AI-generated htmlReportPromptBundle.",
    "htmlReportPromptBundle: DeepResearchPromptBundle",
    "fullCaseFileMarkdown",
    "renderHtmlReportFromPromptBundle",
  ]) {
    if (promptText.includes(marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-promptbundle-input-prompt",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: `HTML report prompt is missing ${marker}.`,
    }));
  }
};