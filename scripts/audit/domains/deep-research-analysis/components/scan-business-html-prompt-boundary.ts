import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const requiredBoundaryMarkers = [
  "not a researcher",
  "not a final adjudicator",
  "not allowed to conduct deeper research",
  "not allowed to change the final judgment",
  "not allowed to add new facts",
  "not allowed to add new sources",
  "Create a downloadable HTML file artifact named business-report.html.",
  "Use inline CSS inside a <style> tag.",
  "Do not depend on external JavaScript, external CSS, external fonts, or remote images.",
  "Do not include scripts.",
  "Do not use external network resources.",
  "The file content must start with <!DOCTYPE html>.",
  "Do not paste the HTML source into the chat response body.",
] as const;

const requiredExecutiveLayoutMarkers = [
  "Use a centered report shell with max-width: 1180px.",
  "Put an executive summary section near the top before the detailed sections.",
  "Include a side or top table of contents navigation that links to the main sections.",
  "Include print CSS with @media print so the report can be exported cleanly to PDF.",
  "Every major section must have a stable section id for anchor navigation.",
  "Present Ranked Conclusions as a table or a set of decision cards, not as a loose paragraph.",
  "Present Reverse Conditions as warning callouts.",
  "Present Evidence Gaps and Limitations in a visually de-emphasized but still readable section.",
  "Avoid a raw JSON feel; translate structured materials into executive prose, tables, cards, and callouts.",
  "Include an applicability comparison section that contrasts Applicable and Not Applicable conditions.",
] as const;

const inspectPromptMarkers = (input: {
  promptLiteralText: string;
  markers: readonly string[];
  checkId: string;
  lawId: string;
  findings: InspectorFinding[];
}): void => {
  const missingMarkers: string[] = [];
  for (const marker of input.markers) {
    if (input.promptLiteralText.includes(marker)) {
      continue;
    }
    missingMarkers.push(marker);
    input.findings.push(createFinding({
      checkId: input.checkId,
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: `Business HTML prompt must include marker: ${marker}.`,
    }));
  }
  if (missingMarkers.length > 0) {
    process.stdout.write(`[DEEP-RESEARCH-AUDIT][${input.checkId}] missing=${missingMarkers.length}\n`);
  }
};

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
  inspectPromptMarkers({
    promptLiteralText,
    markers: requiredBoundaryMarkers,
    checkId: "deep-research/business-html-prompt-boundary",
    lawId,
    findings: input.findings,
  });
  inspectPromptMarkers({
    promptLiteralText,
    markers: requiredExecutiveLayoutMarkers,
    checkId: "deep-research/business-html-prompt-executive-layout",
    lawId,
    findings: input.findings,
  });
  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-html-prompt-boundary")) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-prompt-ci",
      lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-html-prompt-boundary.",
    }));
  }
  if (promptLiteralText.includes("Return a complete HTML document.")) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-prompt-raw-text",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: "Business HTML prompt must require a downloadable artifact, not raw HTML pasted into chat.",
    }));
  }
};
