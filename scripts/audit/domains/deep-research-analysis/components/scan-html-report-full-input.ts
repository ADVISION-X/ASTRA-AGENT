import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const markInspected = (inspectedFiles: Set<string>, sourceFiles: readonly (SourceFile | undefined)[]): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

export const inspectHtmlReportFullInput = (input: {
  htmlReportPromptFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  clientDeliverySectionsFile: SourceFile | undefined;
  workbenchRoutesFile: SourceFile | undefined;
  reportViewFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  markInspected(input.inspectedFiles, [
    input.htmlReportPromptFile,
    input.htmlReportStageFile,
    input.clientDeliverySectionsFile,
    input.workbenchRoutesFile,
    input.reportViewFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);

  const promptText = input.htmlReportPromptFile?.getFullText() ?? "";
  for (const marker of [
    "The final report is the decision authority.",
    "The full case file is the complete supporting material.",
    "The structured package is only an index.",
  ]) {
    if (promptText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-prompt-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: `HTML report prompt must include marker: ${marker}.`,
    }));
  }

  const buildPromptCall = input.htmlReportStageFile
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "renderDeepResearchBusinessHtmlReportPrompt");
  const buildPromptPayload = buildPromptCall?.getArguments()[0];
  if (!Node.isObjectLiteralExpression(buildPromptPayload)) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-payload",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: "HTML report stage must render the prompt with an object literal payload.",
    }));
  } else {
    for (const propertyName of ["fullCaseFile", "fullCaseFileMarkdown"]) {
      if (buildPromptPayload.getProperty(propertyName)) {
        continue;
      }
      input.findings.push(createFinding({
        checkId: "deep-research/html-full-input-property",
        lawId: input.lawId,
        filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
        message: `HTML report prompt payload must include ${propertyName}.`,
      }));
    }
  }

  const htmlStageText = input.htmlReportStageFile?.getFullText() ?? "";
  if (!htmlStageText.includes("full-case-file")) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-input-ref",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: "HTML report stage must include the full case file in inputRefs.",
    }));
  }

  const deliveryText = input.clientDeliverySectionsFile?.getFullText() ?? "";
  for (const marker of ["Open Full Case File", "Download full-case-file.md", "Download full-case-file.json"]) {
    if (deliveryText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-delivery-marker",
      lawId: input.lawId,
      filePath: "src/app/workbench-deep-research-client-delivery-sections.ts",
      message: `Workbench delivery section must include marker: ${marker}.`,
    }));
  }

  if (!(input.reportViewFile?.getFullText() ?? "").includes("data-deep-research-full-case-file")) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-report-view",
      lawId: input.lawId,
      filePath: "src/app/workbench-deep-research-report-view.ts",
      message: "Report view must expose a dedicated full case file section.",
    }));
  }

  const routesText = input.workbenchRoutesFile?.getFullText() ?? "";
  for (const marker of ["full-case-file.md", "full-case-file.json"]) {
    if (routesText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-route-marker",
      lawId: input.lawId,
      filePath: "src/app/workbench-deep-research-routes.ts",
      message: `Workbench routes must allow ${marker}.`,
    }));
  }

  const acceptanceText = input.acceptanceFile?.getFullText() ?? "";
  if (!acceptanceText.includes("renderDeepResearchBusinessHtmlReportPrompt") || !acceptanceText.includes("fullCaseFileMarkdown")) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-acceptance",
      lawId: input.lawId,
      filePath: "scripts/acceptance/deep-research-html-full-input.acceptance.ts",
      message: "HTML full-input acceptance must assert prompt ownership and full case file inputs.",
    }));
  }

  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-html-full-input")) {
    input.findings.push(createFinding({
      checkId: "deep-research/html-full-input-ci",
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-html-full-input.",
    }));
  }
};