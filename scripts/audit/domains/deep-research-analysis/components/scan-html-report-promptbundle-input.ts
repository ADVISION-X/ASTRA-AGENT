import type { SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { hasAstNameOrLiteral, hasPropertyAccessSegments } from "./deep-research-ast-facts.js";

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

  if (!hasPropertyAccessSegments(input.htmlReportStageFile, ["input", "fullCaseFile", "researchPlan", "htmlReportPromptBundle"])) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-promptbundle-input-runtime-path",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: "HTML report stage must consume input.fullCaseFile.researchPlan.htmlReportPromptBundle.",
    }));
  }

  for (const marker of [
    ["input", "finalAdjudication"],
    ["input", "fullCaseFileMarkdown"],
  ] as const) {
    if (hasPropertyAccessSegments(input.htmlReportStageFile, marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-promptbundle-input-runtime",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: `HTML report stage is missing required input path: ${marker.join(".")}.`,
    }));
  }

  for (const marker of [
    "htmlReportPromptBundle",
    "DeepResearchPromptBundle",
    "rawFinalAnswerText",
    "fullCaseFileMarkdown",
    "renderHtmlReportFromPromptBundle",
  ]) {
    if (hasAstNameOrLiteral(input.htmlReportPromptFile, marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-promptbundle-input-prompt",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      message: `HTML report prompt is missing ${marker}.`,
    }));
  }
};
