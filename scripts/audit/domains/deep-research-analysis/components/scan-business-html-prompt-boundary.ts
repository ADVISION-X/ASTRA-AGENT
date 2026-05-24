import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export const inspectBusinessHtmlPromptBoundary = (input: {
  context: InspectorContext;
  promptFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-031-V1");
  [input.promptFile, input.ciFullFile].forEach((sourceFile) => {
    if (sourceFile) {
      input.inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
  const promptLiteralText = input.promptFile?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralValue())
    .join("\n") ?? "";
  const promptDeclaration = input.promptFile?.getVariableDeclaration("businessHtmlReportPublisherPrompt");
  if (!promptDeclaration) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-prompt-asset",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: "businessHtmlReportPublisherPrompt must be an AST-visible prompt object literal.",
    }));
  }
  for (const marker of [
    "not a researcher",
    "not a final adjudicator",
    "not allowed to conduct deeper research",
    "not allowed to change the final judgment",
    "not allowed to add new facts",
    "not allowed to add new sources",
    "Create a complete self-contained HTML report file.",
    "Use inline CSS inside a <style> tag.",
    "Do not depend on external JavaScript, external CSS, external fonts, or remote images.",
    "Do not include scripts.",
    "Do not use external network resources.",
    "The document must start with <!DOCTYPE html>.",
  ] as const) {
    if (promptLiteralText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-prompt-boundary",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: `Business HTML prompt must include boundary marker: ${marker}.`,
    }));
  }
  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-html-prompt-boundary")) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-prompt-ci",
      lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-html-prompt-boundary.",
    }));
  }
};