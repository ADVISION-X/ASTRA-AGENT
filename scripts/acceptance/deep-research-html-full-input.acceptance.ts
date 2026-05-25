import assert from "node:assert/strict";
import { Project, SyntaxKind, Node } from "ts-morph";

import { renderDeepResearchBusinessHtmlReportPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.js";
import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const fixture = createDeepResearchFullCaseFixture();
const project = new Project({ tsConfigFilePath: "tsconfig.json" });

try {
  const promptText = renderDeepResearchBusinessHtmlReportPrompt({
    finalPackage: fixture.finalPackage,
    finalReport: fixture.finalReport,
    fullCaseFile: fixture.fullCaseFile,
    fullCaseFileMarkdown: fixture.fullCaseFileMarkdown,
    sourceNotes: fixture.finalPackage.sourceNotes,
    language: fixture.job.language,
  });
  for (const marker of [
    "The final report is the decision authority.",
    "The full case file is the complete supporting material.",
    "The structured package is only an index.",
  ]) {
    assert.match(promptText, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(promptText, /Narrative raw-only analysis for Q2/u);
  assert.match(promptText, /Full case file markdown:/u);

  const htmlStageFile = project.getSourceFile(
    "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
  );
  assert(htmlStageFile, "HTML report stage must be visible to ts-morph.");
  const buildPromptCall = htmlStageFile
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "renderDeepResearchBusinessHtmlReportPrompt");
  assert(buildPromptCall, "HTML report stage must render the business HTML prompt.");
  const buildPromptPayload = buildPromptCall?.getArguments()[0];
  assert(Node.isObjectLiteralExpression(buildPromptPayload), "HTML report prompt call must use an object literal payload.");
  assert(buildPromptPayload.getProperty("fullCaseFile"), "HTML report prompt payload must include fullCaseFile.");
  assert(buildPromptPayload.getProperty("fullCaseFileMarkdown"), "HTML report prompt payload must include fullCaseFileMarkdown.");
  assert.match(htmlStageFile?.getFullText() ?? "", /full-case-file/u);
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

process.stdout.write("[ACCEPTANCE][deep-research-html-full-input] PASS\n");